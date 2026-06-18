import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const discoveries = await prisma.mascot.groupBy({
    by: ["playerId", "pokemonId"],
    _min: { hatchedAt: true },
  });

  const result = await prisma.playerPokemonDex.createMany({
    data: discoveries.map((item) => ({
      playerId: item.playerId,
      pokemonId: item.pokemonId,
      firstObtainedAt: item._min.hatchedAt ?? new Date(),
      source: "backfill:existing-mascot",
    })),
    skipDuplicates: true,
  });

  console.log(`PlayerPokemonDex backfill finalizado. Descobertas analisadas: ${discoveries.length}. Criadas: ${result.count}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
