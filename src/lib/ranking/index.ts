import { prisma } from "@/lib/prisma";
import { ChallengeStatus, MatchStatus, type Prisma } from "@prisma/client";

export interface PlayerRankingEntry {
  playerId: string;
  displayName: string;
  position: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  byeCount: number;
  gameDiff: number;
  defendedPrizes: number;
  gymChallenges: number;
  successfulChallenges: number;
  failedChallenges: number;
  defendedChallenges: number;
  badgesOwned: number;
  badgePoints: number;
}

interface RankingScope {
  weekId?: string;
  playedFrom?: Date;
  playedTo?: Date;
  topOfDayOnly?: boolean;
  onlyPlayersWithMatches?: boolean;
}

type RankingStats = Omit<PlayerRankingEntry, "position" | "displayName">;

interface RankingSeedPlayer {
  playerId: string;
  displayName: string;
}

interface RankingInput {
  matchWhere: Prisma.MatchWhereInput;
  challengeWhere?: Prisma.ChallengeWhereInput;
  badgeWhere?: Prisma.PlayerBadgeWhereInput;
  bonusWeekWhere?: Prisma.TournamentWeekWhereInput;
  seedPlayers?: RankingSeedPlayer[];
  onlyPlayersWithMatches?: boolean;
}

export async function computeGlobalRanking(seasonId?: string): Promise<PlayerRankingEntry[]> {
  if (seasonId) {
    return computeSeasonRanking(seasonId);
  }

  return computeRankingFromMatches({
    matchWhere: {
      status: MatchStatus.CONFIRMED,
      tournamentWeekId: { not: null }
    },
    // Inclui desafios vinculados a partidas OU diretamente a torneios (sem matchId)
    challengeWhere: {
      OR: [
        { match: { tournamentWeekId: { not: null } } },
        { tournamentId: { not: null }, matchId: null }
      ]
    },
    badgeWhere: {},
    bonusWeekWhere: {},
    onlyPlayersWithMatches: true
  });
}

export async function computeSeasonRanking(seasonId: string): Promise<PlayerRankingEntry[]> {
  const [seasonPlayers, tournamentRegistrations] = await Promise.all([
    prisma.seasonPlayer.findMany({
      where: { seasonId, isActive: true, player: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } } },
      include: { player: { select: { id: true, displayName: true } } }
    }),
    prisma.tournamentRegistration.findMany({
      where: {
        status: "APPROVED",
        tournament: { seasonId },
        player: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } }
      },
      include: { player: { select: { id: true, displayName: true } } }
    })
  ]);

  const seedPlayers = new Map<string, RankingSeedPlayer>();
  for (const sp of seasonPlayers) {
    seedPlayers.set(sp.playerId, { playerId: sp.playerId, displayName: sp.player.displayName });
  }
  for (const registration of tournamentRegistrations) {
    seedPlayers.set(registration.playerId, {
      playerId: registration.playerId,
      displayName: registration.player.displayName
    });
  }

  return computeRankingFromMatches({
    matchWhere: {
      status: MatchStatus.CONFIRMED,
      tournamentWeek: { tournament: { seasonId } }
    },
    // Inclui desafios vinculados a partidas da temporada OU diretos ao torneio (sem matchId)
    challengeWhere: {
      OR: [
        { match: { tournamentWeek: { tournament: { seasonId } } } },
        { tournament: { seasonId }, matchId: null }
      ]
    },
    badgeWhere: {
      badge: { tournament: { seasonId } }
    },
    bonusWeekWhere: {
      tournament: { seasonId }
    },
    seedPlayers: [...seedPlayers.values()]
  });
}

export async function computePlayerRanking(seasonId: string): Promise<PlayerRankingEntry[]> {
  return computeSeasonRanking(seasonId);
}

export async function computeTournamentRanking(
  tournamentId: string
): Promise<PlayerRankingEntry[]> {
  // Busca todas as inscrições aprovadas com role do usuário
  // (filtro JS em vez de Prisma para evitar bugs com nested relation filter)
  const allRegistrations = await prisma.tournamentRegistration.findMany({
    where: { tournamentId, status: "APPROVED" },
    include: {
      player: {
        select: {
          id: true,
          displayName: true,
          user: { select: { role: true } }
        }
      }
    }
  });

  // Filtra admins em JavaScript — mais confiável que nested Prisma filter
  const registrations = allRegistrations.filter(
    (r) => r.player.user?.role !== "ADMIN" && r.player.user?.role !== "SUPER_ADMIN"
  );

  const registeredPlayerIds = registrations.map((r) => r.playerId);

  // Challenges e badges são tratados com queries explícitas abaixo
  // para garantir robustez independente de como os registros foram criados.
  const entries = await computeRankingFromMatches({
    matchWhere: {
      status: MatchStatus.CONFIRMED,
      tournamentWeek: { tournamentId }
    },
    challengeWhere: undefined,        // tratado abaixo de forma explícita
    badgeWhere:     undefined,        // tratado abaixo de forma explícita
    bonusWeekWhere: { tournamentId },
    seedPlayers: registrations.map((r) => ({
      playerId: r.playerId,
      displayName: r.player.displayName
    }))
  });

  // ── Challenges: query direta cobrindo challenges com e sem matchId ─────────
  const [challengesViaMatch, challengesDirect] = await Promise.all([
    // Challenges vinculados a partidas do torneio
    prisma.challenge.findMany({
      where: { match: { tournamentWeek: { tournamentId } } },
      select: { challengerId: true, challengedId: true, status: true,
                challenger: { select: { displayName: true } },
                challenged: { select: { displayName: true } } }
    }),
    // Challenges vinculados diretamente ao torneio (sem matchId)
    prisma.challenge.findMany({
      where: { tournamentId, matchId: null },
      select: { challengerId: true, challengedId: true, status: true,
                challenger: { select: { displayName: true } },
                challenged: { select: { displayName: true } } }
    })
  ]);

  const allChallenges = [...challengesViaMatch, ...challengesDirect];

  if (allChallenges.length > 0) {
    const entryMap = new Map(entries.map((e) => [e.playerId, e]));
    for (const ch of allChallenges) {
      const challenger = entryMap.get(ch.challengerId);
      const challenged = entryMap.get(ch.challengedId);

      if (challenger) {
        challenger.gymChallenges += 1;
        if (ch.status === "ACCEPTED" || ch.status === "RESOLVED") {
          challenger.successfulChallenges += 1;
        }
        if (ch.status === "REJECTED") {
          challenger.failedChallenges += 1;
          challenger.points -= 2;
        }
      }
      if (challenged && ch.status === "REJECTED") {
        challenged.defendedChallenges += 1;
      }
    }
  }

  // ── Badges: query direta por jogador registrado no torneio ────────────────
  // Busca todos os PlayerBadge cujos badges pertencem a este torneio E
  // cujos jogadores estão inscritos. A query usa duas condições OR para
  // cobrir tanto badges criados via UI quanto via seed.
  const playerBadges = await prisma.playerBadge.findMany({
    where: {
      playerId: { in: registeredPlayerIds },
      badge: { tournamentId }
    },
    select: {
      playerId: true,
      player: { select: { displayName: true } }
    }
  });

  // Se a query filtrada por torneio não retornar nada, tenta sem filtro
  // de torneio mas restrita aos jogadores registrados (fallback).
  const badgesToCount = playerBadges.length > 0
    ? playerBadges
    : await prisma.playerBadge.findMany({
        where: { playerId: { in: registeredPlayerIds } },
        select: {
          playerId: true,
          player: { select: { displayName: true } }
        }
      });

  const BADGE_PTS = 3;
  if (badgesToCount.length > 0) {
    const entryMap = new Map(entries.map((e) => [e.playerId, e]));
    for (const pb of badgesToCount) {
      const entry = entryMap.get(pb.playerId);
      if (!entry) continue;
      entry.badgesOwned  += 1;
      entry.badgePoints  += BADGE_PTS;
      entry.points       += BADGE_PTS;
    }
  }

  // ── Conquistas: soma pointsAwarded de conquistas deste torneio ────────────
  const achievementBonuses = await prisma.playerAchievement.findMany({
    where: { achievement: { tournamentId, active: true }, pointsAwarded: { gt: 0 } },
    select: { playerId: true, pointsAwarded: true }
  });
  if (achievementBonuses.length > 0) {
    const bonusMap = new Map<string, number>();
    for (const a of achievementBonuses) {
      bonusMap.set(a.playerId, (bonusMap.get(a.playerId) ?? 0) + (a.pointsAwarded ?? 0));
    }
    for (const entry of entries) {
      const bonus = bonusMap.get(entry.playerId) ?? 0;
      if (bonus > 0) entry.points += bonus;
    }
  }

  // Filtra APENAS os jogadores inscritos aprovados (que já excluem admins via query acima).
  // Isso garante que qualquer entrada criada via matches/challenges de admin seja removida.
  const allowedPlayerIds = new Set(registrations.map(r => r.playerId));
  const finalEntries = entries.filter(e => allowedPlayerIds.has(e.playerId));

  // Re-ordena após todos os bônus
  finalEntries.sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.defendedPrizes - a.defendedPrizes ||
      b.successfulChallenges - a.successfulChallenges ||
      b.defendedChallenges - a.defendedChallenges ||
      a.byeCount - b.byeCount ||
      a.displayName.localeCompare(b.displayName, "pt-BR")
  );
  finalEntries.forEach((e, i) => { e.position = i + 1; });

  return finalEntries;
}

export async function computeWeeklyRanking(
  seasonId: string,
  weekId: string
): Promise<PlayerRankingEntry[]> {
  return computeLegacySeasonScopedRanking(seasonId, { weekId, onlyPlayersWithMatches: true });
}

export async function computeTopOfDayRanking(
  seasonId: string,
  date: Date = new Date()
): Promise<PlayerRankingEntry[]> {
  return computeLegacySeasonScopedRanking(seasonId, {
    ...dayBounds(date),
    topOfDayOnly: true,
    onlyPlayersWithMatches: true
  });
}

/**
 * Top do Dia do torneio — usa fórmula de média por jogo:
 *   avgScore = (wins/jogos × winPts) + (prêmios/jogos)
 *
 * Isso garante que quem venceu 2/2 com média alta supera quem venceu 2/3
 * mesmo com mais prêmios totais.
 */
export async function computeTournamentWeekTopOfDay(
  tournamentWeekId: string
): Promise<PlayerRankingEntry[]> {
  const entries = await computeRankingFromMatches({
    matchWhere: { tournamentWeekId, status: MatchStatus.CONFIRMED },
    challengeWhere: { match: { tournamentWeekId } },
    bonusWeekWhere: { id: tournamentWeekId },
    onlyPlayersWithMatches: true
  });

  const WIN_POINTS = 3;

  // Re-ordena pela fórmula de média: (winRate × winPts) + avgPrizes
  const withAvg = entries.map((e) => ({
    ...e,
    avgScore: e.matchesPlayed > 0
      ? (e.wins / e.matchesPlayed) * WIN_POINTS + e.defendedPrizes / e.matchesPlayed
      : 0
  }));

  withAvg.sort(
    (a, b) =>
      b.avgScore - a.avgScore ||
      b.wins - a.wins ||
      b.defendedPrizes - a.defendedPrizes ||
      a.matchesPlayed - b.matchesPlayed ||     // menos jogos jogados = critério de desempate positivo
      a.displayName.localeCompare(b.displayName, "pt-BR")
  );

  return withAvg.map((e, i) => ({ ...e, position: i + 1 }));
}

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { playedFrom: start, playedTo: end };
}

async function computeLegacySeasonScopedRanking(
  seasonId: string,
  scope: RankingScope = {}
): Promise<PlayerRankingEntry[]> {
  const seasonPlayers = await prisma.seasonPlayer.findMany({
    where: { seasonId, isActive: true },
    include: { player: { select: { id: true, displayName: true } } }
  });

  return computeRankingFromMatches({
    matchWhere: {
    seasonId,
    status: MatchStatus.CONFIRMED,
    ...(scope.weekId ? { weekId: scope.weekId } : {}),
    ...(scope.topOfDayOnly ? { topOfDayEligible: true } : {}),
    ...(scope.playedFrom || scope.playedTo
      ? {
          playedAt: {
            ...(scope.playedFrom ? { gte: scope.playedFrom } : {}),
            ...(scope.playedTo ? { lt: scope.playedTo } : {})
          }
        }
      : {})
    },
    challengeWhere: {
      seasonId,
      ...(scope.weekId ? { weekId: scope.weekId } : {})
    },
    seedPlayers: seasonPlayers.map((sp) => ({
      playerId: sp.playerId,
      displayName: sp.player.displayName
    })),
    onlyPlayersWithMatches: scope.onlyPlayersWithMatches
  });
}

async function computeRankingFromMatches({
  matchWhere,
  challengeWhere,
  badgeWhere,
  bonusWeekWhere,
  seedPlayers = [],
  onlyPlayersWithMatches = false
}: RankingInput): Promise<PlayerRankingEntry[]> {
  const [matches, challenges, badges, bonusWeeks] = await Promise.all([
    prisma.match.findMany({
      where: matchWhere,
      select: {
        playerAId: true,
        playerBId: true,
        isBye: true,
        playerAWins: true,
        playerBWins: true,
        winnerDefendedPrizes: true,
        winnerPlayerId: true,
        loserPlayerId: true,
        draws: true,
        rankingPointsA: true,
        rankingPointsB: true,
        playerA: { select: { displayName: true } },
        playerB: { select: { displayName: true } }
      }
    }),
    // Se challengeWhere for undefined, pula a query (evita buscar TODOS os challenges)
    challengeWhere === undefined
      ? Promise.resolve([])
      : prisma.challenge.findMany({
          where: challengeWhere,
          select: {
            challengerId: true,
            challengedId: true,
            status: true,
            challenger: { select: { displayName: true } },
            challenged: { select: { displayName: true } }
          }
        }),
    badgeWhere === undefined
      ? Promise.resolve([])
      : prisma.playerBadge.findMany({
          where: badgeWhere,
          select: {
            playerId: true,
            player: { select: { displayName: true } }
          }
        }),
    bonusWeekWhere === undefined
      ? Promise.resolve([])
      : prisma.tournamentWeek.findMany({
          where: bonusWeekWhere,
          select: {
            bonusRule: true
          }
        })
  ]);

  const statsMap = new Map<string, RankingStats>();
  const displayNameMap = new Map<string, string>();

  for (const player of seedPlayers) {
    statsMap.set(player.playerId, emptyStats(player.playerId));
    displayNameMap.set(player.playerId, player.displayName);
  }

  for (const match of matches) {
    displayNameMap.set(match.playerAId, match.playerA.displayName);
    if (match.playerBId && match.playerB) {
      displayNameMap.set(match.playerBId, match.playerB.displayName);
    }

    const playerAStats = getStats(statsMap, match.playerAId);
    const playerBStats = match.playerBId ? getStats(statsMap, match.playerBId) : null;
    const pointsA = decimalToNumber(match.rankingPointsA);
    const pointsB = decimalToNumber(match.rankingPointsB);
    const gameDiffA = match.playerAWins - match.playerBWins;
    const gameDiffB = match.playerBWins - match.playerAWins;

    playerAStats.matchesPlayed += 1;
    playerAStats.gameDiff += gameDiffA;

    if (match.isBye || !match.playerBId) {
      playerAStats.wins += 1;
      playerAStats.byeCount += 1;
      playerAStats.points += pointsA || 3;
      continue;
    }

    if (!playerBStats) {
      continue;
    }

    playerBStats.matchesPlayed += 1;
    playerBStats.gameDiff += gameDiffB;

    const isDraw = !match.winnerPlayerId && match.draws > 0;
    if (isDraw) {
      playerAStats.draws += 1;
      playerBStats.draws += 1;
      playerAStats.points += pointsA || 1;
      playerBStats.points += pointsB || 1;
      continue;
    }

    if (!match.winnerPlayerId) {
      continue;
    }

    const winnerStats = getStats(statsMap, match.winnerPlayerId);
    const loserStats = match.loserPlayerId ? getStats(statsMap, match.loserPlayerId) : null;

    winnerStats.wins += 1;
    winnerStats.defendedPrizes += match.winnerDefendedPrizes;
    winnerStats.points +=
      match.winnerPlayerId === match.playerAId ? pointsA || 3 : pointsB || 3;

    if (loserStats) {
      loserStats.losses += 1;
      loserStats.points +=
        match.loserPlayerId === match.playerAId ? pointsA : pointsB;
    }
  }

  for (const challenge of challenges) {
    displayNameMap.set(challenge.challengerId, challenge.challenger.displayName);
    const challengerStats = getStats(statsMap, challenge.challengerId);

    challengerStats.gymChallenges += 1;
    if (challenge.status === ChallengeStatus.ACCEPTED || challenge.status === ChallengeStatus.RESOLVED) {
      challengerStats.successfulChallenges += 1;
    }
    if (challenge.status === ChallengeStatus.REJECTED) {
      challengerStats.failedChallenges += 1;
      challengerStats.points -= 2;

      const defenderStats = getStats(statsMap, challenge.challengedId);
      displayNameMap.set(challenge.challengedId, challenge.challenged.displayName);
      defenderStats.defendedChallenges += 1;
    }
  }

  for (const badge of badges) {
    displayNameMap.set(badge.playerId, badge.player.displayName);
    const badgeStats = getStats(statsMap, badge.playerId);
    badgeStats.badgesOwned += 1;
    badgeStats.badgePoints += 3;
    badgeStats.points += 3;
  }

  for (const week of bonusWeeks) {
    const rule =
      week.bonusRule && typeof week.bonusRule === "object" && !Array.isArray(week.bonusRule)
        ? (week.bonusRule as Record<string, unknown>)
        : null;
    const manualBonuses = Array.isArray(rule?.manualBonuses)
      ? (rule.manualBonuses as Array<Record<string, unknown>>)
      : [];

    for (const bonus of manualBonuses) {
      const playerId = typeof bonus.playerId === "string" ? bonus.playerId : null;
      const points = Number(bonus.points ?? 0);
      if (!playerId || !Number.isFinite(points) || points === 0) continue;

      const bonusStats = getStats(statsMap, playerId);
      bonusStats.points += points;
      if (typeof bonus.playerName === "string") {
        displayNameMap.set(playerId, bonus.playerName);
      }
    }
  }

  const entries = [...statsMap.values()]
    .map((stats) => {
      return {
        displayName: displayNameMap.get(stats.playerId) ?? "Jogador removido",
        ...stats
      };
    })
    .filter((entry) => !onlyPlayersWithMatches || entry.matchesPlayed > 0 || entry.badgesOwned > 0);

  entries.sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.defendedPrizes - a.defendedPrizes ||
      b.successfulChallenges - a.successfulChallenges ||
      b.defendedChallenges - a.defendedChallenges ||
      b.gymChallenges - a.gymChallenges ||
      a.byeCount - b.byeCount ||
      a.displayName.localeCompare(b.displayName, "pt-BR")
  );

  return entries.map((entry, i) => ({ ...entry, position: i + 1 }));
}

function emptyStats(playerId: string): RankingStats {
  return {
    playerId,
    points: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    matchesPlayed: 0,
    byeCount: 0,
    gameDiff: 0,
    defendedPrizes: 0,
    gymChallenges: 0,
    successfulChallenges: 0,
    failedChallenges: 0,
    defendedChallenges: 0,
    badgesOwned: 0,
    badgePoints: 0
  };
}

function getStats(statsMap: Map<string, RankingStats>, playerId: string) {
  const current = statsMap.get(playerId);
  if (current) return current;

  const fallback = emptyStats(playerId);
  statsMap.set(playerId, fallback);
  return fallback;
}

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}
