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

export function mascotTypes(mascot: { pokemonId: number; primaryTypeOverride?: string | null; secondaryTypeOverride?: string | null }, fallback: (id: number) => string[]) {
  if (mascot.primaryTypeOverride) return [mascot.primaryTypeOverride, mascot.secondaryTypeOverride].filter(Boolean) as string[];
  return fallback(mascot.pokemonId);
}
