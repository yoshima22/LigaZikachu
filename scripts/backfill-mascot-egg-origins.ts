import { EggType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const MAX_TIME_DIFFERENCE_MS = 60_000;
const VALID_EGG_TYPES = new Set(Object.values(EggType));

async function main() {
  const [mascots, discoveries] = await Promise.all([
    prisma.mascot.findMany({
      where: { hatchedFromEggType: null },
      select: { id: true, playerId: true, pokemonId: true, hatchedAt: true },
    }),
    prisma.playerPokemonDex.findMany({
      where: { source: { startsWith: "egg:" } },
      select: { playerId: true, pokemonId: true, firstObtainedAt: true, source: true },
    }),
  ]);

  const discoveriesByPlayer = new Map<string, typeof discoveries>();
  for (const discovery of discoveries) {
    const list = discoveriesByPlayer.get(discovery.playerId) ?? [];
    list.push(discovery);
    discoveriesByPlayer.set(discovery.playerId, list);
  }

  const confirmed = mascots.flatMap((mascot) => {
    const matches = (discoveriesByPlayer.get(mascot.playerId) ?? []).filter((discovery) =>
      Math.abs(discovery.firstObtainedAt.getTime() - mascot.hatchedAt.getTime()) <= MAX_TIME_DIFFERENCE_MS,
    );
    if (matches.length !== 1) return [];

    const eggType = matches[0].source?.slice("egg:".length) as EggType | undefined;
    if (!eggType || !VALID_EGG_TYPES.has(eggType)) return [];

    return [{
      mascotId: mascot.id,
      eggType,
      timeDifferenceMs: Math.abs(matches[0].firstObtainedAt.getTime() - mascot.hatchedAt.getTime()),
      evolvedSinceHatching: matches[0].pokemonId !== mascot.pokemonId,
      samePokemon: matches[0].pokemonId === mascot.pokemonId,
    }];
  });

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    unknownMascots: mascots.length,
    confirmed: confirmed.length,
    evolvedSinceHatching: confirmed.filter((item) => item.evolvedSinceHatching).length,
    maxTimeDifferenceMs: Math.max(0, ...confirmed.map((item) => item.timeDifferenceMs)),
    overFiveSeconds: confirmed.filter((item) => item.timeDifferenceMs > 5_000).length,
    timeOutliers: confirmed
      .filter((item) => item.timeDifferenceMs > 5_000)
      .map((item) => ({
        mascotId: item.mascotId,
        eggType: item.eggType,
        timeDifferenceMs: item.timeDifferenceMs,
        samePokemon: item.samePokemon,
      })),
  };

  if (APPLY) {
    const batchSize = 100;
    for (let index = 0; index < confirmed.length; index += batchSize) {
      const batch = confirmed.slice(index, index + batchSize);
      await prisma.$transaction(
        batch.map((item) => prisma.mascot.updateMany({
          where: { id: item.mascotId, hatchedFromEggType: null },
          data: { hatchedFromEggType: item.eggType },
        })),
      );
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
