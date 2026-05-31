/**
 * Dados dos tipos de Pokémon TCG — sem dependências React/client.
 * Importável tanto em Server Components quanto em Client Components.
 */

export const POKEMON_TYPE_LABELS: Record<string, string> = {
  Grass:      "Grama",
  Fire:       "Fogo",
  Water:      "Água",
  Lightning:  "Elétrico",
  Fighting:   "Lutador",
  Psychic:    "Psíquico",
  Colorless:  "Incolor",
  Darkness:   "Noturno",
  Metal:      "Metálico",
  Dragon:     "Dragão",
  Fairy:      "Fada"
};

export const POKEMON_TYPE_COLORS: Record<string, string> = {
  Grass:      "bg-emerald-500 text-emerald-950",
  Fire:       "bg-orange-500 text-orange-950",
  Water:      "bg-sky-500 text-sky-950",
  Lightning:  "bg-yellow-300 text-yellow-950",
  Fighting:   "bg-amber-700 text-amber-50",
  Psychic:    "bg-fuchsia-500 text-fuchsia-950",
  Colorless:  "bg-slate-200 text-slate-900",
  Darkness:   "bg-zinc-800 text-zinc-100",
  Metal:      "bg-slate-400 text-slate-950",
  Dragon:     "bg-indigo-500 text-indigo-50",
  Fairy:      "bg-pink-300 text-pink-950"
};

export const POKEMON_TYPE_EMOJIS: Record<string, string> = {
  Grass: "🌿", Fire: "🔥", Water: "💧", Lightning: "⚡",
  Fighting: "👊", Psychic: "🔮", Colorless: "⭕",
  Darkness: "🌑", Metal: "⚙️", Dragon: "🐉", Fairy: "✨"
};
