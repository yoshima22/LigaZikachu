import { redirect } from "next/navigation";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getPokemonName,
  getPokemonTypes,
  getSpriteUrl,
  WISHLIST_POKEMON_IDS,
} from "@/lib/mascot-data";
import {
  ARENA_DRAFT_RULES,
  validateArenaDraftPets,
  type ArenaDraftPet,
} from "@/lib/arena-draft";
import { MEGA_FORM_IDS } from "@/lib/mega-evolution";
import { CUSTOM_MEGA_POKEMON_IDS } from "@/lib/extra-mega-stones";
import { ArenaDraftClient } from "./arena-draft-client";

export const dynamic = "force-dynamic";
export default async function ArenaDraftPage() {
  const session = await getAppSession();
  if (!session?.user) redirect("/login");
  const player = await getSessionPlayer(session.user.id);
  if (!player) redirect("/dashboard");
  const seasonStart = new Date();
  seasonStart.setDate(1);
  seasonStart.setHours(0, 0, 0, 0);
  await prisma.arenaDraftMatch.updateMany({
    where: { state: "CHALLENGE_PENDING", deadlineAt: { lt: new Date() } },
    data: {
      state: "CANCELLED",
      deadlineAt: null,
      stateVersion: { increment: 1 },
    },
  });
  const [presets, activeMatch, history, rankedMatches, disabledMegas] =
    await Promise.all([
      prisma.arenaDraftPreset.findMany({
        where: { ownerId: player.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      prisma.arenaDraftMatch.findFirst({
        where: {
          OR: [{ playerAId: player.id }, { playerBId: player.id }],
          state: { notIn: ["FINISHED", "CANCELLED"] },
        },
        orderBy: { createdAt: "desc" },
        include: {
          playerA: { select: { displayName: true } },
          playerB: { select: { displayName: true } },
        },
      }),
      prisma.arenaDraftMatch.findMany({
        where: {
          OR: [{ playerAId: player.id }, { playerBId: player.id }],
          state: "FINISHED",
          finishedAt: { gte: seasonStart },
        },
        orderBy: { finishedAt: "asc" },
        take: 20,
        include: {
          playerA: { select: { displayName: true } },
          playerB: { select: { displayName: true } },
        },
      }),
      prisma.arenaDraftMatch.findMany({
        where: {
          state: "FINISHED",
          playerBId: { not: null },
          playerA: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } },
          playerB: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } },
        },
        orderBy: { finishedAt: "desc" },
        take: 800,
        select: {
          playerAId: true,
          playerBId: true,
          winnerId: true,
          mode: true,
          playerA: { select: { displayName: true } },
          playerB: { select: { displayName: true } },
        },
      }),
      prisma.eggPokemonToggle.findMany({
        where: {
          pokemonId: { in: CUSTOM_MEGA_POKEMON_IDS },
          disabled: true,
        },
        select: { pokemonId: true },
      }),
    ]);
  const disabledMegaIds = new Set(disabledMegas.map((row) => row.pokemonId));
  const customMegaIds = new Set(CUSTOM_MEGA_POKEMON_IDS);
  const species = Array.from(
    new Set([...WISHLIST_POKEMON_IDS, ...MEGA_FORM_IDS]),
  )
    .filter((id) => !customMegaIds.has(id) || !disabledMegaIds.has(id))
    .map((id) => ({
      id,
      name: getPokemonName(id),
      sprite: getSpriteUrl(id),
      types: getPokemonTypes(id),
      isMega: MEGA_FORM_IDS.has(id),
    }));
  const opponent = activeMatch
    ? ((activeMatch.playerAId === player.id
        ? activeMatch.playerB?.displayName
        : activeMatch.playerA.displayName) ?? null)
    : null;
  // Ranking Elo calculado por modo (partidas de modos diferentes não se
  // misturam no mesmo rating).
  const buildBoard = (
    matches: typeof rankedMatches,
  ) => {
    const ratings = new Map<string, number>();
    for (const match of matches) {
      const ratingA = ratings.get(match.playerAId) ?? 1000;
      const ratingB = ratings.get(match.playerBId!) ?? 1000;
      const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
      const scoreA = !match.winnerId
        ? 0.5
        : match.winnerId === match.playerAId
          ? 1
          : 0;
      ratings.set(
        match.playerAId,
        Math.round(ratingA + 32 * (scoreA - expectedA)),
      );
      ratings.set(
        match.playerBId!,
        Math.round(ratingB + 32 * (1 - scoreA - (1 - expectedA))),
      );
    }
    return Array.from(
      matches
        .reduce<
          Map<
            string,
            {
              playerId: string;
              name: string;
              wins: number;
              losses: number;
              draws: number;
              matches: number;
            }
          >
        >((map, m) => {
          for (const side of [
            { id: m.playerAId, name: m.playerA.displayName },
            { id: m.playerBId!, name: m.playerB!.displayName },
          ]) {
            const row = map.get(side.id) ?? {
              playerId: side.id,
              name: side.name,
              wins: 0,
              losses: 0,
              draws: 0,
              matches: 0,
            };
            row.matches++;
            if (!m.winnerId) row.draws++;
            else if (m.winnerId === side.id) row.wins++;
            else row.losses++;
            map.set(side.id, row);
          }
          return map;
        }, new Map())
        .values(),
    )
      .filter((r) => r.matches >= 1)
      .map((row) => ({
        ...row,
        rating: ratings.get(row.playerId) ?? 1000,
        winRate: Math.round((row.wins / row.matches) * 100),
        provisional: row.matches < ARENA_DRAFT_RULES.minimumRankedMatches,
      }))
      .sort(
        (a, b) =>
          Number(a.provisional) - Number(b.provisional) ||
          b.rating - a.rating ||
          b.wins - a.wins,
      );
  };
  const boards = {
    CUSTOM: buildBoard(rankedMatches.filter((m) => (m.mode ?? "CUSTOM") !== "REAL")),
    REAL: buildBoard(rankedMatches.filter((m) => m.mode === "REAL")),
  };
  return (
    <ArenaDraftClient
      species={species}
      presets={presets.map((p) => {
        const mode = p.source === "REAL" ? "REAL" : "CUSTOM";
        return {
          id: p.id,
          name: p.name,
          source: mode,
          isReady:
            validateArenaDraftPets(p.petsJson, mode).valid &&
            (mode === "REAL" ||
              !(p.petsJson as unknown as ArenaDraftPet[]).some(
                (pet) =>
                  customMegaIds.has(pet.speciesId) &&
                  disabledMegaIds.has(pet.speciesId),
              )),
          pets: p.petsJson as unknown as ArenaDraftPet[],
          needsReview: p.needsReview,
          updatedAt: p.updatedAt.toISOString(),
        };
      })}
      activeMatch={
        activeMatch
          ? {
              id: activeMatch.id,
              state: activeMatch.state,
              opponent,
              createdAt: activeMatch.createdAt.toISOString(),
              incoming:
                activeMatch.state === "CHALLENGE_PENDING" &&
                activeMatch.playerBId === player.id,
            }
          : null
      }
      history={history.map((m) => ({
        id: m.id,
        state: m.state,
        opponent:
          m.playerAId === player.id
            ? (m.playerB?.displayName ?? "—")
            : m.playerA.displayName,
        createdAt: m.createdAt.toISOString(),
        result:
          m.winnerId === player.id
            ? "Vitória"
            : m.winnerId
              ? "Derrota"
              : "Empate",
      }))}
      leaderboards={boards}
      isAdmin={
        session.user.role === "ADMIN" || session.user.role === "SUPER_ADMIN"
      }
    />
  );
}
