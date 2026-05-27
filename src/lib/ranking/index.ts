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
      OR: [{ weekId: { not: null } }, { tournamentWeekId: { not: null } }]
    },
    challengeWhere: {
      OR: [{ weekId: { not: null } }, { matchId: { not: null } }]
    },
    badgeWhere: {},
    onlyPlayersWithMatches: true
  });
}

export async function computeSeasonRanking(seasonId: string): Promise<PlayerRankingEntry[]> {
  const [seasonPlayers, tournamentRegistrations] = await Promise.all([
    prisma.seasonPlayer.findMany({
      where: { seasonId, isActive: true },
      include: { player: { select: { id: true, displayName: true } } }
    }),
    prisma.tournamentRegistration.findMany({
      where: {
        status: "APPROVED",
        tournament: { seasonId }
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
      OR: [
        { seasonId, weekId: { not: null } },
        { tournamentWeek: { tournament: { seasonId } } }
      ]
    },
    challengeWhere: {
      OR: [
        { seasonId, weekId: { not: null } },
        { match: { tournamentWeek: { tournament: { seasonId } } } }
      ]
    },
    badgeWhere: {
      badge: {
        tournament: {
          seasonId
        }
      }
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
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: "APPROVED"
    },
    include: {
      player: { select: { id: true, displayName: true } }
    }
  });

  return computeRankingFromMatches({
    matchWhere: {
      status: MatchStatus.CONFIRMED,
      tournamentWeek: {
        tournamentId
      }
    },
    challengeWhere: {
      match: {
        tournamentWeek: {
          tournamentId
        }
      }
    },
    badgeWhere: {
      badge: {
        tournamentId
      }
    },
    seedPlayers: registrations.map((registration) => ({
      playerId: registration.playerId,
      displayName: registration.player.displayName
    }))
  });
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

export async function computeTournamentWeekTopOfDay(
  tournamentWeekId: string
): Promise<PlayerRankingEntry[]> {
  return computeRankingFromMatches({
    matchWhere: {
      tournamentWeekId,
      status: MatchStatus.CONFIRMED
    },
    challengeWhere: {
      match: {
        tournamentWeekId
      }
    },
    onlyPlayersWithMatches: true
  });
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
  seedPlayers = [],
  onlyPlayersWithMatches = false
}: RankingInput): Promise<PlayerRankingEntry[]> {
  const [matches, challenges, badges] = await Promise.all([
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
    prisma.challenge.findMany({
      where: challengeWhere ?? {},
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
