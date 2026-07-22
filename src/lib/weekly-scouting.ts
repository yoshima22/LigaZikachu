import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";

type UsageMascot = { pokemonId: number; name: string; uses: number };
type RecentMatch = { id: string; weekKey: string; opponentId: string | null; result: "W" | "L" | "D"; damage: number; resolvedAt: string | null };
type UsageMap = Record<string, number>;
type MascotUsageMap = Record<string, UsageMascot>;

function jsonRecord<T>(value: Prisma.JsonValue | null | undefined): Record<string, T> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, T> : {};
}

function jsonArray<T>(value: Prisma.JsonValue | null | undefined): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export async function getWeeklyScoutingAnalysis(playerId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`weekly-scouting:${playerId}`}))`;
    const current = await tx.weeklyMascotScoutingAggregate.findUnique({ where: { playerId } });
    const cursor = current?.lastProcessedAt;
    const cursorId = current?.lastProcessedMatchId;
    const newMatches = await tx.weeklyMascotLeagueMatch.findMany({
      where: {
        status: "RESOLVED",
        resolvedAt: { not: null },
        OR: [{ playerAId: playerId }, { playerBId: playerId }],
        ...(cursor ? {
          AND: [{ OR: [
            { resolvedAt: { gt: cursor } },
            { resolvedAt: cursor, ...(cursorId ? { id: { gt: cursorId } } : {}) },
          ] }],
        } : {}),
      },
      select: {
        id: true, playerAId: true, playerBId: true, winnerId: true, isDraw: true,
        playerADamageDealt: true, playerBDamageDealt: true, resolvedAt: true,
        replayJson: true, league: { select: { weekKey: true } },
      },
      orderBy: [{ resolvedAt: "asc" }, { id: "asc" }],
    });

    let matches = current?.matches ?? 0;
    let wins = current?.wins ?? 0;
    let losses = current?.losses ?? 0;
    let draws = current?.draws ?? 0;
    let damageDealt = current?.damageDealt ?? 0n;
    const mascotUsage = jsonRecord<UsageMascot>(current?.mascotUsage);
    const typeUsage = jsonRecord<number>(current?.typeUsage);
    const roleUsage = jsonRecord<number>(current?.roleUsage);
    const recentMatches = jsonArray<RecentMatch>(current?.recentMatches);

    for (const match of newMatches) {
      matches++;
      if (match.isDraw) draws++;
      else if (match.winnerId === playerId) wins++;
      else losses++;
      const damage = match.playerAId === playerId ? match.playerADamageDealt : match.playerBDamageDealt;
      damageDealt += BigInt(damage);
      const seenMascots = new Set<string>();
      const seenRoles = new Set<string>();
      for (const turn of Array.isArray(match.replayJson) ? match.replayJson as Record<string, unknown>[] : []) {
        for (const side of ["actor", "target"] as const) {
          if (turn[`${side}OwnerId`] !== playerId || !turn[`${side}Id`]) continue;
          const mascotId = String(turn[`${side}Id`]);
          if (!seenMascots.has(mascotId)) {
            seenMascots.add(mascotId);
            const pokemonId = Number(turn[`${side}PokemonId`] ?? 0);
            const entry = mascotUsage[mascotId] ?? { pokemonId, name: String(turn[`${side}Name`] ?? getPokemonName(pokemonId)), uses: 0 };
            entry.uses++;
            mascotUsage[mascotId] = entry;
            for (const type of getPokemonTypes(pokemonId)) typeUsage[type] = (typeUsage[type] ?? 0) + 1;
          }
          const role = String(turn[`${side}Role`] ?? "Atacante");
          const roleKey = `${mascotId}:${role}`;
          if (!seenRoles.has(roleKey)) {
            seenRoles.add(roleKey);
            roleUsage[role] = (roleUsage[role] ?? 0) + 1;
          }
        }
      }
      recentMatches.push({
        id: match.id,
        weekKey: match.league.weekKey,
        opponentId: match.playerAId === playerId ? match.playerBId : match.playerAId,
        result: match.isDraw ? "D" : match.winnerId === playerId ? "W" : "L",
        damage,
        resolvedAt: match.resolvedAt?.toISOString() ?? null,
      });
    }

    const latest = newMatches.at(-1);
    const compactRecent = recentMatches
      .sort((a, b) => String(b.resolvedAt).localeCompare(String(a.resolvedAt)) || b.id.localeCompare(a.id))
      .slice(0, 5);
    const stored = await tx.weeklyMascotScoutingAggregate.upsert({
      where: { playerId },
      create: {
        playerId, matches, wins, losses, draws, damageDealt,
        mascotUsage, typeUsage, roleUsage, recentMatches: compactRecent,
        lastProcessedAt: latest?.resolvedAt ?? null,
        lastProcessedMatchId: latest?.id ?? null,
      },
      update: {
        matches, wins, losses, draws, damageDealt,
        mascotUsage, typeUsage, roleUsage, recentMatches: compactRecent,
        ...(latest ? { lastProcessedAt: latest.resolvedAt, lastProcessedMatchId: latest.id } : {}),
      },
    });
    const player = await tx.player.findUnique({ where: { id: playerId }, select: { displayName: true } });
    const opponentIds = compactRecent.map((entry) => entry.opponentId).filter(Boolean) as string[];
    const opponents = opponentIds.length ? await tx.player.findMany({ where: { id: { in: opponentIds } }, select: { id: true, displayName: true } }) : [];
    const names = new Map(opponents.map((entry) => [entry.id, entry.displayName]));
    const sorted = (map: UsageMap) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count }));
    return {
      playerId,
      playerName: player?.displayName ?? "Jogador",
      matches: stored.matches, wins: stored.wins, losses: stored.losses, draws: stored.draws,
      score: stored.wins * 3 + stored.draws,
      winRate: stored.matches ? Math.round((stored.wins / stored.matches) * 100) : 0,
      averageDamage: stored.matches ? Math.round(Number(stored.damageDealt) / stored.matches) : 0,
      topMascots: Object.values(mascotUsage).sort((a, b) => b.uses - a.uses).slice(0, 6),
      typePreferences: sorted(typeUsage),
      rolePreferences: sorted(roleUsage),
      recentMatches: compactRecent.map((entry) => ({
        ...entry,
        opponentName: entry.opponentId ? names.get(entry.opponentId) ?? "Jogador" : "BYE",
      })),
    };
  }, { timeout: 20_000 });
}
