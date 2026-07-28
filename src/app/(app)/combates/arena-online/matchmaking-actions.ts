"use server";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  canAccessLivePvp,
  getLivePvpAccessConfig,
} from "@/lib/live-pvp-access";

const QUEUE_PREFIX = "live_pvp_queue:";
const MATCH_PREFIX = "live_pvp_match:";
const PLAYER_MATCH_PREFIX = "live_pvp_player_match:";
const ACTIVE_WINDOW_MS = 90_000;

type QueueValue = {
  playerId: string;
  playerName: string;
  targetPlayerId: string | null;
  joinedAt: string;
};

type MatchValue = {
  id: string;
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  coinChooserId: string;
  coinResult: "CARA" | "COROA";
  status: "PREGAME" | "FINISHED";
  createdAt: string;
};

async function requireLivePvpPlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Sessão inválida.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  const config = await getLivePvpAccessConfig();
  if (!canAccessLivePvp(config, player.id, isAdmin(user.role)))
    throw new Error("Arena Online ainda não foi liberada para esta conta.");
  return player;
}

function asQueue(value: Prisma.JsonValue): QueueValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  return typeof data.playerId === "string" &&
    typeof data.playerName === "string"
    ? (data as QueueValue)
    : null;
}

export async function getLivePvpLobbyAction() {
  const player = await requireLivePvpPlayer();
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);
  let [queue, matchIndex] = await Promise.all([
    prisma.appSetting.findMany({
      where: { key: { startsWith: QUEUE_PREFIX }, updatedAt: { gte: cutoff } },
      select: { key: true, value: true },
    }),
    prisma.appSetting.findUnique({
      where: { key: `${PLAYER_MATCH_PREFIX}${player.id}` },
      select: { value: true },
    }),
  ]);
  const ownQueue = queue.find(
    (entry) => entry.key === `${QUEUE_PREFIX}${player.id}`,
  );
  if (ownQueue) {
    await prisma.appSetting.update({
      where: { key: ownQueue.key },
      data: { value: ownQueue.value as Prisma.InputJsonValue },
    });
    queue = queue.map((entry) =>
      entry.key === ownQueue.key ? { ...entry } : entry,
    );
  }
  const index = matchIndex?.value as { matchId?: string } | undefined;
  const match = index?.matchId
    ? await prisma.appSetting.findUnique({
        where: { key: `${MATCH_PREFIX}${index.matchId}` },
        select: { value: true },
      })
    : null;
  return {
    queueCount: queue.length,
    queued: queue.some((entry) => entry.key === `${QUEUE_PREFIX}${player.id}`),
    match: (match?.value as MatchValue | undefined) ?? null,
  };
}

export async function leaveLivePvpQueueAction() {
  const player = await requireLivePvpPlayer();
  await prisma.appSetting.deleteMany({
    where: { key: `${QUEUE_PREFIX}${player.id}` },
  });
  return getLivePvpLobbyAction();
}

export async function closeLivePvpMatchAction() {
  const player = await requireLivePvpPlayer();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const indexRow = await tx.appSetting.findUnique({
      where: { key: `${PLAYER_MATCH_PREFIX}${player.id}` },
      select: { value: true },
    });
    const matchId = (indexRow?.value as { matchId?: string } | undefined)
      ?.matchId;
    if (!matchId) return;
    const matchRow = await tx.appSetting.findUnique({
      where: { key: `${MATCH_PREFIX}${matchId}` },
      select: { value: true },
    });
    const match = matchRow?.value as MatchValue | undefined;
    if (!match || ![match.playerAId, match.playerBId].includes(player.id))
      return;
    await tx.appSetting.deleteMany({
      where: {
        key: {
          in: [
            `${PLAYER_MATCH_PREFIX}${match.playerAId}`,
            `${PLAYER_MATCH_PREFIX}${match.playerBId}`,
            `${MATCH_PREFIX}${matchId}`,
          ],
        },
      },
    });
  });
  return { ok: true };
}

export async function joinLivePvpQueueAction(targetName?: string) {
  const player = await requireLivePvpPlayer();
  const target = targetName?.trim()
    ? await prisma.player.findFirst({
        where: {
          id: { not: player.id },
          active: true,
          user: { status: "ACTIVE" },
          OR: [
            { displayName: { equals: targetName.trim(), mode: "insensitive" } },
            { ptcglNick: { equals: targetName.trim(), mode: "insensitive" } },
          ],
        },
        select: { id: true, displayName: true },
      })
    : null;
  if (targetName?.trim() && !target)
    throw new Error("Jogador não encontrado pelo nome ou nick informado.");
  const config = await getLivePvpAccessConfig();
  if (target && !canAccessLivePvp(config, target.id, false))
    throw new Error("Esse jogador ainda não possui acesso à Arena Online.");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);
    await tx.appSetting.deleteMany({
      where: { key: { startsWith: QUEUE_PREFIX }, updatedAt: { lt: cutoff } },
    });
    const entries = await tx.appSetting.findMany({
      where: { key: { startsWith: QUEUE_PREFIX }, updatedAt: { gte: cutoff } },
      orderBy: { updatedAt: "asc" },
      select: { value: true },
    });
    const opponent = entries
      .map((entry) => asQueue(entry.value))
      .find(
        (entry) =>
          entry &&
          entry.playerId !== player.id &&
          (target
            ? entry.playerId === target.id && entry.targetPlayerId === player.id
            : entry.targetPlayerId === null),
      );
    if (opponent) {
      const id = randomUUID();
      const match: MatchValue = {
        id,
        playerAId: opponent.playerId,
        playerAName: opponent.playerName,
        playerBId: player.id,
        playerBName: player.displayName,
        coinChooserId: Math.random() < 0.5 ? opponent.playerId : player.id,
        coinResult: Math.random() < 0.5 ? "CARA" : "COROA",
        status: "PREGAME",
        createdAt: new Date().toISOString(),
      };
      await Promise.all([
        tx.appSetting.deleteMany({
          where: {
            key: {
              in: [
                `${QUEUE_PREFIX}${player.id}`,
                `${QUEUE_PREFIX}${opponent.playerId}`,
              ],
            },
          },
        }),
        tx.appSetting.create({
          data: {
            key: `${MATCH_PREFIX}${id}`,
            value: match as unknown as Prisma.InputJsonValue,
          },
        }),
        tx.appSetting.upsert({
          where: { key: `${PLAYER_MATCH_PREFIX}${player.id}` },
          create: {
            key: `${PLAYER_MATCH_PREFIX}${player.id}`,
            value: { matchId: id },
          },
          update: { value: { matchId: id } },
        }),
        tx.appSetting.upsert({
          where: { key: `${PLAYER_MATCH_PREFIX}${opponent.playerId}` },
          create: {
            key: `${PLAYER_MATCH_PREFIX}${opponent.playerId}`,
            value: { matchId: id },
          },
          update: { value: { matchId: id } },
        }),
      ]);
      return {
        queueCount: Math.max(0, entries.length - 1),
        queued: false,
        match,
      };
    }
    const value: QueueValue = {
      playerId: player.id,
      playerName: player.displayName,
      targetPlayerId: target?.id ?? null,
      joinedAt: new Date().toISOString(),
    };
    await tx.appSetting.upsert({
      where: { key: `${QUEUE_PREFIX}${player.id}` },
      create: {
        key: `${QUEUE_PREFIX}${player.id}`,
        value: value as unknown as Prisma.InputJsonValue,
      },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    return { queueCount: entries.length + 1, queued: true, match: null };
  });
}
