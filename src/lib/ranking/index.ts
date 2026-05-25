// TODO (slice 4): expandir com multiplicador de semana, strength-of-schedule, tiebreakers
import { prisma } from "@/lib/prisma";
import { MatchStatus } from "@prisma/client";

export interface PlayerRankingEntry {
  playerId: string;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  position: number;
}

export async function computePlayerRanking(seasonId: string): Promise<PlayerRankingEntry[]> {
  const [matches, seasonPlayers] = await Promise.all([
    prisma.match.findMany({
      where: { seasonId, status: MatchStatus.CONFIRMED, isBye: false },
      select: {
        playerAId: true,
        playerBId: true,
        winnerPlayerId: true,
        loserPlayerId: true,
        draws: true
      }
    }),
    prisma.seasonPlayer.findMany({
      where: { seasonId, isActive: true },
      include: { player: { select: { id: true, displayName: true } } }
    })
  ]);

  const statsMap = new Map<string, { wins: number; losses: number; draws: number; points: number }>();

  for (const sp of seasonPlayers) {
    statsMap.set(sp.playerId, { wins: 0, losses: 0, draws: 0, points: 0 });
  }

  for (const match of matches) {
    const isDraw = !match.winnerPlayerId && match.draws > 0;

    if (isDraw) {
      for (const pid of [match.playerAId, match.playerBId]) {
        if (!pid) continue;
        const s = statsMap.get(pid) ?? { wins: 0, losses: 0, draws: 0, points: 0 };
        s.draws += 1;
        s.points += 1;
        statsMap.set(pid, s);
      }
    } else if (match.winnerPlayerId && match.loserPlayerId) {
      const w = statsMap.get(match.winnerPlayerId) ?? { wins: 0, losses: 0, draws: 0, points: 0 };
      w.wins += 1;
      w.points += 3;
      statsMap.set(match.winnerPlayerId, w);

      const l = statsMap.get(match.loserPlayerId) ?? { wins: 0, losses: 0, draws: 0, points: 0 };
      l.losses += 1;
      statsMap.set(match.loserPlayerId, l);
    }
  }

  const entries: PlayerRankingEntry[] = seasonPlayers.map((sp) => {
    const s = statsMap.get(sp.playerId) ?? { wins: 0, losses: 0, draws: 0, points: 0 };
    return { playerId: sp.playerId, displayName: sp.player.displayName, ...s };
  });

  entries.sort((a, b) => b.points - a.points || b.wins - a.wins);

  return entries.map((entry, i) => ({ ...entry, position: i + 1 }));
}
