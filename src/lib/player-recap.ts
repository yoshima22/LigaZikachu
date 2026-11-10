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
  "buffsApplied", "debuffsApplied",
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

/**
 * Buffs/debuffs pelo TEXTO do replay (o motor não conta isso: o efeito só existe
 * como frase em `effect`). Mesmos critérios do backfill em SQL — mexeu aqui, mexa lá.
 * debuff = "Oportunista reduziu" | "Travessura de"
 * buff   = "Encorajador: +" | "Batedor: +" | "Leal …(+5%)"  (um por golpe em que o bônus esteve ativo)
 */
export function countEffectText(effect: unknown) {
  if (typeof effect !== "string" || !effect) return { buffs: 0, debuffs: 0 };
  const has = (s: string) => effect.includes(s);
  return {
    debuffs: Number(has("Oportunista reduziu")) + Number(has("Travessura de")),
    buffs: Number(has("Encorajador: +")) + Number(has("Batedor: +")) + Number(has("Leal") && has("(+5%)")),
  };
}

/** Buffs/debuffs aplicados por um jogador (atacante) num log de combate. */
export function countLogEffects(log: unknown, playerId: string) {
  let buffs = 0, debuffs = 0;
  if (!Array.isArray(log)) return { buffs, debuffs };
  for (const raw of log) {
    const e = raw as { actorOwnerId?: string | null; effect?: unknown };
    if (e?.actorOwnerId !== playerId) continue;
    const c = countEffectText(e.effect);
    buffs += c.buffs; debuffs += c.debuffs;
  }
  return { buffs, debuffs };
}

/** Buffs/debuffs de cada jogador numa liga encerrada (lê os replays da liga, 1x por edição). */
export async function leagueEffectCounts(kind: "weekly" | "rush", leagueId: string) {
  const matches = kind === "weekly"
    ? await prisma.weeklyMascotLeagueMatch.findMany({ where: { leagueId, replayJson: { not: null as never } }, select: { playerAId: true, playerBId: true, replayJson: true } })
    : await prisma.rushLeagueMatch.findMany({ where: { leagueId, replayJson: { not: null as never } }, select: { playerAId: true, playerBId: true, replayJson: true } });
  const out = new Map<string, { buffs: number; debuffs: number }>();
  for (const m of matches) {
    for (const pid of [m.playerAId, m.playerBId]) {
      if (!pid) continue;
      const c = countLogEffects(m.replayJson, pid);
      const cur = out.get(pid) ?? { buffs: 0, debuffs: 0 };
      out.set(pid, { buffs: cur.buffs + c.buffs, debuffs: cur.debuffs + c.debuffs });
    }
  }
  return out;
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
