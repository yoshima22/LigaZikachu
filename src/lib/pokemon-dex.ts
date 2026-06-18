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
