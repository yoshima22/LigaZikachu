const POKE_API_BASE_URL = "https://pokeapi.co/api/v2";

type PokemonListResponse = {
  results: Array<{ name: string; url: string }>;
};

type PokemonDetailResponse = {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: {
        front_default: string | null;
      };
    };
  };
  types: Array<{ slot: number; type: { name: string } }>;
  abilities: Array<{ ability: { name: string }; is_hidden: boolean }>;
  stats: Array<{ base_stat: number; stat: { name: string } }>;
};

type PokemonTypeResponse = {
  pokemon: Array<{ pokemon: { name: string } }>;
};

type PokemonSpeciesResponse = {
  names: Array<{ language: { name: string }; name: string }>;
  genera: Array<{ language: { name: string }; genus: string }>;
};

export type PokedexPokemon = {
  id: number;
  name: string;
  displayName: string;
  genus: string | null;
  imageUrl: string | null;
  heightMeters: number;
  weightKg: number;
  types: string[];
  abilities: Array<{ name: string; hidden: boolean }>;
  stats: Array<{ name: string; value: number }>;
  officialPokedexUrl: string;
  officialTcgCardsUrl: string;
};

export type PokedexSearchFilters = {
  query?: string;
  type?: string;
  generation?: string;
};

export const generationOptions = [
  { value: "1", label: "Geracao 1", min: 1, max: 151 },
  { value: "2", label: "Geracao 2", min: 152, max: 251 },
  { value: "3", label: "Geracao 3", min: 252, max: 386 },
  { value: "4", label: "Geracao 4", min: 387, max: 493 },
  { value: "5", label: "Geracao 5", min: 494, max: 649 },
  { value: "6", label: "Geracao 6", min: 650, max: 721 },
  { value: "7", label: "Geracao 7", min: 722, max: 809 },
  { value: "8", label: "Geracao 8", min: 810, max: 905 },
  { value: "9", label: "Geracao 9", min: 906, max: 1025 }
];

export const pokemonTypeLabels: Record<string, string> = {
  normal: "Incolor",
  fire: "Fogo",
  water: "Agua",
  electric: "Eletrico",
  grass: "Grama",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Veneno",
  ground: "Terra",
  flying: "Voador",
  psychic: "Psiquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragao",
  dark: "Noturno",
  steel: "Metalico",
  fairy: "Fada"
};

export const pokemonTypeOptions = Object.entries(pokemonTypeLabels).map(([value, label]) => ({
  value,
  label
}));

export const pokemonTypeClasses: Record<string, string> = {
  normal: "border-slate-300/30 bg-slate-300/15 text-slate-100",
  fire: "border-orange-400/30 bg-orange-500/15 text-orange-200",
  water: "border-sky-400/30 bg-sky-500/15 text-sky-200",
  electric: "border-yellow-300/30 bg-yellow-300/15 text-yellow-100",
  grass: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200",
  ice: "border-cyan-300/30 bg-cyan-300/15 text-cyan-100",
  fighting: "border-amber-600/30 bg-amber-700/20 text-amber-100",
  poison: "border-purple-400/30 bg-purple-500/15 text-purple-200",
  ground: "border-yellow-700/30 bg-yellow-800/20 text-yellow-100",
  flying: "border-indigo-300/30 bg-indigo-400/15 text-indigo-100",
  psychic: "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-200",
  bug: "border-lime-400/30 bg-lime-500/15 text-lime-200",
  rock: "border-stone-400/30 bg-stone-500/15 text-stone-200",
  ghost: "border-violet-400/30 bg-violet-500/15 text-violet-200",
  dragon: "border-indigo-500/30 bg-indigo-600/20 text-indigo-100",
  dark: "border-zinc-500/30 bg-zinc-800/60 text-zinc-100",
  steel: "border-slate-400/30 bg-slate-500/20 text-slate-100",
  fairy: "border-pink-300/30 bg-pink-400/15 text-pink-100"
};

export function formatPokemonName(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function searchPokedexPokemon(filters: PokedexSearchFilters | string, limit = 24) {
  const normalizedFilters =
    typeof filters === "string" ? { query: filters } : filters;
  const normalizedQuery = normalizedFilters.query?.trim().toLowerCase() ?? "";
  const selectedType = normalizedFilters.type?.trim().toLowerCase() ?? "";
  const selectedGeneration = generationOptions.find(
    (generation) => generation.value === normalizedFilters.generation
  );

  const listResponse = await fetch(`${POKE_API_BASE_URL}/pokemon?limit=1025`, {
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!listResponse.ok) {
    throw new Error("Nao foi possivel consultar a PokeAPI.");
  }

  const typePokemonNames = selectedType ? await getPokemonNamesByType(selectedType) : null;
  const list = (await listResponse.json()) as PokemonListResponse;
  const filtered = list.results
    .map((pokemon) => ({ ...pokemon, id: Number(pokemon.url.split("/").filter(Boolean).pop()) }))
    .filter((pokemon) => {
      if (selectedGeneration && (pokemon.id < selectedGeneration.min || pokemon.id > selectedGeneration.max)) {
        return false;
      }

      if (typePokemonNames && !typePokemonNames.has(pokemon.name)) {
        return false;
      }

      if (!normalizedQuery) return true;
      return pokemon.name.includes(normalizedQuery) || String(pokemon.id) === normalizedQuery;
    })
    .sort((a, b) => a.id - b.id)
    .slice(0, limit);

  return Promise.all(filtered.map((pokemon) => getPokedexPokemon(pokemon.name)));
}

export async function getPokedexPokemon(nameOrId: string | number): Promise<PokedexPokemon> {
  const [pokemonResponse, speciesResponse] = await Promise.all([
    fetch(`${POKE_API_BASE_URL}/pokemon/${nameOrId}`, { next: { revalidate: 60 * 60 * 24 } }),
    fetch(`${POKE_API_BASE_URL}/pokemon-species/${nameOrId}`, { next: { revalidate: 60 * 60 * 24 } })
  ]);

  if (!pokemonResponse.ok || !speciesResponse.ok) {
    throw new Error("Pokemon nao encontrado.");
  }

  const pokemon = (await pokemonResponse.json()) as PokemonDetailResponse;
  const species = (await speciesResponse.json()) as PokemonSpeciesResponse;
  const portugueseName = species.names.find((entry) => entry.language.name === "pt-BR")?.name;
  const englishGenus = species.genera.find((entry) => entry.language.name === "en")?.genus ?? null;

  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: portugueseName ?? formatPokemonName(pokemon.name),
    genus: englishGenus,
    imageUrl: pokemon.sprites.other?.["official-artwork"]?.front_default ?? pokemon.sprites.front_default,
    heightMeters: pokemon.height / 10,
    weightKg: pokemon.weight / 10,
    types: pokemon.types.sort((a, b) => a.slot - b.slot).map((entry) => entry.type.name),
    abilities: pokemon.abilities.map((entry) => ({
      name: formatPokemonName(entry.ability.name),
      hidden: entry.is_hidden
    })),
    stats: pokemon.stats.map((entry) => ({
      name: formatStatName(entry.stat.name),
      value: entry.base_stat
    })),
    officialPokedexUrl: `https://www.pokemon.com/br/pokedex/${pokemon.name}`,
    officialTcgCardsUrl: `https://www.pokemon.com/br/pokemon-estampas-ilustradas/cartas-de-pokemon?cardName=${encodeURIComponent(
      pokemon.name
    )}`
  };
}

async function getPokemonNamesByType(type: string) {
  if (!pokemonTypeLabels[type]) return null;

  const response = await fetch(`${POKE_API_BASE_URL}/type/${type}`, {
    next: { revalidate: 60 * 60 * 24 }
  });

  if (!response.ok) return null;

  const data = (await response.json()) as PokemonTypeResponse;
  return new Set(data.pokemon.map((entry) => entry.pokemon.name));
}

function formatStatName(name: string) {
  const labels: Record<string, string> = {
    hp: "HP",
    attack: "Ataque",
    defense: "Defesa",
    "special-attack": "Atq. Esp.",
    "special-defense": "Def. Esp.",
    speed: "Velocidade"
  };

  return labels[name] ?? formatPokemonName(name);
}
