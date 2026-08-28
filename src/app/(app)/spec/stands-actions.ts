"use server";

import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";
import { getSpecConfig } from "@/lib/spec/config";
import { recordSpectatorWatchAndCheck } from "@/lib/spec/usage";
import { SPEC_PRESENCE_HEARTBEAT_SECONDS } from "@/lib/spec/constants";

// Janela para considerar um espectador "online" na arquibancada (ms).
const PRESENCE_WINDOW_MS = 60_000;

export type StandsState = {
  spectators: Array<{ userId: string; name: string }>;
  count: number;
  canManage: boolean;
  chat: Array<{ id: string; userId: string; userName: string; message: string; createdAt: Date }>;
  poll: {
    id: string;
    question: string;
    options: string[];
    counts: number[];
    totalVotes: number;
    myVote: number | null;
    status: "OPEN" | "CLOSED";
  } | null;
};

export type StandsResponse =
  | (StandsState & { unchanged: false; revision: string })
  | { unchanged: true; revision: string };

async function loadStreamOwner(streamId: string) {
  return prisma.specStream.findUnique({
    where: { id: streamId },
    select: { broadcasterUserId: true, status: true },
  }).catch(() => null);
}

/** Heartbeat: registra/atualiza a presença do espectador na arquibancada. */
export async function heartbeatSpecPresenceAction(streamId: string): Promise<{ ok: boolean }> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false };
  const config = await getSpecConfig();
  if (!config.enabled) return { ok: false };
  const stream = await loadStreamOwner(streamId);
  if (!stream || stream.status !== "LIVE") return { ok: false };

  const name = session.user.name?.trim() || "Espectador";
  await prisma.specSpectator.upsert({
    where: { streamId_userId: { streamId, userId: session.user.id } },
    create: { streamId, userId: session.user.id, displayName: name, lastSeenAt: new Date() },
    update: { lastSeenAt: new Date(), displayName: name },
  }).catch(() => null);
  // Acumula o tempo real de audiência para a estimativa de egress (corte de custo).
  await recordSpectatorWatchAndCheck(SPEC_PRESENCE_HEARTBEAT_SECONDS).catch(() => null);
  return { ok: true };
}

/** Sai da arquibancada (ao fechar o player). */
export async function leaveSpecPresenceAction(streamId: string): Promise<void> {
  const session = await getAppSession();
  if (!session?.user?.id) return;
  await prisma.specSpectator.deleteMany({ where: { streamId, userId: session.user.id } }).catch(() => null);
}

/** Estado da arquibancada + enquete ativa (para o watch e o painel do transmissor). */
export async function getSpecStandsAction(streamId: string, knownRevision?: string): Promise<StandsResponse> {
  const empty: StandsState = { spectators: [], count: 0, canManage: false, chat: [], poll: null };
  const session = await getAppSession();
  if (!session?.user?.id) return { ...empty, unchanged: false, revision: "anonymous" };
  const config = await getSpecConfig();
  if (!config.enabled) return { ...empty, unchanged: false, revision: "disabled" };

  const stream = await loadStreamOwner(streamId);
  if (!stream) return { ...empty, unchanged: false, revision: "missing" };
  const canManage = stream.broadcasterUserId === session.user.id || isStaff(session.user.role);

  const since = new Date(Date.now() - PRESENCE_WINDOW_MS);
  // O snapshot é consultado frequentemente durante uma live. Primeiro buscamos
  // somente os marcadores pequenos necessários para detectar uma alteração. O
  // histórico do chat só é transferido quando a revisão realmente mudou.
  const [spectators, poll, latestChat] = await Promise.all([
    prisma.specSpectator.findMany({
      where: { streamId, lastSeenAt: { gte: since } },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, displayName: true },
    }).catch(() => []),
    prisma.specPoll.findFirst({
      where: { streamId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, question: true, options: true, status: true },
    }).catch(() => null),
    prisma.specChatMessage.findFirst({
      where: { streamId }, orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }).catch(() => null),
  ]);

  let pollState: StandsState["poll"] = null;
  let voteRevision = "";
  if (poll) {
    const options = Array.isArray(poll.options) ? (poll.options as unknown[]).map((o) => String(o)) : [];
    const votes = await prisma.specPollVote.findMany({
      where: { pollId: poll.id },
      select: { optionIndex: true, userId: true },
    }).catch(() => []);
    const counts = options.map(() => 0);
    let myVote: number | null = null;
    for (const v of votes) {
      if (v.optionIndex >= 0 && v.optionIndex < counts.length) counts[v.optionIndex]++;
      if (v.userId === session.user.id) myVote = v.optionIndex;
    }
    voteRevision = votes
      .map((vote) => `${vote.userId}:${vote.optionIndex}`)
      .sort()
      .join(",");
    pollState = { id: poll.id, question: poll.question, options, counts, totalVotes: votes.length, myVote, status: poll.status };
  }

  const revision = [
    stream.status,
    latestChat?.id ?? "no-chat",
    poll?.id ?? "no-poll",
    voteRevision,
    // O heartbeat altera lastSeenAt, mas não altera o que aparece na tela. A
    // revisão acompanha apenas entrada/saída/nome para não reenviar 50 mensagens
    // de chat a cada heartbeat de cada espectador.
    ...spectators.map((spectator) => `${spectator.userId}:${spectator.displayName}`),
  ].join("|");
  if (knownRevision === revision) return { unchanged: true, revision };

  const chat = await prisma.specChatMessage.findMany({
    where: { streamId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, userId: true, userName: true, message: true, createdAt: true },
  }).catch(() => []);

  return {
    spectators: spectators.map((s) => ({ userId: s.userId, name: s.displayName })),
    count: spectators.length,
    canManage,
    chat: chat.reverse(),
    poll: pollState,
    unchanged: false,
    revision,
  };
}

/** Chat leve da transmissão, compartilhado por P2P, YouTube e Cloudflare. */
export async function sendSpecChatMessageAction(streamId: string, rawMessage: string): Promise<{ ok: boolean; error?: string; retryAfter?: number }> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Não autenticado." };
  const stream = await loadStreamOwner(streamId);
  if (!stream || (stream.status !== "LIVE" && stream.status !== "PREPARING")) return { ok: false, error: "Transmissão encerrada." };
  const message = rawMessage.trim().replace(/\s+/g, " ").slice(0, 300);
  if (!message) return { ok: false, error: "Digite uma mensagem." };
  const lastMessage = await prisma.specChatMessage.findFirst({
    where: { streamId, userId: session.user.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true },
  }).catch(() => null);
  if (lastMessage) {
    const remainingMs = 10_000 - (Date.now() - lastMessage.createdAt.getTime());
    if (remainingMs > 0) {
      const retryAfter = Math.ceil(remainingMs / 1000);
      return { ok: false, error: `Modo lento: aguarde ${retryAfter}s.`, retryAfter };
    }
  }
  try {
    await prisma.specChatMessage.create({ data: { streamId, userId: session.user.id, userName: session.user.name?.trim() || "Jogador", message } });
    return { ok: true };
  } catch (error) {
    console.error("[spec-chat] falha ao enviar mensagem", error);
    return { ok: false, error: "Não foi possível enviar agora. Tente novamente." };
  }
}

/** Cria uma enquete (dono da transmissão, GameMaster ou Admin). Uma ativa por vez. */
export async function createSpecPollAction(
  streamId: string, question: string, options: string[],
): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Não autenticado." };
  const stream = await loadStreamOwner(streamId);
  if (!stream) return { ok: false, error: "Transmissão não encontrada." };
  const canManage = stream.broadcasterUserId === session.user.id || isStaff(session.user.role);
  if (!canManage) return { ok: false, error: "Sem permissão para criar enquetes." };

  const q = question.trim();
  const opts = options.map((o) => o.trim()).filter(Boolean).slice(0, 6);
  if (q.length < 3) return { ok: false, error: "Pergunta muito curta." };
  if (opts.length < 2) return { ok: false, error: "Informe ao menos 2 opções." };

  // Uma enquete ativa por transmissão: fecha as anteriores.
  await prisma.specPoll.updateMany({
    where: { streamId, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date() },
  }).catch(() => null);

  await prisma.specPoll.create({
    data: { streamId, question: q, options: opts, createdByUserId: session.user.id },
  });
  return { ok: true };
}

/** Vota numa enquete (qualquer espectador autenticado; 1 voto, pode trocar). */
export async function voteSpecPollAction(pollId: string, optionIndex: number): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Não autenticado." };
  const poll = await prisma.specPoll.findUnique({
    where: { id: pollId },
    select: { status: true, options: true },
  }).catch(() => null);
  if (!poll || poll.status !== "OPEN") return { ok: false, error: "Enquete encerrada." };
  const optionCount = Array.isArray(poll.options) ? poll.options.length : 0;
  if (optionIndex < 0 || optionIndex >= optionCount) return { ok: false, error: "Opção inválida." };

  await prisma.specPollVote.upsert({
    where: { pollId_userId: { pollId, userId: session.user.id } },
    create: { pollId, userId: session.user.id, optionIndex },
    update: { optionIndex },
  }).catch(() => null);
  return { ok: true };
}

/** Encerra uma enquete (dono da transmissão, GameMaster ou Admin). */
export async function closeSpecPollAction(pollId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getAppSession();
  if (!session?.user?.id) return { ok: false, error: "Não autenticado." };
  const poll = await prisma.specPoll.findUnique({
    where: { id: pollId },
    select: { streamId: true },
  }).catch(() => null);
  if (!poll) return { ok: false, error: "Enquete não encontrada." };
  const stream = await loadStreamOwner(poll.streamId);
  const canManage = stream?.broadcasterUserId === session.user.id || isStaff(session.user.role);
  if (!canManage) return { ok: false, error: "Sem permissão." };

  await prisma.specPoll.update({ where: { id: pollId }, data: { status: "CLOSED", closedAt: new Date() } }).catch(() => null);
  return { ok: true };
}
