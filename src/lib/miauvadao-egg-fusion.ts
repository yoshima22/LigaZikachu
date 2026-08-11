// Ordem oficial de raridade (menor → maior): Comum < Raro < Evento < Especial < Laboratório.
// A ordem deste array É a escala de tiers (índice = tier), então precisa respeitar a sequência.
export const MIAUVADAO_FUSION_EGG_TYPES = ["COMMON", "RARE", "EVENT", "SPECIAL"] as const;
export type MiauvadaoFusionEggType = typeof MIAUVADAO_FUSION_EGG_TYPES[number];
export type MiauvadaoFusionResult = "BROKEN" | MiauvadaoFusionEggType | "LAB";

/** Um ovo individual elegível para a Máquina de Fusão (seleção por ovo específico). */
export type MiauvadaoFusionEgg = {
  id: string;
  type: MiauvadaoFusionEggType;
  hatchRarityBonusPct: number;
  obtainedAt: string;
  origin: string | null;
};
export const MIAUVADAO_FUSION_HATCH_BONUS_CHANCES = [
  { bonusPct: 0, chancePct: 62 },
  { bonusPct: 1, chancePct: 23 },
  { bonusPct: 2, chancePct: 10 },
  { bonusPct: 3, chancePct: 4 },
  { bonusPct: 4, chancePct: 1 },
] as const;

const TIER_SCORE: Record<MiauvadaoFusionEggType, number> = {
  COMMON: 0,
  RARE: 1,
  EVENT: 2,
  SPECIAL: 3,
};

// ANCHORS[i] = distribuição de resultado quando a média dos ingredientes é o tier i
// (0=Comum, 1=Raro, 2=Evento, 3=Especial). Em cada faixa, raridades mais altas são
// menos prováveis, e o pico acompanha a qualidade dos ingredientes — respeitando
// Comum < Raro < Evento < Especial < Laboratório.
const ANCHORS: Array<Record<MiauvadaoFusionResult, number>> = [
  { BROKEN: 50, COMMON: 30, RARE: 10, EVENT: 7, SPECIAL: 2.8, LAB: 0.2 },
  { BROKEN: 42, COMMON: 18, RARE: 20, EVENT: 14, SPECIAL: 5, LAB: 1 },
  { BROKEN: 35, COMMON: 8, RARE: 12, EVENT: 25, SPECIAL: 15, LAB: 5 },
  { BROKEN: 25, COMMON: 3, RARE: 5, EVENT: 10, SPECIAL: 42, LAB: 15 },
];

const BREAK_CHANCE_MULTIPLIER = 0.35;

export function getMiauvadaoFusionChances(eggTypes: MiauvadaoFusionEggType[]) {
  const average = eggTypes.length
    ? eggTypes.reduce((sum, type) => sum + TIER_SCORE[type], 0) / eggTypes.length
    : 0;
  const low = Math.floor(average);
  const high = Math.min(3, Math.ceil(average));
  const fraction = average - low;
  const results = {} as Record<MiauvadaoFusionResult, number>;
  for (const result of ["BROKEN", "COMMON", "RARE", "EVENT", "SPECIAL", "LAB"] as const) {
    results[result] = ANCHORS[low][result] + (ANCHORS[high][result] - ANCHORS[low][result]) * fraction;
  }

  // A quebra foi reduzida em aproximadamente 65%. A chance retirada dela
  // retorna integralmente como ovo da faixa mais próxima à média dos
  // ingredientes. Assim, arriscar ovos bons continua oferecendo progressão,
  // mas uma falha parcial tende a preservar o investimento do jogador.
  const originalBrokenChance = results.BROKEN;
  const reducedBrokenChance = Math.round(originalBrokenChance * BREAK_CHANCE_MULTIPLIER);
  const equivalentResult = MIAUVADAO_FUSION_EGG_TYPES[Math.round(average)];
  results[equivalentResult] += originalBrokenChance - reducedBrokenChance;
  results.BROKEN = reducedBrokenChance;

  return results;
}

export function rollMiauvadaoFusion(
  eggTypes: MiauvadaoFusionEggType[],
  random = Math.random,
): MiauvadaoFusionResult {
  const chances = getMiauvadaoFusionChances(eggTypes);
  let roll = random() * 100;
  for (const result of ["BROKEN", "COMMON", "RARE", "EVENT", "SPECIAL", "LAB"] as const) {
    roll -= chances[result];
    if (roll < 0) return result;
  }
  return "BROKEN";
}

export function getFusionHatchBonusRange(
  eggTypes: MiauvadaoFusionEggType[],
  result: MiauvadaoFusionResult,
): readonly [number, number] {
  if (result === "BROKEN") return [0, 0];
  const sameTierReturn = eggTypes.length === 3
    && eggTypes.every((type) => type === eggTypes[0])
    && result === eggTypes[0];
  if (sameTierReturn) return [5, 10];

  const ingredientAverage = eggTypes.reduce((sum, type) => sum + TIER_SCORE[type], 0) / eggTypes.length;
  const resultScore = result === "LAB" ? 4 : TIER_SCORE[result];
  const downgrade = ingredientAverage - resultScore;
  if (downgrade <= 0) return [0, 4];
  if (downgrade <= 1) return [5, 10];
  if (downgrade <= 2) return [8, 15];
  return [12, 20];
}

export function rollFusionLootBonus(
  eggTypes: MiauvadaoFusionEggType[],
  result: MiauvadaoFusionResult,
  random = Math.random,
) {
  const [minimum, maximum] = getFusionHatchBonusRange(eggTypes, result);
  if (maximum > 4) {
    return minimum + Math.floor(random() * (maximum - minimum + 1));
  }
  let roll = random() * 100;
  for (const outcome of MIAUVADAO_FUSION_HATCH_BONUS_CHANCES) {
    roll -= outcome.chancePct;
    if (roll < 0) return outcome.bonusPct;
  }
  return 0;
}
