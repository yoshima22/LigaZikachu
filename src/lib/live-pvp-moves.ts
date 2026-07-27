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
  ailment: string;
  ailmentChance: number;
  flinchChance: number;
  drain: number;
  healing: number;
  statChanges: Array<{ stat: string; change: number }>;
};

type PokemonApiMove = {
  move: { name: string; url: string };
  version_group_details: Array<{
    level_learned_at: number;
    order?: number;
    version_group: { name: string };
    move_learn_method: { name: string };
  }>;
};

type PokemonApiResponse = { moves: PokemonApiMove[] };

const VERSION_PRIORITY = [
  "scarlet-violet",
  "legends-arceus",
  "brilliant-diamond-and-shining-pearl",
  "sword-shield",
  "ultra-sun-ultra-moon",
  "sun-moon",
];

function displayName(
  slug: string,
  names: Array<{ name: string; language: { name: string } }>,
) {
  const translated: Record<string, string> = {
    tackle: "Investida",
    growl: "Rosnar",
    scratch: "Arranhão",
    ember: "Brasa",
    flamethrower: "Lança-Chamas",
    "fire-blast": "Explosão de Fogo",
    "water-gun": "Jato d'Água",
    surf: "Surfar",
    "hydro-pump": "Hidrobomba",
    bubble: "Bolha",
    "vine-whip": "Chicote de Vinha",
    "razor-leaf": "Folha Navalha",
    "solar-beam": "Raio Solar",
    thunderbolt: "Raio",
    thunder: "Trovão",
    "thunder-shock": "Choque do Trovão",
    "thunder-punch": "Soco do Trovão",
    "quick-attack": "Ataque Rápido",
    "hyper-beam": "Hiper Raio",
    "body-slam": "Golpe de Corpo",
    bite: "Mordida",
    crunch: "Triturar",
    confusion: "Confusão",
    psychic: "Psíquico",
    psybeam: "Psicorraio",
    "shadow-ball": "Bola Sombria",
    "dark-pulse": "Pulso Sombrio",
    "dragon-claw": "Garra do Dragão",
    "dragon-pulse": "Pulso do Dragão",
    "ice-beam": "Raio de Gelo",
    blizzard: "Nevasca",
    earthquake: "Terremoto",
    dig: "Escavar",
    fly: "Voar",
    "air-slash": "Corte de Ar",
    protect: "Proteção",
    recover: "Recuperação",
    rest: "Descanso",
    "sleep-powder": "Pó do Sono",
    "stun-spore": "Esporo Paralisante",
    toxic: "Tóxico",
    poison: "Veneno",
    "swords-dance": "Dança das Espadas",
    "calm-mind": "Mente Calma",
    "double-team": "Time Duplo",
    "iron-tail": "Cauda de Ferro",
    "metal-claw": "Garra de Metal",
    "aura-sphere": "Esfera de Aura",
    "close-combat": "Combate Corpo a Corpo",
    "brick-break": "Quebra-Tijolo",
    "rock-slide": "Deslizamento de Pedras",
    "stone-edge": "Gume de Pedra",
    "play-rough": "Jogo Duro",
    moonblast: "Explosão Lunar",
    "energy-ball": "Bola de Energia",
    "seed-bomb": "Bomba de Sementes",
    "sludge-bomb": "Bomba de Lodo",
    "x-scissor": "Tesoura X",
    "bug-buzz": "Zumbido de Inseto",
    roost: "Poleiro",
    substitute: "Substituto",
    swift: "Estrela Cadente",
  };
  return (
    names.find((entry) => entry.language.name === "en")?.name ??
    translated[slug] ??
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function describeMove(data: {
  name: string;
  damage_class: { name: string };
  power: number | null;
  accuracy: number | null;
  meta: {
    ailment: { name: string };
    ailment_chance: number;
    flinch_chance: number;
    drain: number;
    healing: number;
  };
  stat_changes: Array<{ change: number; stat: { name: string } }>;
}) {
  if (data.name === "transform")
    return "Transforma o usuário em uma cópia visível do adversário ativo. Copia forma, tipos, atributos e os quatro golpes atuais, mas preserva o próprio HP. O card continua sinalizando quem é o mascote transformado.";
  const parts: string[] = [];
  parts.push(
    data.damage_class.name === "status"
      ? "Golpe de suporte que não causa dano direto."
      : `Causa dano ${data.damage_class.name === "physical" ? "físico" : "especial"}${data.power ? ` com poder base ${data.power}` : ""}.`,
  );
  if (data.accuracy != null)
    parts.push(`Possui ${data.accuracy}% de precisão base.`);
  const ailments: Record<string, string> = {
    paralysis: "paralisia",
    sleep: "sono",
    confusion: "confusão",
    poison: "veneno",
    burn: "queimadura",
    freeze: "congelamento",
    trap: "aprisionamento",
  };
  if (data.meta.ailment.name !== "none")
    parts.push(
      `Pode causar ${ailments[data.meta.ailment.name] ?? data.meta.ailment.name}${data.meta.ailment_chance ? ` (${data.meta.ailment_chance}%)` : ""}.`,
    );
  if (data.meta.flinch_chance)
    parts.push(
      `Tem ${data.meta.flinch_chance}% de chance de fazer o alvo hesitar.`,
    );
  if (data.meta.drain > 0)
    parts.push(`Recupera ${data.meta.drain}% do dano causado.`);
  if (data.meta.drain < 0)
    parts.push(
      `Causa recuo equivalente a ${Math.abs(data.meta.drain)}% do dano.`,
    );
  if (data.meta.healing)
    parts.push(`Recupera ${data.meta.healing}% do HP máximo.`);
  if (data.stat_changes.length)
    parts.push(
      `Altera ${data.stat_changes.map((change) => `${change.stat.name} em ${change.change > 0 ? "+" : ""}${change.change} estágio(s)`).join(", ")}.`,
    );
  return parts.join(" ");
}

async function getMoveCandidates(pokemonId: number, level: number) {
  const response = await fetch(`${POKE_API}/pokemon/${pokemonId}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!response.ok)
    throw new Error("Não foi possível consultar os golpes deste Pokémon.");
  const pokemon = (await response.json()) as PokemonApiResponse;
  const availableVersions = new Set(
    pokemon.moves.flatMap((entry) =>
      entry.version_group_details.map((detail) => detail.version_group.name),
    ),
  );
  const version = VERSION_PRIORITY.find((candidate) =>
    availableVersions.has(candidate),
  );
  if (!version)
    return {
      legal: [] as PokemonApiMove[],
      levelUp: [] as Array<{
        entry: PokemonApiMove;
        level: number;
        order: number;
      }>,
    };

  const legal = pokemon.moves.filter((entry) =>
    entry.version_group_details.some((detail) => {
      if (detail.version_group.name !== version) return false;
      if (detail.move_learn_method.name === "level-up")
        return detail.level_learned_at <= level;
      return ["machine", "tutor", "egg"].includes(
        detail.move_learn_method.name,
      );
    }),
  );
  const levelUp = legal
    .flatMap((entry) =>
      entry.version_group_details
        .filter(
          (detail) =>
            detail.version_group.name === version &&
            detail.move_learn_method.name === "level-up" &&
            detail.level_learned_at <= level,
        )
        .map((detail) => ({
          entry,
          level: detail.level_learned_at,
          order: "order" in detail ? Number(detail.order ?? 0) : 0,
        })),
    )
    .sort((a, b) => b.level - a.level || b.order - a.order);
  return { legal, levelUp };
}

export async function getLegalMoveSlugs(pokemonId: number, level: number) {
  return (await getMoveCandidates(pokemonId, level)).legal.map(
    (entry) => entry.move.name,
  );
}

export async function getMove(move: string | number): Promise<LivePvpMove> {
  const response = await fetch(`${POKE_API}/move/${move}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!response.ok) throw new Error(`Golpe ${move} não encontrado.`);
  const data = (await response.json()) as {
    id: number;
    name: string;
    accuracy: number | null;
    effect_chance: number | null;
    pp: number;
    priority: number;
    power: number | null;
    damage_class: { name: LivePvpMove["damageClass"] };
    type: { name: string };
    target: { name: string };
    names: Array<{ name: string; language: { name: string } }>;
    effect_entries: Array<{ short_effect: string; language: { name: string } }>;
    meta: {
      ailment: { name: string };
      ailment_chance: number;
      flinch_chance: number;
      drain: number;
      healing: number;
    };
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
    effect: describeMove(data),
    ailment: data.meta.ailment.name,
    ailmentChance: data.meta.ailment_chance,
    flinchChance: data.meta.flinch_chance,
    drain: data.meta.drain,
    healing: data.meta.healing,
    statChanges: data.stat_changes.map((entry) => ({
      stat: entry.stat.name,
      change: entry.change,
    })),
  };
}

export async function getLegalMoves(
  pokemonId: number,
  level: number,
  limit = 80,
) {
  const slugs = (await getLegalMoveSlugs(pokemonId, level)).slice(0, limit);
  const settled = await Promise.allSettled(slugs.map(getMove));
  return settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
}

export async function getLegalMovesWithRecommendation(
  pokemonId: number,
  level: number,
  limit = 80,
) {
  const candidates = await getMoveCandidates(pokemonId, level);
  const legalSlugs = candidates.legal
    .map((entry) => entry.move.name)
    .slice(0, limit);
  const settled = await Promise.allSettled(legalSlugs.map(getMove));
  const moves = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const bySlug = new Map(moves.map((move) => [move.slug, move]));
  const recommended: LivePvpMove[] = [];
  for (const candidate of candidates.levelUp) {
    const move = bySlug.get(candidate.entry.move.name);
    if (move && !recommended.some((entry) => entry.id === move.id))
      recommended.push(move);
    if (recommended.length === 4) break;
  }
  if (recommended.length < 4) {
    const fillers = moves
      .filter((move) => !recommended.some((entry) => entry.id === move.id))
      .sort(
        (a, b) =>
          Number(b.power != null) - Number(a.power != null) ||
          (b.power ?? 0) - (a.power ?? 0),
      );
    recommended.push(...fillers.slice(0, 4 - recommended.length));
  }
  return { moves, recommended: recommended.slice(0, 4) };
}
