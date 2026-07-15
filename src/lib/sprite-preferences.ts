import { MEGA_FORM_IDS } from "@/lib/mega-evolution";
import { getShinySprite, getSpriteUrl } from "@/lib/mascot-data";

export type SpritePreference = "ANIMATED" | "STATIC";

export type PlayerSpritePreferences = {
  mascotSpritePreference?: string | null;
  megaSpritePreference?: string | null;
};

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
