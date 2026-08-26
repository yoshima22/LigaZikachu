/**
 * Sorteio de mascotes por ovo.
 *
 * Ordem oficial:
 * 1. define a geração;
 * 2. sorteia a categoria de raridade usando o tipo do ovo;
 * 3. escolhe uma forma inicial daquela categoria e geração;
 * 4. reduz, sem zerar, o peso de espécies repetidas na conta.
 *
 * O tipo do ovo nunca restringe espécies. Ele controla apenas as chances das
 * categorias e o range de atributos aplicado pelo serviço de incubação.
 */

import {
  ALL_EVOLVED_IDS,
  EGG_POOLS,
  EVOLUTION_REVERSE_MAP,
  LEGENDARY_HATCH_BASE_OVERRIDES,
  LEGENDARY_POOL,
  getMascotRarity,
} from "@/lib/mascot-data";
import { EXTRA_FORM_GENERATION } from "@/lib/extra-forms-data";
import { MEGA_FORM_IDS } from "@/lib/mega-evolution";

export type EggPokemonTier = "COMMON" | "PSEUDO_LEGENDARY" | "PARADOX" | "ELITE";

type WeightedEggBucket = {
  label: string;
  weight: number;
  pokemonIds: number[];
};

export type EggRateProfile = {
  legendaryChance: number;
  tierWeights: Record<EggPokemonTier, number>;
  /** Compatibilidade com relatórios administrativos existentes. */
  buckets: WeightedEggBucket[];
};

export type EggRollResult = {
  pokemonId: number;
  generation: number;
  generationType: string;
  tier: EggPokemonTier;
};

export type EggRollOptions = {
  generationType?: string | null;
  rarityBonusPct?: number;
  randomGenerationBonus?: boolean;
  ownedBaseCounts?: ReadonlyMap<number, number> | Record<number, number>;
  excludedPokemonIds?: Iterable<number>;
  random?: () => number;
};

const GENERATION_TYPES = Array.from({ length: 9 }, (_, index) => `EGG_GEN${index + 1}`);
const ELITE_RARITIES = new Set(["LEGENDARY", "MYTHICAL", "ULTRA_BEAST"]);

function uniquePokemonIds(ids: number[]) {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
}

function eliteInitialForms() {
  return uniquePokemonIds(LEGENDARY_POOL.map((id) => LEGENDARY_HATCH_BASE_OVERRIDES[id] ?? id))
    .filter((id) => !ALL_EVOLVED_IDS.has(id));
}

function generationForSpecialPokemonId(pokemonId: number): number | null {
  if (pokemonId === 10006 || pokemonId === 10007) return 4;
  if (pokemonId >= 10091 && pokemonId <= 10115) return 7;
  if (pokemonId >= 10158 && pokemonId <= 10180) return 8;
  if (pokemonId >= 10229 && pokemonId <= 10244) return 8;
  // Formas alternativas adicionadas + Unown (dados gerados).
  if (EXTRA_FORM_GENERATION[pokemonId]) return EXTRA_FORM_GENERATION[pokemonId];
  return null;
}

export function generationForEggPokemon(pokemonId: number): number | null {
  if (pokemonId >= 1 && pokemonId <= 151) return 1;
  if (pokemonId <= 251) return 2;
  if (pokemonId <= 386) return 3;
  if (pokemonId <= 493) return 4;
  if (pokemonId <= 649) return 5;
  if (pokemonId <= 721) return 6;
  if (pokemonId <= 809) return 7;
  if (pokemonId <= 905) return 8;
  if (pokemonId <= 1025) return 9;
  return generationForSpecialPokemonId(pokemonId);
}

export function getInitialPokemonId(pokemonId: number) {
  let current = pokemonId;
  const visited = new Set<number>();
  while (!visited.has(current)) {
    visited.add(current);
    const previous = EVOLUTION_REVERSE_MAP.get(current)?.[0];
    if (!previous) break;
    current = previous.from;
  }
  return current;
}

export function tierForPokemon(pokemonId: number): EggPokemonTier {
  const rarity = getMascotRarity(pokemonId);
  if (ELITE_RARITIES.has(rarity)) return "ELITE";
  if (rarity === "PSEUDO_LEGENDARY") return "PSEUDO_LEGENDARY";
  if (rarity === "PARADOX") return "PARADOX";
  return "COMMON";
}

function candidatesForGeneration(generation: number) {
  const generationPool = EGG_POOLS[`EGG_GEN${generation}`] ?? [];
  const elitePool = eliteInitialForms().filter((id) => generationForEggPokemon(id) === generation);
  // Evoluções nunca vêm em ovo — inclui as formas MEGA (oficiais e custom):
  // megas só são obtidos usando a pedra correspondente, nunca por drop.
  return uniquePokemonIds([...generationPool, ...elitePool])
    .filter((id) => !ALL_EVOLVED_IDS.has(id) && !MEGA_FORM_IDS.has(id));
}

export function getEggCandidatesForGeneration(generation: number, tier?: EggPokemonTier) {
  const candidates = candidatesForGeneration(generation);
  return tier ? candidates.filter((id) => tierForPokemon(id) === tier) : candidates;
}

const ALL_INITIAL_CANDIDATES = uniquePokemonIds(
  GENERATION_TYPES.flatMap((type) => EGG_POOLS[type] ?? []).concat(eliteInitialForms()),
).filter((id) => !ALL_EVOLVED_IDS.has(id));

const PROFILE_WEIGHTS: Record<"COMMON" | "EVENT" | "RARE" | "SPECIAL" | "LAB", Record<EggPokemonTier, number>> = {
  // Mantém, de forma explícita e sem sobreposição, as massas aproximadas que
  // as antigas subpools produziam de maneira indireta.
  COMMON:  { COMMON: 92,   PSEUDO_LEGENDARY: 3,   PARADOX: 4,    ELITE: 1 },
  EVENT:   { COMMON: 91.5, PSEUDO_LEGENDARY: 4,   PARADOX: 3.5,  ELITE: 1 },
  RARE:    { COMMON: 83.5, PSEUDO_LEGENDARY: 9,   PARADOX: 4,    ELITE: 3.5 },
  SPECIAL: { COMMON: 58.5, PSEUDO_LEGENDARY: 18.5, PARADOX: 16.5, ELITE: 6.5 },
  LAB:     { COMMON: 73,   PSEUDO_LEGENDARY: 7,   PARADOX: 10,   ELITE: 10 },
};

function profileKeyForEgg(eggType: string): keyof typeof PROFILE_WEIGHTS {
  if (eggType === "LAB" || eggType === "EGG_LAB") return "LAB";
  if (eggType === "SPECIAL" || eggType === "EGG_SPECIAL") return "SPECIAL";
  if (eggType === "RARE" || eggType === "EGG_RARE") return "RARE";
  if (eggType === "EVENT" || eggType === "EGG_EVENT") return "EVENT";
  return "COMMON";
}

function compatibilityBuckets(weights: Record<EggPokemonTier, number>): WeightedEggBucket[] {
  return (Object.entries(weights) as Array<[EggPokemonTier, number]>).map(([tier, weight]) => ({
    label: tier.toLowerCase(),
    weight,
    pokemonIds: ALL_INITIAL_CANDIDATES.filter((id) => tierForPokemon(id) === tier),
  }));
}

export const EGG_RATE_PROFILES: Record<string, EggRateProfile> = Object.fromEntries(
  Object.entries(PROFILE_WEIGHTS).map(([key, tierWeights]) => [key, {
    legendaryChance: tierWeights.ELITE / 100,
    tierWeights,
    buckets: compatibilityBuckets(tierWeights),
  }]),
);

for (const generationType of [...GENERATION_TYPES, "EGG_GEN6PLUS", "EGG_ALOLA", "EGG_GALAR", "EGG_HISUI"]) {
  EGG_RATE_PROFILES[generationType] = EGG_RATE_PROFILES.COMMON;
}

function resolveGenerationType(generationType: string | null | undefined, random: () => number) {
  if (generationType === "EGG_GEN6PLUS") {
    return `EGG_GEN${6 + Math.floor(random() * 4)}`;
  }
  const match = /^EGG_GEN([1-9])$/.exec(generationType ?? "");
  if (match) return `EGG_GEN${match[1]}`;
  return GENERATION_TYPES[Math.floor(random() * GENERATION_TYPES.length)];
}

function weightsWithBonus(profile: Record<EggPokemonTier, number>, bonusPct: number) {
  const bonus = Math.max(0, Math.min(20, bonusPct));
  return {
    ...profile,
    COMMON: Math.max(0, profile.COMMON - bonus),
    ELITE: Math.min(100, profile.ELITE + bonus),
  };
}

/**
 * Distribuição efetiva usada por uma geração já definida.
 * Categorias inexistentes naquela geração retornam para COMMON, exatamente
 * como acontece no sorteio real de `rollEggPokemon`.
 */
export function getEggTierWeightsForGeneration(
  eggType: string,
  generation: number,
  rarityBonusPct = 0,
  randomGenerationBonus = false,
) {
  const profile = PROFILE_WEIGHTS[profileKeyForEgg(eggType)];
  const adjusted = weightsWithBonus(profile, rarityBonusPct + (randomGenerationBonus ? 1 : 0));
  const effective = { ...adjusted };

  for (const tier of ["PSEUDO_LEGENDARY", "PARADOX", "ELITE"] as EggPokemonTier[]) {
    if (getEggCandidatesForGeneration(generation, tier).length === 0) {
      effective.COMMON += effective[tier];
      effective[tier] = 0;
    }
  }

  return { adjusted, effective };
}

function rollTier(weights: Record<EggPokemonTier, number>, random: () => number): EggPokemonTier {
  const entries = Object.entries(weights) as Array<[EggPokemonTier, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let roll = random() * total;
  for (const [tier, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return tier;
  }
  return "COMMON";
}

function ownedCount(counts: EggRollOptions["ownedBaseCounts"], pokemonId: number) {
  if (!counts) return 0;
  if (typeof (counts as ReadonlyMap<number, number>).get === "function") {
    return (counts as ReadonlyMap<number, number>).get(pokemonId) ?? 0;
  }
  return (counts as Record<number, number>)[pokemonId] ?? 0;
}

/** Proteção suave: nunca zera uma espécie, apenas diminui repetições excessivas. */
export function eggDuplicateWeight(copies: number) {
  if (copies <= 0) return 1;
  if (copies === 1) return 0.65;
  if (copies === 2) return 0.4;
  if (copies === 3) return 0.25;
  if (copies === 4) return 0.15;
  return 0.08;
}

function weightedSpeciesChoice(
  candidates: number[],
  counts: EggRollOptions["ownedBaseCounts"],
  random: () => number,
) {
  const prepared = candidates.map((pokemonId) => ({
    pokemonId,
    weight: eggDuplicateWeight(ownedCount(counts, pokemonId)),
  }));
  const total = prepared.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of prepared) {
    roll -= item.weight;
    if (roll <= 0) return item.pokemonId;
  }
  return prepared[prepared.length - 1].pokemonId;
}

export function rollEggPokemon(eggType: string, options: EggRollOptions = {}): EggRollResult {
  const random = options.random ?? Math.random;
  const generationFromEggType = /^EGG_GEN(?:[1-9]|6PLUS)$/.test(eggType) ? eggType : null;
  const generationType = resolveGenerationType(options.generationType ?? generationFromEggType, random);
  const generation = Number(generationType.replace("EGG_GEN", ""));
  const profile = PROFILE_WEIGHTS[profileKeyForEgg(eggType)];
  const extraBonus = (options.rarityBonusPct ?? 0) + (options.randomGenerationBonus ? 1 : 0);
  const requestedTier = rollTier(weightsWithBonus(profile, extraBonus), random);
  const excluded = new Set(options.excludedPokemonIds ?? []);
  const generationCandidates = candidatesForGeneration(generation).filter((id) => !excluded.has(id));
  let candidates = generationCandidates.filter((id) => tierForPokemon(id) === requestedTier);
  let tier = requestedTier;

  // Paradoxais existem apenas nas gerações que os contêm. Se a categoria não
  // existir na geração sorteada, a parcela volta para formas comuns, sem elevar
  // artificialmente a chance lendária.
  if (candidates.length === 0) {
    tier = "COMMON";
    candidates = generationCandidates.filter((id) => tierForPokemon(id) === "COMMON");
  }
  if (candidates.length === 0) {
    candidates = generationCandidates;
  }
  if (candidates.length === 0) throw new Error(`A geração ${generation} não possui formas iniciais elegíveis.`);

  return {
    pokemonId: weightedSpeciesChoice(candidates, options.ownedBaseCounts, random),
    generation,
    generationType,
    tier,
  };
}

/** Compatibilidade para chamadas antigas e scripts de auditoria. */
export function rollPokemonIdFromEgg(eggType: string, rarityBonusPct = 0): number {
  return rollEggPokemon(eggType, { rarityBonusPct }).pokemonId;
}

export function getEggRatePreview(eggType: string) {
  const profile = PROFILE_WEIGHTS[profileKeyForEgg(eggType)];
  return {
    legendaryChance: profile.ELITE / 100,
    tiers: profile,
    buckets: compatibilityBuckets(profile).map((bucket) => ({
      label: bucket.label,
      weight: bucket.weight,
      count: bucket.pokemonIds.length,
    })),
  };
}
