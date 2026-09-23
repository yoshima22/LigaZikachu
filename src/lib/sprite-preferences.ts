import { MEGA_FORM_IDS } from "@/lib/mega-evolution";
import { getShinySprite, getSpriteUrl } from "@/lib/mascot-data";

export type SpritePreference = "ANIMATED" | "STATIC";

export type PlayerSpritePreferences = {
  mascotSpritePreference?: string | null;
  megaSpritePreference?: string | null;
};

// Os PNGs HOME são renders 3D; os GIFs antigos de Mega continuam em pixel art.
export function getMascotImageRendering(pokemonId: number, spriteUrl?: string): "auto" | "pixelated" {
  return (pokemonId >= 210001 && pokemonId <= 210008) || (MEGA_FORM_IDS.has(pokemonId) && !spriteUrl?.endsWith(".gif"))
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
