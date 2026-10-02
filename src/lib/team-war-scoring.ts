/**
 * Guerra de Times com equipes de tamanhos diferentes (só semanas com
 * bonusRule.teamScoring === "PARTICIPATION_RATE"; os demais modos não usam isto).
 * Aproveitamento = vitórias / participações; desempate = prêmios defendidos / participações.
 */
export const PARTICIPATION_RATE = "PARTICIPATION_RATE";

export type TeamWarPlayerStat = { playerId: string; wins: number; defendedPrizes: number; matchesPlayed: number };
export type TeamWarAssignment = { playerId: string; teamName: string };
export type TeamWarTeam = { teamName: string; playerIds: string[]; wins: number; participations: number; prizes: number; winRate: number; prizeRate: number };

export function isParticipationRateWeek(mode: string, bonusRule: unknown) {
  const rule = bonusRule && typeof bonusRule === "object" && !Array.isArray(bonusRule) ? (bonusRule as Record<string, unknown>) : null;
  return mode === "GUERRA_DE_TIMES" && rule?.teamScoring === PARTICIPATION_RATE;
}

export function resolveTeamWar(assignments: TeamWarAssignment[], stats: TeamWarPlayerStat[]) {
  const byPlayer = new Map(stats.map((s) => [s.playerId, s]));
  const teams = new Map<string, TeamWarTeam>();
  for (const a of assignments) {
    const t = teams.get(a.teamName) ?? { teamName: a.teamName, playerIds: [], wins: 0, participations: 0, prizes: 0, winRate: 0, prizeRate: 0 };
    const s = byPlayer.get(a.playerId);
    t.playerIds.push(a.playerId);
    if (s) { t.wins += s.wins; t.participations += s.matchesPlayed; t.prizes += s.defendedPrizes; }
    teams.set(a.teamName, t);
  }
  const ranked = [...teams.values()].map((t) => ({
    ...t,
    winRate: t.participations ? t.wins / t.participations : 0,
    prizeRate: t.participations ? t.prizes / t.participations : 0,
  }));
  const eps = 1e-9;
  ranked.sort((a, b) => b.winRate - a.winRate || b.prizeRate - a.prizeRate || a.teamName.localeCompare(b.teamName, "pt-BR"));
  const tied = ranked.length > 1 && Math.abs(ranked[0].winRate - ranked[1].winRate) < eps && Math.abs(ranked[0].prizeRate - ranked[1].prizeRate) < eps;
  // Empate total: todas as equipes empatadas no topo recebem o bônus.
  const winners = tied
    ? ranked.filter((t) => Math.abs(t.winRate - ranked[0].winRate) < eps && Math.abs(t.prizeRate - ranked[0].prizeRate) < eps)
    : ranked.slice(0, 1);
  return { ranked, tied, winners };
}
