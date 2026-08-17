"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";
import { getSpecConfig } from "@/lib/spec/config";
import { canStartSpecStream, canManageSpecStream, getMatchTournamentId } from "@/lib/spec/authorization";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";
import { SPEC_MAX_STREAM_MINUTES } from "@/lib/spec/constants";

type ActionError = { error: string };

// Uma live é considerada "ativa" enquanto está preparando ou ao vivo.
const ACTIVE_STATUSES = ["PREPARING", "LIVE"] as const;

// Marca como stale lives que passaram do tempo máximo (evita live fantasma).
async function expireStaleStreams() {
  const cutoff = new Date(Date.now() - SPEC_MAX_STREAM_MINUTES * 60_000);
  await prisma.specStream.updateMany({
    where: { status: { in: ["PREPARING", "LIVE"] }, createdAt: { lt: cutoff } },
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
    select: { id: true, matchId: true, tournamentId: true, broadcasterUserId: true, startedAt: true },
  });
  return { streams };
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
  });
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
  revalidatePath("/spec");
  return { ok: true };
}
