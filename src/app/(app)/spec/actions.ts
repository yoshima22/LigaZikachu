"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";
import { getSpecConfig } from "@/lib/spec/config";
import { canStartSpecStream, canManageSpecStream, getMatchTournamentId } from "@/lib/spec/authorization";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";
import { SPEC_MAX_STREAM_MINUTES, SPEC_MAX_CONCURRENT_STREAMS, parseYouTubeVideoId } from "@/lib/spec/constants";
import { enrichSpecStreams } from "@/lib/spec/data";
import { publishLeagueTicker } from "@/lib/league-ticker";
import { specLiveTickerMessage } from "@/lib/spec/announce";

type ActionError = { error: string };

// Uma live é considerada "ativa" enquanto está preparando ou ao vivo.
const ACTIVE_STATUSES = ["PREPARING", "LIVE"] as const;

// Marca como stale lives que passaram do tempo máximo (evita live fantasma).
async function expireStaleStreams() {
  const cutoff = new Date(Date.now() - SPEC_MAX_STREAM_MINUTES * 60_000);
  // Abas em segundo plano podem ter timers reduzidos pelo navegador. Três
  // minutos evitam falso encerramento sem deixar uma live travada para sempre.
  const heartbeatCutoff = new Date(Date.now() - 3 * 60_000);
  await prisma.specStream.updateMany({
    where: {
      status: { in: ["PREPARING", "LIVE"] },
      OR: [
        { createdAt: { lt: cutoff } },
        { status: "LIVE", provider: { not: "youtube" }, lastSeenAt: { lt: heartbeatCutoff } },
      ],
    },
    data: { status: "ENDED", endedAt: new Date() },
  }).catch(() => null);
}

/** Lives ao vivo agora (para a listagem do Modo SPEC). */
export async function listActiveSpecStreamsAction() {
  const config = await getSpecConfig();
  if (!config.enabled) return { streams: [] as Array<never> };
  await expireStaleStreams();
  const streams = await prisma.specStream.findMany({
    where: { status: "LIVE" },
    orderBy: { startedAt: "desc" },
    select: { id: true, matchId: true, tournamentId: true, title: true, broadcasterUserId: true, startedAt: true },
  }).catch(() => []);
  return { streams };
}

/** Estado do Modo SPEC para uma partida (usado no card de resultados). */
export async function getSpecMatchStateAction(matchId: string): Promise<{
  enabled: boolean;
  stream: { id: string; status: string; mine: boolean } | null;
}> {
  const config = await getSpecConfig();
  if (!config.enabled) return { enabled: false, stream: null };
  await expireStaleStreams();
  const session = await getAppSession();
  const stream = await prisma.specStream.findFirst({
    where: { matchId, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, broadcasterUserId: true },
  }).catch(() => null);
  return {
    enabled: true,
    stream: stream ? { id: stream.id, status: stream.status, mine: stream.broadcasterUserId === session?.user?.id } : null,
  };
}

/** Retorna a live ativa (preparando/ao vivo) de uma partida, se houver. */
export async function getSpecStreamForMatchAction(matchId: string) {
  const config = await getSpecConfig();
  if (!config.enabled) return { stream: null };
  await expireStaleStreams();
  const stream = await prisma.specStream.findFirst({
    where: { matchId, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, broadcasterUserId: true, startedAt: true },
  }).catch(() => null);
  return { stream };
}

/**
 * Cria a transmissão (PREPARING) de uma partida, se o usuário puder transmitir e
 * ainda não houver live ativa para essa partida. Retorna o id para o broadcaster
 * seguir com a captura de tela e a publicação.
 */
export async function startSpecStreamAction(matchId: string): Promise<ActionError | { streamId: string }> {
  const config = await getSpecConfig();
  if (!config.enabled) return { error: "O Modo SPEC está desativado." };

  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado." };
  const player = await getSessionPlayer(session.user.id);
  const isAdmin = isStaff(session.user.role);

  const tournamentId = await getMatchTournamentId(matchId);
  if (!tournamentId) return { error: "Partida de torneio não encontrada." };

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { playerAId: true, playerBId: true },
  });
  if (!match) return { error: "Partida não encontrada." };

  const allowed = await canStartSpecStream({
    playerId: player?.id ?? null,
    isAdmin,
    tournamentId,
    policy: config.broadcasterPolicy,
    matchPlayerIds: [match.playerAId, match.playerBId].filter((id): id is string => Boolean(id)),
  });
  if (!allowed) return { error: "Você não tem permissão para transmitir esta partida." };

  await expireStaleStreams();

  // Limite de transmissões ao vivo simultâneas (controle de custo/egress).
  const liveCount = await prisma.specStream.count({ where: { status: "LIVE" } }).catch(() => 0);
  if (liveCount >= SPEC_MAX_CONCURRENT_STREAMS) {
    return { error: `Limite de ${SPEC_MAX_CONCURRENT_STREAMS} transmissões ao vivo simultâneas atingido. Tente novamente mais tarde.` };
  }

  // Uma única live ativa por partida (protegido por transação contra corrida).
  try {
    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.specStream.findFirst({
        where: { matchId, status: { in: [...ACTIVE_STATUSES] } },
        select: { id: true },
      });
      if (existing) throw new Error("ALREADY_LIVE");
      return tx.specStream.create({
        data: { matchId, tournamentId, broadcasterUserId: session.user.id, status: "PREPARING", provider: getSpecProvider().name },
        select: { id: true },
      });
    });
    revalidatePath("/spec");
    return { streamId: created.id };
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_LIVE") {
      return { error: "Esta partida já possui uma transmissão ativa." };
    }
    return { error: error instanceof Error ? error.message : "Falha ao iniciar a transmissão." };
  }
}

/**
 * Cria uma transmissão AVULSA (fora de partida/torneio). Apenas staff. Retorna o
 * id para o broadcaster seguir com a captura de tela.
 */
export async function startStandaloneSpecStreamAction(title: string): Promise<ActionError | { streamId: string }> {
  const config = await getSpecConfig();
  if (!config.enabled) return { error: "O Modo SPEC está desativado." };
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado." };
  const clean = title.trim().slice(0, 80);
  if (clean.length < 3) return { error: "Dê um título com pelo menos 3 caracteres." };

  await expireStaleStreams();
  const liveCount = await prisma.specStream.count({ where: { status: "LIVE" } }).catch(() => 0);
  if (liveCount >= SPEC_MAX_CONCURRENT_STREAMS) {
    return { error: `Limite de ${SPEC_MAX_CONCURRENT_STREAMS} transmissões ao vivo simultâneas atingido. Tente novamente mais tarde.` };
  }

  const created = await prisma.specStream.create({
    data: { title: clean, broadcasterUserId: session.user.id, status: "PREPARING", provider: config.mode },
    select: { id: true },
  });
  revalidatePath("/spec");
  return { streamId: created.id };
}

/**
 * Marca a live como LIVE no modo P2P mesh (não há SDP no servidor). Apenas o dono.
 * Anuncia no ticker, como o publish da Cloudflare.
 */
export async function markSpecStreamLiveAction(streamId: string): Promise<ActionError | { ok: true }> {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado." };
  const stream = await prisma.specStream.findUnique({
    where: { id: streamId },
    select: { id: true, matchId: true, tournamentId: true, title: true, broadcasterUserId: true, status: true },
  });
  if (!stream) return { error: "Transmissão não encontrada." };
  if (stream.broadcasterUserId !== session.user.id) return { error: "Apenas o dono pode iniciar esta transmissão." };
  if (stream.status !== "PREPARING" && stream.status !== "LIVE") return { error: "Esta transmissão não está disponível." };

  await prisma.specStream.update({ where: { id: streamId }, data: { provider: "p2p-mesh", status: "LIVE", startedAt: new Date(), lastSeenAt: new Date() } });
  try {
    const [view] = await enrichSpecStreams([stream]);
    if (view) {
      await publishLeagueTicker({
        type: "spec_live",
        message: specLiveTickerMessage({ isCombat: Boolean(stream.matchId || stream.tournamentId), label: view.matchLabel }),
        href: `/spec/${stream.id}`,
        eventKey: `spec-live-${stream.id}`,
        priority: 5,
        ttlHours: 3,
      });
    }
  } catch (e) { console.error("[spec] falha ao anunciar no ticker (p2p)", e); }
  revalidatePath("/spec");
  return { ok: true };
}

/**
 * Modo YouTube: o dono cola a URL/id da live não listada do YouTube. Salvamos o
 * videoId e colocamos a transmissão AO VIVO (o embed passa a aparecer na Zika TV).
 */
export async function setSpecStreamYouTubeAction(streamId: string, urlOrId: string): Promise<ActionError | { ok: true }> {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado." };
  const videoId = parseYouTubeVideoId(urlOrId ?? "");
  if (!videoId) return { error: "Link do YouTube inválido. Cole a URL da live (ou o id de 11 caracteres)." };
  const stream = await prisma.specStream.findUnique({
    where: { id: streamId },
    select: { id: true, matchId: true, tournamentId: true, title: true, broadcasterUserId: true, status: true },
  });
  if (!stream) return { error: "Transmissão não encontrada." };
  if (stream.broadcasterUserId !== session.user.id) return { error: "Apenas o dono pode iniciar esta transmissão." };
  if (stream.status !== "PREPARING" && stream.status !== "LIVE") return { error: "Esta transmissão não está disponível." };

  const wasLive = stream.status === "LIVE";
  await prisma.specStream.update({
    where: { id: streamId },
    data: { youtubeVideoId: videoId, provider: "youtube", status: "LIVE", startedAt: wasLive ? undefined : new Date(), lastSeenAt: new Date() },
  });
  if (!wasLive) {
    try {
      const [view] = await enrichSpecStreams([stream]);
      if (view) {
        await publishLeagueTicker({
          type: "spec_live",
          message: specLiveTickerMessage({ isCombat: Boolean(stream.matchId || stream.tournamentId), label: view.matchLabel }),
          href: `/spec/${stream.id}`,
          eventKey: `spec-live-${stream.id}`,
          priority: 5,
          ttlHours: 3,
        });
      }
    } catch (e) { console.error("[spec] falha ao anunciar no ticker (youtube)", e); }
  }
  revalidatePath("/spec");
  return { ok: true };
}

/** Encerra uma transmissão (dono ou admin). */
export async function endSpecStreamAction(streamId: string): Promise<ActionError | { ok: true }> {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado." };
  const isAdmin = isStaff(session.user.role);

  const stream = await prisma.specStream.findUnique({
    where: { id: streamId },
    select: { id: true, broadcasterUserId: true, broadcastSessionId: true, status: true },
  });
  if (!stream) return { error: "Transmissão não encontrada." };
  if (!canManageSpecStream({ userId: session.user.id, isAdmin, broadcasterUserId: stream.broadcasterUserId })) {
    return { error: "Você não pode encerrar esta transmissão." };
  }
  if (stream.status === "ENDED" || stream.status === "FAILED") return { ok: true };

  if (stream.broadcastSessionId) {
    await getSpecProvider().closeSession(stream.broadcastSessionId).catch((e) => {
      if (!(e instanceof SpecProviderNotConfiguredError)) console.error("[spec] closeSession falhou", e);
    });
  }
  await prisma.specStream.update({ where: { id: streamId }, data: { status: "ENDED", endedAt: new Date() } });
  // Limpa sinais P2P e presença efêmeros desta live.
  await prisma.specSignal.deleteMany({ where: { streamId } }).catch(() => null);
  await prisma.specSpectator.deleteMany({ where: { streamId } }).catch(() => null);
  await prisma.specChatMessage.deleteMany({ where: { streamId } }).catch(() => null);
  revalidatePath("/spec");
  return { ok: true };
}
