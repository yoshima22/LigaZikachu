import { EXTRA_FORM_BASE_ALL } from "@/lib/form-variants-data";
import { MEGA_FORM_IDS, MEGA_STONES_OFFICIAL } from "@/lib/mega-evolution";

export type PokedexLink = { url: string | null; note: string | null };

/** Link da Pokédex oficial. Formas e megas abrem a página da espécie base. */
export function getPokedexLink(pokemonId: number): PokedexLink {
  const baseId = pokemonId <= 1025 ? pokemonId : EXTRA_FORM_BASE_ALL[pokemonId];
  if (!baseId || baseId > 1025) return { url: null, note: "Forma exclusiva do jogo: não existe na Pokédex oficial." };
  const url = `https://www.pokemon.com/br/pokedex/${baseId}`;
  if (pokemonId <= 1025) return { url, note: null };
  if (MEGA_FORM_IDS.has(pokemonId) && !MEGA_STONES_OFFICIAL.some((s) => s.megaPokemonId === pokemonId)) {
    return { url, note: "Mega exclusiva do jogo: abre a página da espécie base." };
  }
  return { url, note: "Forma alternativa: abre a página da espécie base, onde as formas aparecem." };
}
