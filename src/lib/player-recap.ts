import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** Colunas somáveis de `player_recap_counters` (as de marca de ZC ficam fora). */
export const RECAP_COUNTERS = [
  "weeklyLeagues", "weeklyWins", "weeklyLosses", "weeklyDraws", "weeklyDamageDealt", "weeklyDamageTaken",
  "rushLeagues", "rushWins", "rushLosses", "rushDraws", "rushDamageDealt", "rushDamageTaken",
  "arenaPveBattles", "arenaPvpAttacks", "arenaPvpDefenses", "arenaDamageDealt", "arenaDamageTaken",
  "eggsHatched", "mascotsRecycled", "proteinsUsed",
  "feathersUsed", "feathersCommon", "feathersRare", "feathersSpecial", "feathersLab", "feathersEvent",
] as const;
export type RecapCounter = (typeof RECAP_COUNTERS)[number];
export type RecapDelta = Partial<Record<RecapCounter, number>>;

/** Ano civil em Brasília (UTC-3), o mesmo fuso das ligas. */
export function recapYear(date = new Date()) {
  return new Date(date.getTime() - 3 * 3_600_000).getUTCFullYear();
}

/**
 * Soma `delta` nos contadores do jogador no ano corrente. Só increments
 * atômicos (nunca read-modify-write). Chame DEPOIS do commit da operação e
 * nunca de dentro de `$transaction`: um erro aqui abortaria a transação do jogo.
 * Falha vira log, não erro — o recap é métrica, não regra de negócio.
 */
export async function bumpRecap(playerId: string | null | undefined, delta: RecapDelta, db: Db = prisma, date?: Date) {
  if (!playerId) return;
  const update: Record<string, { increment: number }> = {};
  const create: Record<string, number> = {};
  for (const key of RECAP_COUNTERS) {
    const value = Math.round(delta[key] ?? 0);
    if (!value) continue;
    update[key] = { increment: value };
    create[key] = value;
  }
  if (!Object.keys(update).length) return;
  const year = recapYear(date);
  try {
    await db.playerRecapCounter.upsert({ where: { playerId_year: { playerId, year } }, create: { playerId, year, ...create }, update });
  } catch (error) {
    console.error("[player-recap] falha ao somar contador", playerId, error);
  }
}

/** Dano causado/recebido por um jogador num log de combate (Arena Z e ligas). */
export function sumLogDamage(log: unknown, playerId: string) {
  let dealt = 0, taken = 0;
  if (!Array.isArray(log)) return { dealt, taken };
  for (const raw of log) {
    const e = raw as { action?: string; damage?: number; actorOwnerId?: string | null; targetOwnerId?: string | null };
    if (e?.action !== "ATTACK" || !e.damage) continue;
    if (e.actorOwnerId === playerId) dealt += e.damage;
    if (e.targetOwnerId === playerId) taken += e.damage;
  }
  return { dealt, taken };
}
