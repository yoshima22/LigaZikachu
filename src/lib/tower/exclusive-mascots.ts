import { prisma } from "@/lib/prisma";
import { TOWER_BOSS_PRIZES, TOWER_EXCLUSIVE_MASCOTS } from "./exclusive-catalog";
export { TOWER_BOSS_PRIZES, TOWER_EXCLUSIVE_MASCOTS, getTowerExclusiveMascot } from "./exclusive-catalog";

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
  // Ordem narrativa oficial: contratos, identidade, vigilância, Psicose,
  // disciplina, possibilidades e o confronto com o Barão.
  const order = [210006, 210005, 210003, 210004, 210002, 210007, 210001];
  return TOWER_EXCLUSIVE_MASCOTS.find((entry) => entry.pokemonId === order[Math.max(0, Math.min(6, floor - 1))])!;
}


export const XANDINHO = TOWER_EXCLUSIVE_MASCOTS[7];
