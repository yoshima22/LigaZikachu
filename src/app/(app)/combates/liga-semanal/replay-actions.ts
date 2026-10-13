"use server";

import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPokemonName } from "@/lib/mascot-data";
import { getCombatRoleLabel, normalizeCombatRole } from "@/lib/combat-roles";

export async function getWeeklyReplayAction(matchId: string) {
  if (!(await getAppSession())?.user) throw new Error("Sessão expirada.");
  if (typeof matchId !== "string" || !matchId || matchId.length > 100) throw new Error("Partida inválida.");
  const match = await prisma.weeklyMascotLeagueMatch.findFirst({
    where: { id: matchId, status: "RESOLVED" },
    select: { leagueId: true, battleDate: true, battleSlot: true, playerAId: true, playerBId: true, replayJson: true, resultJson: true },
  });
  if (!match || !Array.isArray(match.replayJson)) throw new Error("Replay indisponível.");
  const result = (match.resultJson ?? {}) as Record<string, any>;
  // Legacy matches have no saved lineup: recover the most recent team at the
  // actual match date, never a later team from the currently displayed day.
  async function lineup(playerId: string | null, saved: unknown) {
    if (Array.isArray(saved)) return saved;
    if (!playerId) return [];
    const team = await prisma.weeklyMascotLeagueDailyTeam.findFirst({
      where: { leagueId: match!.leagueId, playerId, battleSlot: match!.battleSlot, battleDate: { lte: match!.battleDate } },
      orderBy: { battleDate: "desc" }, select: { mascotIdsJson: true, rolesJson: true },
    });
    const ids = Array.isArray(team?.mascotIdsJson) ? team.mascotIdsJson.filter((id): id is string => typeof id === "string") : [];
    const mascots = await prisma.mascot.findMany({ where: { id: { in: ids } }, select: { id: true, pokemonId: true, nickname: true, level: true, statVitality: true } });
    const byId = new Map(mascots.map(m => [m.id, m]));
    const roles = (team?.rolesJson ?? {}) as Record<string, unknown>;
    return ids.flatMap(id => {
      const m = byId.get(id);
      return m ? [{ id, name: m.nickname ?? getPokemonName(m.pokemonId), pokemonId: m.pokemonId, level: m.level, ownerId: playerId,
        role: getCombatRoleLabel(normalizeCombatRole(roles[id])), maxHp: Math.max(10, Math.round(55 + m.level * 6 + m.statVitality * 4)) }] : [];
    });
  }
  const turns = match.replayJson as any[];
  const missingIds = [...new Set(turns.flatMap(t => [t.actorLevel == null ? t.actorId : null, t.targetLevel == null ? t.targetId : null]).filter((id): id is string => typeof id === "string"))];
  const [replayLineupA, replayLineupB, levels] = await Promise.all([
    lineup(match.playerAId, result.lineupA), lineup(match.playerBId, result.lineupB),
    missingIds.length ? prisma.mascot.findMany({ where: { id: { in: missingIds } }, select: { id: true, level: true } }) : [],
  ]);
  const levelById = new Map(levels.map(m => [m.id, m.level]));
  return { replayLineupA, replayLineupB, replayJson: turns.map(t => ({ ...t, actorLevel: t.actorLevel ?? levelById.get(t.actorId), targetLevel: t.targetLevel ?? levelById.get(t.targetId) })) };
}
