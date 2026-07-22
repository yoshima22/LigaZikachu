/**
 * Weighted egg pool rules for mascot hatching.
 *
 * This file intentionally keeps the hatching rules separate from the static
 * Pokédex data in mascot-data.ts. The goal is to make the economy and pool rates
 * easier to tune without touching the entire mascot system.
 *
 * Important rule: normal eggs should never hatch evolved forms.
 */

import {
  ALL_EVOLVED_IDS,
  EGG_POOLS,
  LEGENDARY_HATCH_BASE_OVERRIDES,
  LEGENDARY_POOL,
} from "@/lib/mascot-data";

type WeightedEggBucket = {
  label: string;
  weight: number;
  pokemonIds: number[];
};

type EggRateProfile = {
  legendaryChance: number;
  buckets: WeightedEggBucket[];
};

const STARTER_IDS = [
  1, 4, 7,
  152, 155, 158,
  252, 255, 258,
  387, 390, 393,
  495, 498, 501,
  650, 653, 656,
  722, 725, 728,
  810, 813, 816,
  906, 909, 912,
];

const COMMON_GOOD_IDS = [
  25, 37, 58, 63, 66, 92, 95, 123, 127, 128,
  172, 173, 174, 175, 179, 190, 193, 200, 203, 207, 215, 216, 225, 227,
  280, 302, 304, 307, 309, 315, 333, 353, 355, 361,
  403, 408, 410, 415, 425, 427, 433, 436, 438, 439, 440, 443, 446, 447, 479,
  531, 532, 540, 548, 570, 572, 577, 587, 595, 607, 610, 613, 627, 633, 636,
  661, 667, 677, 679, 682, 684, 686, 704, 708, 710, 714,
  742, 744, 747, 757, 761, 777, 778, 782,
  840, 848, 854, 856, 868, 872, 878, 885,
  917, 924, 926, 935, 938, 940, 944, 948, 956, 971, 996,
];

const RARE_FAN_FAVORITES = [
  25, 37, 58, 63, 66, 92, 95, 123, 127, 128, 131, 132, 133,
  172, 173, 174, 175, 179, 190, 193, 196, 197, 200, 203, 207, 215, 216, 225, 227, 236,
  280, 302, 304, 307, 309, 315, 333, 349, 353, 355, 359, 361, 371, 374,
  403, 408, 410, 425, 427, 433, 436, 438, 439, 440, 443, 446, 447, 479,
  531, 532, 540, 548, 570, 572, 577, 587, 595, 607, 610, 613, 627, 633, 636,
  661, 667, 677, 679, 682, 684, 686, 696, 698, 701, 704, 707, 708, 710, 714,
  742, 744, 746, 747, 757, 761, 777, 778, 781, 782,
  840, 848, 854, 856, 868, 870, 871, 872, 874, 875, 877, 878, 885,
  917, 924, 926, 932, 935, 938, 940, 944, 948, 956, 963, 971, 996, 999,
  // Formas especiais (IDs PokeAPI: 10004-10005 Wormadam, 10006 Shaymin-Sky, 10007 Giratina-Origem, 10008-10012 Rotom)
  10004, 10005, 10006, 10007, 10008, 10009, 10010, 10011, 10012,
  // Formas Alolan — bases
  10091, 10101, 10103, 10105, 10107, 10109, 10112,
  // Formas Galar — bases + weezing/stunfisk (sem evolução)
  10158, 10159, 10161, 10163, 10164, 10165, 10170, 10171, 10173, 10175, 10176,
  // Formas Hisui — bases
  10229, 10231, 10234, 10235, 10238,
];

const PSEUDO_LEGENDARY_BASE_IDS = [
  147, // Dratini
  246, // Larvitar
  371, // Bagon
  374, // Beldum
  443, // Gible
  633, // Deino
  704, // Goomy
  782, // Jangmo-o
  885, // Dreepy
  996, // Frigibax
];

const FOSSIL_AND_ANCIENT_IDS = [
  138, 140, 142,
  345, 347,
  408, 410,
  564, 566,
  696, 698,
  880, 881, 882, 883,
];

const SPECIAL_COVETED_IDS = [
  131, 132, 133, 138, 140, 142, 147, 213, 214, 222, 226, 236, 241, 246,
  302, 315, 327, 337, 338, 343, 345, 347, 349, 352, 355, 359, 361, 369, 371, 374,
  442, 447, 479,
  // Formas especiais lendárias (Shaymin-Sky, Giratina-Origem)
  10006, 10007,
  531, 561, 564, 566, 570, 594, 615, 618, 621, 633,
  677, 679, 686, 696, 698, 701, 704, 707, 708, 710, 714,
  746, 747, 749, 757, 769, 777, 778, 781, 782,
  840, 848, 854, 868, 870, 871, 874, 875, 877, 880, 881, 882, 883, 884, 885,
  932, 935, 938, 940, 942, 944, 948, 950, 952, 954, 956, 958, 963, 967, 968, 971, 973, 977, 978, 996, 999,
  // Formas Alolan mais cobiçadas (bases)
  10103, // Vulpix-Alola
  10107, // Meowth-Alola
  10112, // Grimer-Alola
  // Formas Galar mais cobiçadas (bases)
  10159, // Ponyta-Galar
  10161, // Slowpoke-Galar
  10163, // Farfetch'd-Galar
  10164, // Weezing-Galar
  10170, // Corsola-Galar
  10175, // Yamask-Galar
  10176, // Stunfisk-Galar
  // Formas Hisui mais cobiçadas (bases)
  10229, // Growlithe-Hisui
  10235, // Sneasel-Hisui
  10238, // Zorua-Hisui
];

const EVENT_FEATURED_IDS = [
  ...STARTER_IDS,
  25, 37, 58, 63, 66, 92, 95, 123, 127, 128, 131, 132, 133, 147,
  172, 175, 179, 196, 197, 200, 207, 215, 216, 227, 236, 246,
  280, 302, 303, 304, 333, 349, 359, 371, 374, 403, 425, 433, 443,
  446, 447, 448, 479, 570, 587, 607, 610, 633, 636, 674, 679, 704,
  708, 714, 744, 747, 778, 782, 840, 848, 854, 856, 868, 872, 877,
  878, 885, 935, 938, 957, 963, 971, 996, 999,
  10103, 10159, 10164, 10170, 10229, 10235, 10238,
];

const EVENT_RARE_IDS = [
  ...PSEUDO_LEGENDARY_BASE_IDS,
  131, 132, 133, 138, 140, 142, 213, 214, 241, 302, 349, 352, 359,
  442, 447, 479, 570, 621, 696, 698, 701, 707, 778, 840, 870, 871,
  874, 875, 967, 977, 978, 999,
];

const PARADOX_IDS = [
  984, 985, 986, 987, 988, 989,
  990, 991, 992, 993, 994, 995,
  1005, 1006,
  1009, 1010,
  1020, 1021, 1022, 1023,
];

// ── Formas regionais separadas por raridade ───────────────────────────────────
// Alolan
const ALOLAN_COMMON_IDS  = [10091, 10101, 10105, 10109, 10112]; // Rattata, Sandshrew, Diglett, Geodude, Grimer
const ALOLAN_RARE_IDS    = [10107];                              // Meowth-Alola
const ALOLAN_SPECIAL_IDS = [10103];                              // Vulpix-Alola

// Galar
const GALAR_COMMON_IDS  = [10158, 10171, 10173, 10176];              // Meowth-G, Zigzagoon-G, Darumaka-G, Stunfisk-G
const GALAR_RARE_IDS    = [10161, 10163, 10165];                     // Slowpoke-G, Farfetch'd-G, Mr. Mime-G
const GALAR_SPECIAL_IDS = [10159, 10164, 10170, 10175];              // Ponyta-G, Weezing-G, Corsola-G, Yamask-G

// Hisui
const HISUI_COMMON_IDS  = [10231, 10234];        // Voltorb-H, Qwilfish-H
const HISUI_RARE_IDS    = [10229, 10235];        // Growlithe-H, Sneasel-H
const HISUI_SPECIAL_IDS = [10238];               // Zorua-H

export const EGG_RATE_PROFILES: Record<string, EggRateProfile> = {
  COMMON: {
    legendaryChance: 0.01,
    buckets: [
      { label: "common_base",    weight: 90, pokemonIds: EGG_POOLS.COMMON },
      { label: "common_good",    weight: 6,  pokemonIds: COMMON_GOOD_IDS },
      { label: "starter_cameo",  weight: 2,  pokemonIds: STARTER_IDS },
      { label: "rare_cameo",     weight: 2,  pokemonIds: [133, 147, 172, 175, 236, 280, 349, 447, 570, 704, 744, 778, 885, 996] },
    ],
  },
  RARE: {
    legendaryChance: 0.035,
    buckets: [
      // A pool completa garante que toda espécie configurada tenha caminho real de drop.
      { label: "rare_full_pool",         weight: 40, pokemonIds: EGG_POOLS.RARE },
      { label: "starter",                weight: 15, pokemonIds: STARTER_IDS },
      { label: "rare_favorite",          weight: 25, pokemonIds: RARE_FAN_FAVORITES },
      { label: "pseudo_legendary_base",  weight: 8,  pokemonIds: PSEUDO_LEGENDARY_BASE_IDS },
      { label: "special_cameo",          weight: 12, pokemonIds: [...FOSSIL_AND_ANCIENT_IDS, ...SPECIAL_COVETED_IDS] },
    ],
  },
  SPECIAL: {
    legendaryChance: 0.065,
    buckets: [
      { label: "special_full_pool",      weight: 30, pokemonIds: EGG_POOLS.SPECIAL },
      { label: "pseudo_legendary_base", weight: 15, pokemonIds: PSEUDO_LEGENDARY_BASE_IDS },
      { label: "special_coveted",        weight: 30, pokemonIds: SPECIAL_COVETED_IDS },
      { label: "paradox",                weight: 15, pokemonIds: PARADOX_IDS },
      { label: "fossil_and_ancient",     weight: 10, pokemonIds: FOSSIL_AND_ANCIENT_IDS },
    ],
  },
  EVENT: {
    legendaryChance: 0.01,
    buckets: [
      { label: "event_full_pool", weight: 82, pokemonIds: EGG_POOLS.RANDOM },
      { label: "event_featured",  weight: 10, pokemonIds: EVENT_FEATURED_IDS },
      { label: "event_rare",      weight: 6,  pokemonIds: EVENT_RARE_IDS },
      { label: "event_starter",   weight: 2,  pokemonIds: STARTER_IDS },
    ],
  },

  // ── Ovos de geração com pesos: nativos > regionais comuns > regionais raros ──
  // Peso total: 100. Regional: ~20% do pool (forma rara ~5%)
  EGG_GEN7: {
    legendaryChance: 0.01,
    buckets: [
      { label: "gen7_native",       weight: 80, pokemonIds: EGG_POOLS.EGG_GEN7.filter((id) => id < 10_000) },
      { label: "gen7_alolan_common",weight: 12, pokemonIds: ALOLAN_COMMON_IDS },
      { label: "gen7_alolan_rare",  weight: 5,  pokemonIds: ALOLAN_RARE_IDS },
      { label: "gen7_alolan_ultra", weight: 3,  pokemonIds: ALOLAN_SPECIAL_IDS },
    ],
  },
  EGG_GEN8: {
    legendaryChance: 0.01,
    buckets: [
      { label: "gen8_native",       weight: 80, pokemonIds: EGG_POOLS.EGG_GEN8.filter((id) => id < 10_000) },
      { label: "gen8_galar_common", weight: 12, pokemonIds: GALAR_COMMON_IDS },
      { label: "gen8_galar_rare",   weight: 5,  pokemonIds: GALAR_RARE_IDS },
      { label: "gen8_galar_ultra",  weight: 3,  pokemonIds: GALAR_SPECIAL_IDS },
    ],
  },

  // ── Ovos temáticos regionais: probabilidade interna ponderada ─────────────
  // Mais comuns têm ~60-65%, raras ~25-30%, ultra-raras ~10-15%
  EGG_ALOLA: {
    legendaryChance: 0.005,
    buckets: [
      { label: "alolan_common",  weight: 60, pokemonIds: ALOLAN_COMMON_IDS },
      { label: "alolan_rare",    weight: 25, pokemonIds: ALOLAN_RARE_IDS },
      { label: "alolan_special", weight: 15, pokemonIds: ALOLAN_SPECIAL_IDS },
    ],
  },
  EGG_GALAR: {
    legendaryChance: 0.01,
    buckets: [
      { label: "galar_common",  weight: 55, pokemonIds: GALAR_COMMON_IDS },
      { label: "galar_rare",    weight: 30, pokemonIds: GALAR_RARE_IDS },
      { label: "galar_special", weight: 15, pokemonIds: GALAR_SPECIAL_IDS },
    ],
  },
  EGG_HISUI: {
    legendaryChance: 0.01,
    buckets: [
      { label: "hisui_common",  weight: 50, pokemonIds: HISUI_COMMON_IDS },
      { label: "hisui_rare",    weight: 35, pokemonIds: HISUI_RARE_IDS },
      { label: "hisui_special", weight: 15, pokemonIds: HISUI_SPECIAL_IDS },
    ],
  },
};

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function uniquePokemonIds(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

function generationForPokemonId(pokemonId: number): number | null {
  if (pokemonId >= 1 && pokemonId <= 151) return 1;
  if (pokemonId <= 251) return 2;
  if (pokemonId <= 386) return 3;
  if (pokemonId <= 493) return 4;
  if (pokemonId <= 649) return 5;
  if (pokemonId <= 721) return 6;
  if (pokemonId <= 809) return 7;
  if (pokemonId <= 905) return 8;
  if (pokemonId <= 1025) return 9;
  // Formas alternativas lendárias usam IDs especiais da PokéAPI.
  if (pokemonId === 10006 || pokemonId === 10007) return 4;
  if ([10166, 10167, 10168].includes(pokemonId)) return 8;
  return null;
}

function requestedGenerations(eggType: string): Set<number> | null {
  if (eggType === "EGG_GEN6PLUS") return new Set([6, 7, 8, 9]);
  const match = /^EGG_GEN([1-9])$/.exec(eggType);
  return match ? new Set([Number(match[1])]) : null;
}

function hatchableLegendaryPool(eggType: string): number[] {
  const allowedGenerations = requestedGenerations(eggType);
  const pool = uniquePokemonIds(
    LEGENDARY_POOL.map((id) => LEGENDARY_HATCH_BASE_OVERRIDES[id] ?? id)
  ).filter((id) => !ALL_EVOLVED_IDS.has(id));
  if (!allowedGenerations) return pool;
  return pool.filter((id) => {
    const generation = generationForPokemonId(id);
    return generation !== null && allowedGenerations.has(generation);
  });
}

function sanitizeNormalEggPool(ids: number[]): number[] {
  return uniquePokemonIds(ids).filter((id) => {
    if (LEGENDARY_POOL.includes(id)) return false;
    if (ALL_EVOLVED_IDS.has(id)) return false;
    // Alternate legendary forms are handled by legendary rolls, not normal buckets.
    if (id === 10006 || id === 10007) return false;
    return true;
  });
}

function pickFromWeightedBuckets(buckets: WeightedEggBucket[]): number {
  const prepared = buckets
    .map((bucket) => ({
      ...bucket,
      pokemonIds: sanitizeNormalEggPool(bucket.pokemonIds),
      weight: Math.max(0, bucket.weight),
    }))
    .filter((bucket) => bucket.weight > 0 && bucket.pokemonIds.length > 0);

  if (prepared.length === 0) {
    const fallbackPool = sanitizeNormalEggPool(EGG_POOLS.RANDOM.length > 0 ? EGG_POOLS.RANDOM : EGG_POOLS.COMMON);
    return randomFrom(fallbackPool);
  }

  const totalWeight = prepared.reduce((sum, bucket) => sum + bucket.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const bucket of prepared) {
    roll -= bucket.weight;
    if (roll <= 0) return randomFrom(bucket.pokemonIds);
  }

  return randomFrom(prepared[prepared.length - 1].pokemonIds);
}

function legendaryChanceForEgg(eggType: string): number {
  const profile = EGG_RATE_PROFILES[eggType];
  if (profile) return profile.legendaryChance;
  if (eggType.startsWith("EGG_GEN")) return 0.01;
  if (eggType === "EVENT") return 0.003;
  return 0.003;
}

function fallbackPoolForEgg(eggType: string): number[] {
  if (eggType === "EVENT") {
    return sanitizeNormalEggPool(EGG_POOLS.EVENT.length > 0 ? EGG_POOLS.EVENT : EGG_POOLS.RANDOM);
  }

  const configuredPool = EGG_POOLS[eggType];
  if (configuredPool?.length) return sanitizeNormalEggPool(configuredPool);

  return sanitizeNormalEggPool(EGG_POOLS.RANDOM.length > 0 ? EGG_POOLS.RANDOM : EGG_POOLS.COMMON);
}

/**
 * Roll a Pokémon from an egg type.
 *
 * COMMON, RARE, SPECIAL e ovos regionais (EGG_GEN7, EGG_GEN8, EGG_ALOLA,
 * EGG_GALAR, EGG_HISUI) usam buckets ponderados.
 * Demais ovos de geração mantêm pool flat com filtro de evoluídos/lendários.
 */
export function rollPokemonIdFromEgg(eggType: string): number {
  if (Math.random() < legendaryChanceForEgg(eggType)) {
    const legendaryPool = hatchableLegendaryPool(eggType);
    if (legendaryPool.length > 0) return randomFrom(legendaryPool);
  }

  const profile = EGG_RATE_PROFILES[eggType];
  if (profile) {
    return pickFromWeightedBuckets(profile.buckets);
  }

  const pool = fallbackPoolForEgg(eggType);
  return randomFrom(pool);
}

/**
 * Preview helper for admin UI.
 * Returns configured rates without affecting actual random rolls.
 */
export function getEggRatePreview(eggType: string) {
  const profile = EGG_RATE_PROFILES[eggType];

  if (!profile) {
    return {
      legendaryChance: legendaryChanceForEgg(eggType),
      buckets: [{ label: eggType, weight: 1, count: fallbackPoolForEgg(eggType).length }],
    };
  }

  return {
    legendaryChance: profile.legendaryChance,
    buckets: profile.buckets.map((bucket) => ({
      label: bucket.label,
      weight: bucket.weight,
      count: sanitizeNormalEggPool(bucket.pokemonIds).length,
    })),
  };
}
