import { prisma } from "@/lib/prisma";
import { MatchStatus, type Prisma } from "@prisma/client";

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
}

interface RankingScope {
  weekId?: string;
  playedFrom?: Date;
  playedTo?: Date;
  topOfDayOnly?: boolean;
  onlyPlayersWithMatches?: boolean;
}

type RankingStats = Omit<PlayerRankingEntry, "position" | "displayName">;

export async function computeSeasonRanking(seasonId: string): Promise<PlayerRankingEntry[]> {
  return computeRanking(seasonId);
}

export async function computePlayerRanking(seasonId: string): Promise<PlayerRankingEntry[]> {
  return computeSeasonRanking(seasonId);
}

export async function computeWeeklyRanking(
  seasonId: string,
  weekId: string
): Promise<PlayerRankingEntry[]> {
  return computeRanking(seasonId, { weekId, onlyPlayersWithMatches: true });
}

export async function computeTopOfDayRanking(
  seasonId: string,
  date: Date = new Date()
): Promise<PlayerRankingEntry[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return computeRanking(seasonId, {
    playedFrom: start,
    playedTo: end,
    topOfDayOnly: true,
    onlyPlayersWithMatches: true
  });
}

async function computeRanking(
  seasonId: string,
  scope: RankingScope = {}
): Promise<PlayerRankingEntry[]> {
  const matchWhere: Prisma.MatchWhereInput = {
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
  };

  const [matches, seasonPlayers] = await Promise.all([
    prisma.match.findMany({
      where: matchWhere,
      select: {
        playerAId: true,
        playerBId: true,
        isBye: true,
        playerAWins: true,
        playerBWins: true,
        winnerPlayerId: true,
        loserPlayerId: true,
        draws: true,
        rankingPointsA: true,
        rankingPointsB: true
      }
    }),
    prisma.seasonPlayer.findMany({
      where: { seasonId, isActive: true },
      include: { player: { select: { id: true, displayName: true } } }
    })
  ]);

  const statsMap = new Map<string, RankingStats>();

  for (const sp of seasonPlayers) {
    statsMap.set(sp.playerId, emptyStats(sp.playerId));
  }

  for (const match of matches) {
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
    winnerStats.points +=
      match.winnerPlayerId === match.playerAId ? pointsA || 3 : pointsB || 3;

    if (loserStats) {
      loserStats.losses += 1;
      loserStats.points +=
        match.loserPlayerId === match.playerAId ? pointsA : pointsB;
    }
  }

  const entries = seasonPlayers
    .map((sp) => {
      const stats = statsMap.get(sp.playerId) ?? emptyStats(sp.playerId);
      return { displayName: sp.player.displayName, ...stats };
    })
    .filter((entry) => !scope.onlyPlayersWithMatches || entry.matchesPlayed > 0);

  entries.sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.gameDiff - a.gameDiff ||
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
    gameDiff: 0
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
