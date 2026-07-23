export const MIAUVADAO_FUSION_EGG_TYPES = ["COMMON", "EVENT", "RARE", "SPECIAL"] as const;
export type MiauvadaoFusionEggType = typeof MIAUVADAO_FUSION_EGG_TYPES[number];
export type MiauvadaoFusionResult = "BROKEN" | MiauvadaoFusionEggType | "LAB";
export const MIAUVADAO_FUSION_HATCH_BONUS_CHANCES = [
  { bonusPct: 0, chancePct: 62 },
  { bonusPct: 1, chancePct: 23 },
  { bonusPct: 2, chancePct: 10 },
  { bonusPct: 3, chancePct: 4 },
  { bonusPct: 4, chancePct: 1 },
] as const;

const TIER_SCORE: Record<MiauvadaoFusionEggType, number> = {
  COMMON: 0,
  EVENT: 1,
  RARE: 2,
  SPECIAL: 3,
};

const ANCHORS: Array<Record<MiauvadaoFusionResult, number>> = [
  { BROKEN: 55, COMMON: 32, EVENT: 8, RARE: 4, SPECIAL: 0.95, LAB: 0.05 },
  { BROKEN: 45, COMMON: 20, EVENT: 20, RARE: 11, SPECIAL: 3.5, LAB: 0.5 },
  { BROKEN: 34, COMMON: 8, EVENT: 17, RARE: 28, SPECIAL: 11.5, LAB: 1.5 },
  { BROKEN: 20, COMMON: 2, EVENT: 5, RARE: 16, SPECIAL: 53, LAB: 4 },
];

export function getMiauvadaoFusionChances(eggTypes: MiauvadaoFusionEggType[]) {
  const average = eggTypes.length
    ? eggTypes.reduce((sum, type) => sum + TIER_SCORE[type], 0) / eggTypes.length
    : 0;
  const low = Math.floor(average);
  const high = Math.min(3, Math.ceil(average));
  const fraction = average - low;
  const results = {} as Record<MiauvadaoFusionResult, number>;
  for (const result of ["BROKEN", "COMMON", "EVENT", "RARE", "SPECIAL", "LAB"] as const) {
    results[result] = ANCHORS[low][result] + (ANCHORS[high][result] - ANCHORS[low][result]) * fraction;
  }
  return results;
}

export function rollMiauvadaoFusion(
  eggTypes: MiauvadaoFusionEggType[],
  random = Math.random,
): MiauvadaoFusionResult {
  const chances = getMiauvadaoFusionChances(eggTypes);
  let roll = random() * 100;
  for (const result of ["BROKEN", "COMMON", "EVENT", "RARE", "SPECIAL", "LAB"] as const) {
    roll -= chances[result];
    if (roll < 0) return result;
  }
  return "BROKEN";
}

export function rollFusionLootBonus(random = Math.random) {
  let roll = random() * 100;
  for (const outcome of MIAUVADAO_FUSION_HATCH_BONUS_CHANCES) {
    roll -= outcome.chancePct;
    if (roll < 0) return outcome.bonusPct;
  }
  return 0;
}
