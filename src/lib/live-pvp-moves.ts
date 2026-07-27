const POKE_API = "https://pokeapi.co/api/v2";

export type LivePvpMove = {
  id: number;
  slug: string;
  name: string;
  type: string;
  damageClass: "physical" | "special" | "status";
  power: number | null;
  accuracy: number | null;
  pp: number;
  priority: number;
  target: string;
  effectChance: number | null;
  effect: string;
  statChanges: Array<{ stat: string; change: number }>;
};

type PokemonApiMove = {
  move: { name: string; url: string };
  version_group_details: Array<{
    level_learned_at: number;
    version_group: { name: string };
    move_learn_method: { name: string };
  }>;
};

type PokemonApiResponse = { moves: PokemonApiMove[] };

const VERSION_PRIORITY = [
  "scarlet-violet", "legends-arceus", "brilliant-diamond-and-shining-pearl",
  "sword-shield", "ultra-sun-ultra-moon", "sun-moon",
];

function displayName(slug: string, names: Array<{ name: string; language: { name: string } }>) {
  return names.find((entry) => entry.language.name === "pt-BR")?.name
    ?? names.find((entry) => entry.language.name === "en")?.name
    ?? slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export async function getLegalMoveSlugs(pokemonId: number, level: number) {
  const response = await fetch(`${POKE_API}/pokemon/${pokemonId}`, { next: { revalidate: 60 * 60 * 24 * 30 } });
  if (!response.ok) throw new Error("Não foi possível consultar os golpes deste Pokémon.");
  const pokemon = await response.json() as PokemonApiResponse;
  const availableVersions = new Set(pokemon.moves.flatMap((entry) => entry.version_group_details.map((detail) => detail.version_group.name)));
  const version = VERSION_PRIORITY.find((candidate) => availableVersions.has(candidate));
  if (!version) return [];

  return pokemon.moves.filter((entry) => entry.version_group_details.some((detail) => {
    if (detail.version_group.name !== version) return false;
    if (detail.move_learn_method.name === "level-up") return detail.level_learned_at <= level;
    return ["machine", "tutor", "egg"].includes(detail.move_learn_method.name);
  })).map((entry) => entry.move.name);
}

export async function getMove(move: string | number): Promise<LivePvpMove> {
  const response = await fetch(`${POKE_API}/move/${move}`, { next: { revalidate: 60 * 60 * 24 * 30 } });
  if (!response.ok) throw new Error(`Golpe ${move} não encontrado.`);
  const data = await response.json() as {
    id: number; name: string; accuracy: number | null; effect_chance: number | null; pp: number;
    priority: number; power: number | null; damage_class: { name: LivePvpMove["damageClass"] };
    type: { name: string }; target: { name: string };
    names: Array<{ name: string; language: { name: string } }>;
    effect_entries: Array<{ short_effect: string; language: { name: string } }>;
    stat_changes: Array<{ change: number; stat: { name: string } }>;
  };
  return {
    id: data.id,
    slug: data.name,
    name: displayName(data.name, data.names),
    type: data.type.name,
    damageClass: data.damage_class.name,
    power: data.power,
    accuracy: data.accuracy,
    pp: data.pp,
    priority: data.priority,
    target: data.target.name,
    effectChance: data.effect_chance,
    effect: data.effect_entries.find((entry) => entry.language.name === "en")?.short_effect ?? "",
    statChanges: data.stat_changes.map((entry) => ({ stat: entry.stat.name, change: entry.change })),
  };
}

export async function getLegalMoves(pokemonId: number, level: number, limit = 80) {
  const slugs = (await getLegalMoveSlugs(pokemonId, level)).slice(0, limit);
  const settled = await Promise.allSettled(slugs.map(getMove));
  return settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
}
