"use server";

import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth/permissions";
import { getStaticSpriteUrl, getPokemonTypes } from "@/lib/mascot-data";
import type { ArenaTurnLog } from "@/lib/arena-z";
import type { Combatant, ReplayTurn, ReplayData } from "./_components/replay-canvas";

export type LeagueReplayOption = { id: string; label: string };

type LineupMascot = { id: string; name: string; pokemonId: number; level?: number; ownerId?: string; role?: string; maxHp: number };

/** Jogos recentes da liga semanal que têm replay gravado. */
export async function listLeagueReplays(): Promise<LeagueReplayOption[]> {
  await requirePlatformAdmin();
  const matches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { status: "RESOLVED" },
    orderBy: { resolvedAt: "desc" },
    take: 80,
    select: {
      id: true, roundNumber: true, battleDate: true, battleSlot: true,
      playerAId: true, playerBId: true, winnerId: true,
      league: { select: { weekKey: true } },
    },
  });
  const ids = [...new Set(matches.flatMap((m) => [m.playerAId, m.playerBId].filter(Boolean) as string[]))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name ?? "?"]));
  return matches.map((m) => {
    const a = nameOf.get(m.playerAId) ?? "?";
    const b = m.playerBId ? nameOf.get(m.playerBId) ?? "?" : "BYE";
    return { id: m.id, label: `${m.league.weekKey} · R${m.roundNumber} S${m.battleSlot} · ${a} × ${b}` };
  });
}

/** Normaliza um jogo real (lineups + turnLog) para o formato animado do Lab. */
export async function getLeagueReplay(matchId: string): Promise<ReplayData | null> {
  await requirePlatformAdmin();
  const m = await prisma.weeklyMascotLeagueMatch.findUnique({
    where: { id: matchId },
    select: { resultJson: true, replayJson: true },
  });
  if (!m?.resultJson || !m?.replayJson) return null;
  const res = m.resultJson as { lineupA?: LineupMascot[]; lineupB?: LineupMascot[] };
  const lineupA = res.lineupA ?? [], lineupB = res.lineupB ?? [];
  if (lineupA.length === 0 || lineupB.length === 0) return null;
  const log = m.replayJson as ArenaTurnLog[];

  const toCombatant = (mon: LineupMascot, side: "A" | "B"): Combatant => ({
    id: mon.id, name: mon.name, pokemonId: mon.pokemonId,
    type: getPokemonTypes(mon.pokemonId)[0] ?? "normal",
    sprite: getStaticSpriteUrl(mon.pokemonId),
    maxHp: Math.max(1, mon.maxHp), side,
  });
  const teams: Combatant[] = [
    ...lineupA.map((mon) => toCombatant(mon, "A")),
    ...lineupB.map((mon) => toCombatant(mon, "B")),
  ];

  // HP corrido (cosmético) a partir do dano/cura — garante números e nocautes
  // coerentes mesmo quando targetHpAfter não vem no log.
  const maxById = new Map(teams.map((c) => [c.id, c.maxHp]));
  const hp = new Map(teams.map((c) => [c.id, c.maxHp]));

  const turns: ReplayTurn[] = [];
  for (const e of log) {
    const isHeal = e.action === "HEAL";
    const isSelfish = e.action === "DEFEND";
    const debuffOnly = (e.action === "ABILITY") && e.damage === 0;
    const guardianId = e.guardianIntercept?.mascotId ?? null;
    const victimId = guardianId ?? e.targetId;

    let targetHpAfter = hp.get(victimId) ?? maxById.get(victimId) ?? 1;
    if (isHeal) {
      const max = maxById.get(e.targetId) ?? 1;
      targetHpAfter = Math.min(max, (hp.get(e.targetId) ?? max) + e.damage);
      hp.set(e.targetId, targetHpAfter);
    } else if (!isSelfish && !debuffOnly) {
      const dmg = guardianId ? (e.guardianIntercept?.damage ?? e.damage) : e.damage;
      targetHpAfter = Math.max(0, (hp.get(victimId) ?? maxById.get(victimId) ?? 1) - dmg);
      hp.set(victimId, targetHpAfter);
    }

    turns.push({
      turn: e.turn,
      actorId: e.actorId,
      targetId: e.targetId,
      action: e.action,
      attackerType: e.attackerType,
      damage: e.damage,
      advantageApplied: e.advantageApplied,
      targetHpAfter,
      actorRole: e.actorRole,
      targetRole: e.targetRole,
      effect: e.effect,
      abilityName: isHeal ? "Cura" : isSelfish ? "Defesa" : debuffOnly ? (e.effect ?? "Efeito") : undefined,
      guardianInterceptId: guardianId,
      debuff: debuffOnly,
    });
  }

  return { teams, turns, bgUrl: "/replay-lab/arena.webp" };
}
