import { prisma } from "@/lib/prisma";

export const TOWER_EXCLUSIVE_MASCOTS = [
  { code: "TORRE-PIKACHUQUE", pokemonId: 210001, basePokemonId: 25, name: "Barão Pikachuque", primaryType: "electric", sprite: "/events/torre-dos-rebeldes/leaders/01_pikachu_rebelde.png" },
  { code: "TORRE-LUCARDIO", pokemonId: 210002, basePokemonId: 448, name: "Sir Lucardio", primaryType: "fighting", secondaryType: "steel", sprite: "/events/torre-dos-rebeldes/leaders/02_lucario_rebelde.png" },
  { code: "TORRE-UMBRELORD", pokemonId: 210003, basePokemonId: 197, name: "Umbrelord", primaryType: "dark", sprite: "/events/torre-dos-rebeldes/leaders/03_umbreon_rebelde.png" },
  { code: "TORRE-GENGARTOLA", pokemonId: 210004, basePokemonId: 94, name: "Gengartola", primaryType: "ghost", secondaryType: "poison", sprite: "/events/torre-dos-rebeldes/leaders/04_gengar_rebelde.png" },
  { code: "TORRE-TRAPINHO", pokemonId: 210005, basePokemonId: 778, name: "Quase Barão Trapinho", primaryType: "ghost", secondaryType: "fairy", sprite: "/events/torre-dos-rebeldes/leaders/05_mimikyu_rebelde.png" },
  { code: "TORRE-DOM-MIANO", pokemonId: 210006, basePokemonId: 52, name: "Dom Miano", primaryType: "normal", sprite: "/events/torre-dos-rebeldes/leaders/06_meowth_rebelde.png" },
  { code: "TORRE-MADAME-ESPEA", pokemonId: 210007, basePokemonId: 196, name: "Madame Espeã", primaryType: "psychic", sprite: "/events/torre-dos-rebeldes/leaders/07_espeon_rebelde.png" },
  { code: "TORRE-XANDINHO", pokemonId: 210008, basePokemonId: 609, name: "Xandinho Guia", primaryType: "ghost", secondaryType: "fire", sprite: "/events/torre-dos-rebeldes/chandelure.png" },
] as const;

export async function ensureTowerExclusiveSpecies() {
  for (const mascot of TOWER_EXCLUSIVE_MASCOTS) {
    await prisma.pokemonSpeciesDefinition.upsert({
      where: { pokemonId: mascot.pokemonId },
      create: { pokemonId: mascot.pokemonId, name: mascot.name, generation: 0, primaryType: mascot.primaryType, secondaryType: "secondaryType" in mascot ? mascot.secondaryType : null, staticSpriteUrl: mascot.sprite, animatedSpriteUrl: mascot.sprite, custom: true, eggEligible: false, rarity: "EVENT" },
      update: { name: mascot.name, primaryType: mascot.primaryType, secondaryType: "secondaryType" in mascot ? mascot.secondaryType : null, staticSpriteUrl: mascot.sprite, animatedSpriteUrl: mascot.sprite, custom: true, eggEligible: false, rarity: "EVENT" },
    });
  }
}

export function towerRewardForFloor(floor: number) {
  return TOWER_EXCLUSIVE_MASCOTS[Math.max(0, Math.min(6, floor - 1))];
}

export const XANDINHO = TOWER_EXCLUSIVE_MASCOTS[7];
