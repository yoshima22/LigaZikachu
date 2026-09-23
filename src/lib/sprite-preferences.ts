import { MEGA_FORM_IDS } from "@/lib/mega-evolution";
import { CUSTOM_MEGA_POKEMON_IDS } from "@/lib/extra-mega-stones";
import { getShinySprite, getSpriteUrl } from "@/lib/mascot-data";

export type SpritePreference = "ANIMATED" | "STATIC";

export type PlayerSpritePreferences = {
  mascotSpritePreference?: string | null;
  megaSpritePreference?: string | null;
};

// As formas Mega novas usam PNGs ilustrados, não sprites em pixel art.
const ILLUSTRATED_MEGA_IDS = new Set([10301, 10302, ...CUSTOM_MEGA_POKEMON_IDS]);

export function getMascotImageRendering(pokemonId: number): "auto" | "pixelated" {
  return (pokemonId >= 210001 && pokemonId <= 210008) || ILLUSTRATED_MEGA_IDS.has(pokemonId)
    ? "auto"
    : "pixelated";
}

function normalizePreference(value?: string | null): SpritePreference {
  return value === "STATIC" ? "STATIC" : "ANIMATED";
}

export function shouldUseAnimatedSprite(
  pokemonId: number,
  preferences?: PlayerSpritePreferences | null,
): boolean {
  const preference = MEGA_FORM_IDS.has(pokemonId)
    ? normalizePreference(preferences?.megaSpritePreference)
    : normalizePreference(preferences?.mascotSpritePreference);

  return preference === "ANIMATED";
}

export function getPreferredSpriteUrl(
  pokemonId: number,
  preferences?: PlayerSpritePreferences | null,
  options?: { shiny?: boolean },
): string {
  const animated = shouldUseAnimatedSprite(pokemonId, preferences);
  return options?.shiny
    ? getShinySprite(pokemonId, animated)
    : getSpriteUrl(pokemonId, animated);
}
