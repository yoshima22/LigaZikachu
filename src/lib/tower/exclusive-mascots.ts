import { prisma } from "@/lib/prisma";
import { TOWER_EXCLUSIVE_MASCOTS } from "./exclusive-catalog";
export { TOWER_EXCLUSIVE_MASCOTS, getTowerExclusiveMascot } from "./exclusive-catalog";

export async function ensureTowerExclusiveSpecies() {
  for (const mascot of TOWER_EXCLUSIVE_MASCOTS) {
    await prisma.pokemonSpeciesDefinition.upsert({
      where: { pokemonId: mascot.pokemonId },
      create: { pokemonId: mascot.pokemonId, name: mascot.name, generation: 0, primaryType: mascot.primaryType, secondaryType: "secondaryType" in mascot ? mascot.secondaryType : null, staticSpriteUrl: mascot.sprite, animatedSpriteUrl: mascot.sprite, custom: true, eggEligible: false, rarity: "EVENT" },
      update: { name: mascot.name, primaryType: mascot.primaryType, secondaryType: "secondaryType" in mascot ? mascot.secondaryType : null, staticSpriteUrl: mascot.sprite, animatedSpriteUrl: mascot.sprite, custom: true, eggEligible: false, rarity: "EVENT" },
    });
    await prisma.mascot.updateMany({
      where: { pokemonId: mascot.pokemonId },
      data: { staticSpriteUrlOverride: mascot.sprite, animatedSpriteUrlOverride: mascot.sprite },
    });
  }
}

export function towerRewardForFloor(floor: number) {
  return TOWER_EXCLUSIVE_MASCOTS[Math.max(0, Math.min(6, floor - 1))];
}

export const XANDINHO = TOWER_EXCLUSIVE_MASCOTS[7];
