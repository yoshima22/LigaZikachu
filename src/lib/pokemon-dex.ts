import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaTx = Prisma.TransactionClient | PrismaClient;

type RegisterPokemonDiscoveryInput = {
  playerId: string;
  pokemonId: number;
  source?: string;
  obtainedAt?: Date;
};

export async function registerPokemonDiscovery(
  input: RegisterPokemonDiscoveryInput,
  client: PrismaTx = prisma,
) {
  return client.playerPokemonDex.upsert({
    where: {
      playerId_pokemonId: {
        playerId: input.playerId,
        pokemonId: input.pokemonId,
      },
    },
    create: {
      playerId: input.playerId,
      pokemonId: input.pokemonId,
      source: input.source,
      firstObtainedAt: input.obtainedAt ?? new Date(),
    },
    update: {},
  });
}

/** Repara registros legados a partir das espécies que o jogador possui hoje. */
export async function syncPokemonDexFromOwnedMascots(
  playerId: string,
  client: PrismaTx = prisma,
) {
  const ownedSpecies = await client.mascot.findMany({
    where: { playerId },
    distinct: ["pokemonId"],
    select: { pokemonId: true },
  });
  if (ownedSpecies.length === 0) return 0;

  const result = await client.playerPokemonDex.createMany({
    data: ownedSpecies.map(({ pokemonId }) => ({
      playerId,
      pokemonId,
      source: "owned-mascot-reconciliation",
    })),
    skipDuplicates: true,
  });
  return result.count;
}
