/** Catálogo puro (seguro para componentes client) dos mascotes exclusivos da Torre. */
export const TOWER_EXCLUSIVE_MASCOTS = [
  { code: "TORRE-PIKACHUQUE", pokemonId: 210001, basePokemonId: 25, name: "Barão Pikachuque", primaryType: "electric", sprite: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/CustomPokemonSprites/01_pikachu_rebelde.png" },
  { code: "TORRE-LUCARDIO", pokemonId: 210002, basePokemonId: 448, name: "Sir Lucardio", primaryType: "fighting", secondaryType: "steel", sprite: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/CustomPokemonSprites/02_lucario_rebelde.png" },
  { code: "TORRE-UMBRELORD", pokemonId: 210003, basePokemonId: 197, name: "Umbrelord", primaryType: "dark", sprite: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/CustomPokemonSprites/03_umbreon_rebelde.png" },
  { code: "TORRE-GENGARTOLA", pokemonId: 210004, basePokemonId: 94, name: "Gengartola", primaryType: "ghost", secondaryType: "poison", sprite: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/CustomPokemonSprites/04_gengar_rebelde.png" },
  { code: "TORRE-TRAPINHO", pokemonId: 210005, basePokemonId: 778, name: "Quase Barão Trapinho", primaryType: "ghost", secondaryType: "fairy", sprite: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/CustomPokemonSprites/05_mimikyu_rebelde.png" },
  { code: "TORRE-DOM-MIANO", pokemonId: 210006, basePokemonId: 52, name: "Dom Miano", primaryType: "normal", sprite: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/CustomPokemonSprites/06_meowth_rebelde.png" },
  { code: "TORRE-MADAME-ESPEA", pokemonId: 210007, basePokemonId: 196, name: "Madame Espeã", primaryType: "psychic", sprite: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/CustomPokemonSprites/07_espeon_rebelde.png" },
  { code: "TORRE-XANDINHO", pokemonId: 210008, basePokemonId: 609, name: "Xandinho Guia", primaryType: "ghost", secondaryType: "fire", sprite: "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/CustomPokemonSprites/TorreDosRebeldesChandelure.png" },
] as const;

export function getTowerExclusiveMascot(pokemonId: number) {
  return TOWER_EXCLUSIVE_MASCOTS.find((entry) => entry.pokemonId === pokemonId);
}
