import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export async function getSpeciesSnapshot(pokemonId: number, db: Db = prisma) {
  const species = await db.pokemonSpeciesDefinition.findUnique({ where: { pokemonId } });
  if (!species) return {};
  return {
    speciesNameOverride: species.name,
    primaryTypeOverride: species.primaryType,
    secondaryTypeOverride: species.secondaryType,
    staticSpriteUrlOverride: species.staticSpriteUrl,
    animatedSpriteUrlOverride: species.animatedSpriteUrl,
    generationOverride: species.generation,
  };
}

// mascotTypes/mascotPrimaryType agora vivem em @/lib/mascot-data (client-safe,
// sem depender de fallback externo). Use de lá.
