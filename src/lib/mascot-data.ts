/**
 * Dados estáticos do sistema de mascotes.
 * Pools de Pokémon por raridade de ovo (gen 1-2, apenas formas iniciais).
 * Evoluções com nível clássico dos jogos.
 */

// ── Pools por tipo de ovo ─────────────────────────────────────────────────────

// IDs da PokéAPI — apenas formas iniciais de cadeia evolutiva ou Pokémon sem evolução
export const EGG_POOLS: Record<string, number[]> = {
  // Ovo Comum — Pokémon comuns da gen 1-2
  COMMON: [
    10, 13, 16, 19, 21, 23, 27, 29, 32, 35, 39, 41, 43, 46, 48, 50,
    52, 54, 56, 60, 69, 72, 74, 77, 79, 81, 84, 86, 88, 90, 96, 98,
    100, 102, 104, 109, 111, 116, 118, 120,
    // Gen 2
    161, 163, 165, 167, 170, 183, 187, 191, 194, 204, 209, 218, 220,
    223, 228, 231, 234, 235,
  ],

  // Ovo Raro — Starters, Pokémon populares
  RARE: [
    1, 4, 7,           // Starters gen 1
    25, 37, 58, 63, 66,  // Populares gen 1
    92, 95, 106, 107, 108, 113, 123, 124, 125, 126, 127, 128,
    // Gen 2
    152, 155, 158,      // Starters gen 2
    172, 173, 174, 175, 179, 190, 193, 196, 197, 198, 200, 203,
    207, 215, 216, 225, 227,
  ],

  // Ovo Especial — Pokémon raros e cobiçados
  SPECIAL: [
    129, 131, 132, 133, 138, 140, 143,  // Magikarp, Lapras, Ditto, Eevee, fósseis, Snorlax
    147,                                  // Dratini
    // Gen 2
    246, 236,                            // Larvitar, Tyrogue
    241, 213, 214, 222, 226, 233,        // Miltank, Shuckle, Heracross, Corsola, Mantine, Porygon2
  ],

  // Ovo de Evento — pool temático (configurado caso a caso; padrão = starters)
  EVENT: [1, 4, 7, 152, 155, 158, 25, 133, 147],

  // Ovos por geração (apenas formas iniciais presentes em COMMON ou RARE)
  EGG_GEN1: [
    // COMMON gen 1
    10, 13, 16, 19, 21, 23, 27, 29, 32, 35, 39, 41, 43, 46, 48, 50,
    52, 54, 56, 60, 69, 72, 74, 77, 79, 81, 84, 86, 88, 90, 96, 98,
    100, 102, 104, 109, 111, 116, 118, 120,
    // RARE gen 1
    1, 4, 7, 25, 37, 58, 63, 66,
    92, 95, 106, 107, 108, 113, 123, 124, 125, 126, 127, 128,
  ],

  EGG_GEN2: [
    // COMMON gen 2
    161, 163, 165, 167, 170, 183, 187, 191, 194, 204, 209, 218, 220,
    223, 228, 231, 234, 235,
    // RARE gen 2
    152, 155, 158,
    172, 173, 174, 175, 179, 190, 193, 196, 197, 198, 200, 203,
    207, 215, 216, 225, 227,
  ],
};

// ── Evoluções por nível ───────────────────────────────────────────────────────
// Formato: { de: pokemonId, para: pokemonId, nivel: number }

export interface Evolution {
  from: number;
  to: number;
  level: number;
}

export const EVOLUTIONS: Evolution[] = [
  // Gen 1 — starters
  { from: 1,   to: 2,   level: 16 }, { from: 2,   to: 3,   level: 32 },
  { from: 4,   to: 5,   level: 16 }, { from: 5,   to: 6,   level: 36 },
  { from: 7,   to: 8,   level: 16 }, { from: 8,   to: 9,   level: 36 },
  // Insetos
  { from: 10,  to: 11,  level: 7  }, { from: 11,  to: 12,  level: 10 },
  { from: 13,  to: 14,  level: 7  }, { from: 14,  to: 15,  level: 10 },
  // Outros gen 1
  { from: 16,  to: 17,  level: 18 }, { from: 17,  to: 18,  level: 36 },
  { from: 19,  to: 20,  level: 20 },
  { from: 21,  to: 22,  level: 20 },
  { from: 23,  to: 24,  level: 22 },
  { from: 25,  to: 26,  level: 30 }, // Pikachu → Raichu (sem pedra no sistema)
  { from: 27,  to: 28,  level: 22 },
  { from: 29,  to: 30,  level: 16 }, { from: 30,  to: 31,  level: 36 },
  { from: 32,  to: 33,  level: 16 }, { from: 33,  to: 34,  level: 36 },
  { from: 35,  to: 36,  level: 36 },
  { from: 37,  to: 38,  level: 36 },
  { from: 39,  to: 40,  level: 36 },
  { from: 41,  to: 42,  level: 22 },
  { from: 43,  to: 44,  level: 21 }, { from: 44,  to: 45,  level: 36 },
  { from: 46,  to: 47,  level: 24 },
  { from: 48,  to: 49,  level: 31 },
  { from: 50,  to: 51,  level: 26 },
  { from: 52,  to: 53,  level: 28 },
  { from: 54,  to: 55,  level: 33 },
  { from: 56,  to: 57,  level: 28 },
  { from: 58,  to: 59,  level: 36 },
  { from: 60,  to: 61,  level: 25 }, { from: 61,  to: 62,  level: 36 },
  { from: 63,  to: 64,  level: 16 }, { from: 64,  to: 65,  level: 36 },
  { from: 66,  to: 67,  level: 28 }, { from: 67,  to: 68,  level: 36 },
  { from: 69,  to: 70,  level: 21 }, { from: 70,  to: 71,  level: 36 },
  { from: 72,  to: 73,  level: 30 },
  { from: 74,  to: 75,  level: 25 }, { from: 75,  to: 76,  level: 36 },
  { from: 77,  to: 78,  level: 40 },
  { from: 79,  to: 80,  level: 37 },
  { from: 81,  to: 82,  level: 30 },
  { from: 84,  to: 85,  level: 31 },
  { from: 86,  to: 87,  level: 34 },
  { from: 88,  to: 89,  level: 38 },
  { from: 90,  to: 91,  level: 36 },
  { from: 92,  to: 93,  level: 25 }, { from: 93,  to: 94,  level: 36 },
  { from: 96,  to: 97,  level: 26 },
  { from: 98,  to: 99,  level: 28 },
  { from: 100, to: 101, level: 30 },
  { from: 102, to: 103, level: 36 },
  { from: 104, to: 105, level: 28 },
  { from: 109, to: 110, level: 35 },
  { from: 111, to: 112, level: 42 },
  { from: 116, to: 117, level: 32 },
  { from: 118, to: 119, level: 33 },
  { from: 120, to: 121, level: 36 },
  { from: 129, to: 130, level: 20 }, // Magikarp → Gyarados
  { from: 133, to: 134, level: 30 }, // Eevee → Vaporeon (simplificado por nível)
  { from: 138, to: 139, level: 40 },
  { from: 140, to: 141, level: 40 },
  { from: 147, to: 148, level: 30 }, { from: 148, to: 149, level: 55 },
  // Gen 2 — starters
  { from: 152, to: 153, level: 16 }, { from: 153, to: 154, level: 32 },
  { from: 155, to: 156, level: 14 }, { from: 156, to: 157, level: 36 },
  { from: 158, to: 159, level: 18 }, { from: 159, to: 160, level: 30 },
  // Gen 2 — outros
  { from: 161, to: 162, level: 15 },
  { from: 163, to: 164, level: 20 },
  { from: 165, to: 166, level: 18 },
  { from: 167, to: 168, level: 22 },
  { from: 170, to: 171, level: 27 },
  { from: 172, to: 25,  level: 15 }, // Pichu → Pikachu
  { from: 173, to: 35,  level: 15 }, // Cleffa → Clefairy
  { from: 174, to: 39,  level: 15 }, // Igglybuff → Jigglypuff
  { from: 175, to: 176, level: 25 },
  { from: 183, to: 184, level: 18 },
  { from: 187, to: 188, level: 18 }, { from: 188, to: 189, level: 27 },
  { from: 191, to: 192, level: 36 },
  { from: 194, to: 195, level: 20 },
  { from: 204, to: 205, level: 31 },
  { from: 209, to: 210, level: 23 },
  { from: 216, to: 217, level: 30 },
  { from: 218, to: 219, level: 38 },
  { from: 220, to: 221, level: 33 },
  { from: 223, to: 224, level: 25 },
  { from: 228, to: 229, level: 24 },
  { from: 231, to: 232, level: 25 },
  { from: 238, to: 124, level: 30 }, // Smoochum → Jynx
  { from: 239, to: 125, level: 30 }, // Elekid → Electabuzz
  { from: 240, to: 126, level: 30 }, // Magby → Magmar
  { from: 246, to: 247, level: 30 }, { from: 247, to: 248, level: 55 },
];

// Mapa de acesso rápido: pokemonId → evolução
export const EVOLUTION_MAP = new Map<number, Evolution>(
  EVOLUTIONS.map(e => [e.from, e])
);

// ── EXP necessária por nível ──────────────────────────────────────────────────
// Curva linear suave: jogável mesmo nos níveis altos.
// Nível 1→2: 120 EXP | Nível 50→51: 1.100 EXP | Nível 100→101: 2.100 EXP
export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100 + (level - 1) * 20;
}

// EXP total acumulada até o nível N
export function totalExpForLevel(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) total += expForLevel(l);
  return total;
}

// EXP necessária para ir do nível atual para o próximo
export function expToNextLevel(currentLevel: number): number {
  return expForLevel(currentLevel + 1);
}

// ── Status derivados (calculados a partir dos dados, sem campo extra no BD) ───

export type HungerStatus = "STARVING" | "HUNGRY" | "NEUTRAL" | "SATISFIED" | "STUFFED";
export type HappinessStatus = "DEPRESSED" | "SAD" | "NEUTRAL" | "CONTENT" | "HAPPY";
export type ChallengeStatus = "ANGRY" | "CALM" | "EAGER" | "CHALLENGER";

export function getHungerStatus(lastFedAt: Date | null): HungerStatus {
  const hours = lastFedAt ? (Date.now() - new Date(lastFedAt).getTime()) / 3_600_000 : 999;
  if (hours < 2)  return "STUFFED";
  if (hours < 6)  return "SATISFIED";
  if (hours < 12) return "NEUTRAL";
  if (hours < 24) return "HUNGRY";
  return "STARVING";
}

export function getHappinessStatus(happiness: number): HappinessStatus {
  if (happiness >= 80) return "HAPPY";
  if (happiness >= 60) return "CONTENT";
  if (happiness >= 40) return "NEUTRAL";
  if (happiness >= 20) return "SAD";
  return "DEPRESSED";
}

export function getChallengeStatus(mood: string): ChallengeStatus {
  if (mood === "CONFIDENT" || mood === "COMPETITIVE") return "CHALLENGER";
  if (mood === "EXCITED" || mood === "PROUD")         return "EAGER";
  if (mood === "ANGRY")                               return "ANGRY";
  return "CALM";
}

export const HUNGER_LABEL: Record<HungerStatus,  string> = {
  STARVING:  "Faminto",  HUNGRY: "Com fome",   NEUTRAL: "Normal",
  SATISFIED: "Satisfeito", STUFFED: "Empanturrado",
};
export const HAPPINESS_LABEL: Record<HappinessStatus, string> = {
  DEPRESSED: "Depressivo", SAD: "Triste", NEUTRAL: "Neutro",
  CONTENT: "Contente", HAPPY: "Feliz",
};
export const CHALLENGE_LABEL: Record<ChallengeStatus, string> = {
  ANGRY: "Irritado", CALM: "Tranquilo", EAGER: "Animado", CHALLENGER: "Desafiante",
};
export const HUNGER_COLOR:    Record<HungerStatus,    string> = {
  STARVING: "text-red-400",    HUNGRY: "text-orange-400", NEUTRAL: "text-slate-400",
  SATISFIED: "text-green-400", STUFFED: "text-blue-400",
};
export const HAPPINESS_COLOR: Record<HappinessStatus, string> = {
  DEPRESSED: "text-red-400", SAD: "text-orange-400",    NEUTRAL: "text-slate-400",
  CONTENT:   "text-green-300", HAPPY: "text-[#FFCB05]",
};
export const CHALLENGE_COLOR: Record<ChallengeStatus, string> = {
  ANGRY: "text-red-400", CALM: "text-slate-400", EAGER: "text-blue-400", CHALLENGER: "text-[#FFCB05]",
};

// ── Personalidades ────────────────────────────────────────────────────────────

export const PERSONALITIES = [
  "LOYAL","PROUD","MISCHIEVOUS","LAZY","COMPETITIVE",
  "DRAMATIC","PLAYFUL","ELECTRIC","TIMID","CHAOTIC"
] as const;

export const PERSONALITY_LABEL: Record<string, string> = {
  LOYAL:        "Leal",
  PROUD:        "Orgulhoso",
  MISCHIEVOUS:  "Travesso",
  LAZY:         "Preguiçoso",
  COMPETITIVE:  "Competitivo",
  DRAMATIC:     "Dramático",
  PLAYFUL:      "Brincalhão",
  ELECTRIC:     "Elétrico",
  TIMID:        "Tímido",
  CHAOTIC:      "Caótico",
};

export const MOOD_LABEL: Record<string, string> = {
  HAPPY:        "Feliz",
  EXCITED:      "Animado",
  NEUTRAL:      "Neutro",
  TIRED:        "Cansado",
  NEEDY:        "Carente",
  COMPETITIVE:  "Competitivo",
  ANGRY:        "Bravo",
  PROUD:        "Orgulhoso",
  HUNGRY:       "Faminto",
  CONFIDENT:    "Confiante",
};

export const MOOD_EMOJI: Record<string, string> = {
  HAPPY:       "😊",
  EXCITED:     "🤩",
  NEUTRAL:     "😐",
  TIRED:       "😴",
  NEEDY:       "🥺",
  COMPETITIVE: "😤",
  ANGRY:       "😠",
  PROUD:       "😎",
  HUNGRY:      "😋",
  CONFIDENT:   "💪",
};

// ── Duração das expedições (em ms) ───────────────────────────────────────────

export const EXPEDITION_DURATION_MS = 60 * 60 * 1000; // 1 hora

// ── Incubadora (em ms) ────────────────────────────────────────────────────────

export const INCUBATION_DURATION_MS = 10 * 60 * 1000; // 10 minutos

// ── EXP ganho por atividade ───────────────────────────────────────────────────

export const EXP_REWARDS = {
  MATCH_PLAYED:    5,
  MATCH_WIN:      10,
  WIN_STREAK:      5,   // bônus por vitória em sequência
  DECK_SUBMITTED:  3,
  PLAY_WITH:       8,
  PET:             3,
  FEED_FOOD:       5,
  FEED_SWEET:     12,
  EXPEDITION:     20,
};

// ── Sprite URL ────────────────────────────────────────────────────────────────

export function getSpriteUrl(pokemonId: number, animated = false): string {
  if (animated) {
    // GIF animado — existe para gen 1-5 (IDs 1-649)
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pokemonId}.gif`;
  }
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

// URL do sprite estático (fallback quando GIF não existe)
export function getStaticSpriteUrl(pokemonId: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

// ── Nomes PT-BR dos Pokémon Gen 1-2 (IDs 1-251) ──────────────────────────────

export const POKEMON_PT_NAMES: Record<number, string> = {
  // Gen 1
  1:"Bulbasaur",2:"Ivysaur",3:"Venusaur",4:"Charmander",5:"Charmeleon",6:"Charizard",
  7:"Squirtle",8:"Wartortle",9:"Blastoise",10:"Caterpie",11:"Metapod",12:"Butterfree",
  13:"Weedle",14:"Kakuna",15:"Beedrill",16:"Pidgey",17:"Pidgeotto",18:"Pidgeot",
  19:"Rattata",20:"Raticate",21:"Spearow",22:"Fearow",23:"Ekans",24:"Arbok",
  25:"Pikachu",26:"Raichu",27:"Sandshrew",28:"Sandslash",29:"Nidoran♀",30:"Nidorina",
  31:"Nidoqueen",32:"Nidoran♂",33:"Nidorino",34:"Nidoking",35:"Clefairy",36:"Clefable",
  37:"Vulpix",38:"Ninetales",39:"Jigglypuff",40:"Wigglytuff",41:"Zubat",42:"Golbat",
  43:"Oddish",44:"Gloom",45:"Vileplume",46:"Paras",47:"Parasect",48:"Venonat",
  49:"Venomoth",50:"Diglett",51:"Dugtrio",52:"Meowth",53:"Persian",54:"Psyduck",
  55:"Golduck",56:"Mankey",57:"Primeape",58:"Growlithe",59:"Arcanine",60:"Poliwag",
  61:"Poliwhirl",62:"Poliwrath",63:"Abra",64:"Kadabra",65:"Alakazam",66:"Machop",
  67:"Machoke",68:"Machamp",69:"Bellsprout",70:"Weepinbell",71:"Victreebel",
  72:"Tentacool",73:"Tentacruel",74:"Geodude",75:"Graveler",76:"Golem",
  77:"Ponyta",78:"Rapidash",79:"Slowpoke",80:"Slowbro",81:"Magnemite",82:"Magneton",
  83:"Farfetch'd",84:"Doduo",85:"Dodrio",86:"Seel",87:"Dewgong",88:"Grimer",89:"Muk",
  90:"Shellder",91:"Cloyster",92:"Gastly",93:"Haunter",94:"Gengar",95:"Onix",
  96:"Drowzee",97:"Hypno",98:"Krabby",99:"Kingler",100:"Voltorb",101:"Electrode",
  102:"Exeggcute",103:"Exeggutor",104:"Cubone",105:"Marowak",106:"Hitmonlee",
  107:"Hitmonchan",108:"Lickitung",109:"Koffing",110:"Weezing",111:"Rhyhorn",
  112:"Rhydon",113:"Chansey",114:"Tangela",115:"Kangaskhan",116:"Horsea",117:"Seadra",
  118:"Goldeen",119:"Seaking",120:"Staryu",121:"Starmie",122:"Mr. Mime",123:"Scyther",
  124:"Jynx",125:"Electabuzz",126:"Magmar",127:"Pinsir",128:"Tauros",129:"Magikarp",
  130:"Gyarados",131:"Lapras",132:"Ditto",133:"Eevee",134:"Vaporeon",135:"Jolteon",
  136:"Flareon",137:"Porygon",138:"Omanyte",139:"Omastar",140:"Kabuto",141:"Kabutops",
  142:"Aerodactyl",143:"Snorlax",144:"Articuno",145:"Zapdos",146:"Moltres",
  147:"Dratini",148:"Dragonair",149:"Dragonite",150:"Mewtwo",151:"Mew",
  // Gen 2
  152:"Chikorita",153:"Bayleef",154:"Meganium",155:"Cyndaquil",156:"Quilava",
  157:"Typhlosion",158:"Totodile",159:"Croconaw",160:"Feraligatr",161:"Sentret",
  162:"Furret",163:"Hoothoot",164:"Noctowl",165:"Ledyba",166:"Ledian",167:"Spinarak",
  168:"Ariados",169:"Crobat",170:"Chinchou",171:"Lanturn",172:"Pichu",173:"Cleffa",
  174:"Igglybuff",175:"Togepi",176:"Togetic",177:"Natu",178:"Xatu",179:"Mareep",
  180:"Flaaffy",181:"Ampharos",182:"Bellossom",183:"Marill",184:"Azumarill",
  185:"Sudowoodo",186:"Politoed",187:"Hoppip",188:"Skiploom",189:"Jumpluff",
  190:"Aipom",191:"Sunkern",192:"Sunflora",193:"Yanma",194:"Wooper",195:"Quagsire",
  196:"Espeon",197:"Umbreon",198:"Murkrow",199:"Slowking",200:"Misdreavus",
  201:"Unown",202:"Wobbuffet",203:"Girafarig",204:"Pineco",205:"Forretress",
  206:"Dunsparce",207:"Gligar",208:"Steelix",209:"Snubbull",210:"Granbull",
  211:"Qwilfish",212:"Scizor",213:"Shuckle",214:"Heracross",215:"Sneasel",
  216:"Teddiursa",217:"Ursaring",218:"Slugma",219:"Magcargo",220:"Swinub",
  221:"Piloswine",222:"Corsola",223:"Remoraid",224:"Octillery",225:"Delibird",
  226:"Mantine",227:"Skarmory",228:"Houndour",229:"Houndoom",230:"Kingdra",
  231:"Phanpy",232:"Donphan",233:"Porygon2",234:"Stantler",235:"Smeargle",
  236:"Tyrogue",237:"Hitmontop",238:"Smoochum",239:"Elekid",240:"Magby",
  241:"Miltank",242:"Blissey",243:"Raikou",244:"Entei",245:"Suicune",
  246:"Larvitar",247:"Pupitar",248:"Tyranitar",249:"Lugia",250:"Ho-Oh",251:"Celebi",
};

export function getPokemonName(id: number): string {
  return POKEMON_PT_NAMES[id] ?? `Pokémon #${id}`;
}

// ── Tipos elementais por Pokémon ID ──────────────────────────────────────────
export const POKEMON_ELEMENT: Record<number, string> = {
  // Fire
  4:"fire",5:"fire",6:"fire",37:"fire",38:"fire",58:"fire",59:"fire",77:"fire",78:"fire",
  126:"fire",136:"fire",155:"fire",156:"fire",157:"fire",228:"fire",229:"fire",240:"fire",
  // Water
  7:"water",8:"water",9:"water",54:"water",55:"water",60:"water",61:"water",62:"water",
  72:"water",73:"water",86:"water",
  98:"water",99:"water",116:"water",117:"water",118:"water",119:"water",120:"water",
  121:"water",129:"water",130:"water",134:"water",158:"water",159:"water",
  160:"water",170:"water",171:"water",183:"water",184:"water",194:"water",195:"water",
  222:"water",223:"water",224:"water",
  // Grass
  1:"grass",2:"grass",3:"grass",43:"grass",44:"grass",45:"grass",69:"grass",70:"grass",
  71:"grass",102:"grass",103:"grass",114:"grass",152:"grass",153:"grass",154:"grass",
  187:"grass",188:"grass",189:"grass",191:"grass",192:"grass",
  // Electric
  25:"electric",26:"electric",82:"electric",100:"electric",101:"electric",
  125:"electric",135:"electric",172:"electric",239:"electric",
  // Psychic (79=Slowpoke, 80=Slowbro, 81=Magnemite→electric, 124=Jynx)
  63:"psychic",64:"psychic",65:"psychic",79:"psychic",80:"psychic",81:"electric",
  96:"psychic",97:"psychic",124:"psychic",
  137:"psychic",150:"psychic",196:"psychic",203:"psychic",175:"psychic",176:"psychic",
  // Ghost
  92:"ghost",93:"ghost",94:"ghost",200:"ghost",
  // Dragon
  147:"dragon",148:"dragon",149:"dragon",
  // Fighting
  56:"fighting",57:"fighting",66:"fighting",67:"fighting",68:"fighting",
  106:"fighting",107:"fighting",214:"fighting",236:"fighting",237:"fighting",
  // Ice (87=Dewgong, 91=Cloyster, 131=Lapras, 220=Swinub, 221=Piloswine, 238=Smoochum)
  87:"ice",91:"ice",131:"ice",220:"ice",221:"ice",238:"ice",
  // Poison
  23:"poison",24:"poison",29:"poison",30:"poison",31:"poison",32:"poison",33:"poison",
  34:"poison",41:"poison",42:"poison",88:"poison",89:"poison",109:"poison",110:"poison",
  // Ground (74=Geodude→rock primary)
  27:"ground",28:"ground",50:"ground",51:"ground",75:"ground",76:"ground",
  104:"ground",105:"ground",111:"ground",112:"ground",
  // Rock (74=Geodude, 138-142)
  74:"rock",138:"rock",139:"rock",140:"rock",141:"rock",142:"rock",
  // Bug
  10:"bug",11:"bug",12:"bug",13:"bug",14:"bug",15:"bug",46:"bug",47:"bug",
  48:"bug",49:"bug",165:"bug",166:"bug",167:"bug",168:"bug",204:"bug",205:"bug",
  // Normal (default)
};

export function getPokemonElement(pokemonId: number): string {
  return POKEMON_ELEMENT[pokemonId] ?? "normal";
}

// Vantagens de tipo (atacante → defensores fracos)
export const TYPE_ADVANTAGE: Record<string, string[]> = {
  fire:     ["grass","ice","bug","steel"],
  water:    ["fire","ground","rock"],
  grass:    ["water","ground","rock"],
  electric: ["water","flying"],
  psychic:  ["fighting","poison"],
  ghost:    ["psychic","ghost"],
  dragon:   ["dragon"],
  fighting: ["normal","rock","ice","dark","steel"],
  ground:   ["fire","electric","poison","rock","steel"],
  rock:     ["fire","flying","bug","ice"],
  ice:      ["grass","ground","flying","dragon"],
  poison:   ["grass","fairy"],
  bug:      ["grass","psychic","dark"],
  normal:   [],
};

export function getTypeAdvantageMultiplier(attackerType: string, defenderType: string): number {
  const strong = TYPE_ADVANTAGE[attackerType] ?? [];
  return strong.includes(defenderType) ? 1.3 : 1.0;
}

// ── Explicações das personalidades ────────────────────────────────────────────
export const PERSONALITY_DESCRIPTION: Record<string, string> = {
  LOYAL:       "Fiel ao treinador. Cresce mais em Carisma. Manda mais presentes para amigos e defende bem em batalhas.",
  PROUD:       "Orgulhoso e vaidoso. Entra em modo Confiante com mais facilidade. Pode recusar carinho se não estiver feliz.",
  MISCHIEVOUS: "Travesso e irreverente. Tem mais chance de criar rivalidades e pode 'roubar' itens de rivais.",
  LAZY:        "Preguiçoso. Rende menos quando felicidade está baixa. Fica cansado mais rápido em interações.",
  COMPETITIVE: "Competitivo nato. Cresce mais em Força. Fica mais forte quando o treinador vence partidas.",
  DRAMATIC:    "Dramático. Reage mais intensamente a vitórias e derrotas do treinador.",
  PLAYFUL:     "Brincalhão. Brincar dá mais EXP e felicidade. Se entedia rápido sem interação.",
  ELECTRIC:    "Cheio de energia. Tem bônus em expedições. Fica animado com mais facilidade.",
  TIMID:       "Tímido. Pode recusar carinho e evitar interações. Mas quando cria amizade, é muito leal.",
  CHAOTIC:     "Caótico e imprevisível. Reações podem surpreender — positivas ou negativas.",
};

// ── Balão de diálogo ──────────────────────────────────────────────────────────
export function generateMascotSpeech(params: {
  mood: string;
  happiness: number;
  personality: string;
  lastFedAt: Date | null;
  lastInteractedAt: Date | null;
  battleWins?: number;
  battleLosses?: number;
  recentTrainerWins?: number;
}): string {
  const hunger = getHungerStatus(params.lastFedAt);
  const h = getHappinessStatus(params.happiness);
  const hoursAlone = params.lastInteractedAt
    ? (Date.now() - new Date(params.lastInteractedAt).getTime()) / 3_600_000
    : 999;

  if (hunger === "STARVING") return "Por favor! Estou desmaiando de fome! 🍖";
  if (params.mood === "ANGRY") return "Tô procurando briga! Me manda pra uma batalha! 😤";
  if (hunger === "HUNGRY") return "Meu estômago tá roncando... tem comida? 😋";
  if (params.mood === "CONFIDENT") {
    if ((params.recentTrainerWins ?? 0) > 0)
      return `${params.recentTrainerWins} vitórias seguidas! Meu treinador é imbatível! 🏆`;
    return "Me sinto no topo do mundo! Ninguém me para! 💪";
  }
  if (params.mood === "EXCITED") return "Que energia! Bora jogar! ⚡";
  if (hoursAlone > 48) return "Você sumiu! Estava com tanta saudade! 🥺";
  if (h === "HAPPY") return "Estou muito feliz hoje! Obrigado por cuidar de mim! 💛";
  if (params.mood === "TIRED") return "Cansadinho... só mais uns minutinhos... 😴";
  if (h === "DEPRESSED") return "Estou me sentindo muito para baixo... 😢";
  if (h === "SAD") return "Preciso de atenção... 🥺";
  if (params.mood === "NEEDY") return "Oi! Você tá aí? Estava com saudade! 👋";
  if (hunger === "STUFFED") return "Não consigo mais! Tô empanturrado! 😌";
  if ((params.battleWins ?? 0) > 3) return `Já venci ${params.battleWins} batalhas! Respeita! ⚔️`;

  const personalityLines: Record<string, string[]> = {
    COMPETITIVE: ["Quando é a próxima batalha? 😤","Tô pronto pra qualquer desafio! ⚔️"],
    LAZY:        ["...zzz... me deixa... 😴","Hoje não tô com vontade... 🛋️"],
    MISCHIEVOUS: ["Vamos aprontar alguma! 😈","Psiu! Tô tramando algo... 🤫"],
    DRAMATIC:    ["A vida de mascote é uma aventura! 🎭","Cada dia é uma história nova! ✨"],
    TIMID:       ["*olha timidamente* ...oi... 👀","É... estou aqui... 🌸"],
    PLAYFUL:     ["Brincaaa! Vamos jogar! 🎮","Faz alguma coisa! Estou entediado! 😅"],
    LOYAL:       ["Sempre estarei do seu lado! 🤝","Conte comigo, treinador! 💪"],
    ELECTRIC:    ["Carregado de energia! ⚡","Pronto pra qualquer coisa! 🔋"],
    PROUD:       ["Sou o melhor mascote! 😎","Ninguém tem mais classe que eu! 👑"],
    CHAOTIC:     ["...","BOOOM! 💥","Tudo bem? Nada. 🌀"],
  };
  const lines = personalityLines[params.personality] ?? ["Tudo tranquilo! 😐"];
  // Usa hash determinístico do mood+personality para evitar hydration mismatch
  const idx = (params.mood.length + params.personality.length + params.happiness) % lines.length;
  return lines[idx];
}
