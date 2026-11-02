type MilestoneDetails = { label?: unknown; perBattleCap?: unknown; modes?: Record<string, number>; type?: unknown } | null | undefined;

const MODE_LABELS: Record<string, string> = { STANDARD: "Padrão", TRAINING: "Treino", ITEMS: "Itens" };

const TRAINING_STANCE_LABELS: Record<string, string> = {
  EXECUTOR: "Executor", COMMANDER: "Comandante", PURIFIER: "Purificador", BLOODTHIRSTY: "Sanguinário",
  ARTILLERY: "Artilheiro", RETRIBUTOR: "Revidador", CORROSIVE: "Corrosivo", STRATEGIST: "Estrategista",
  UNSHAKABLE: "Inabalável", FORTRESS: "Fortaleza", ACCUMULATOR: "Acumulador", EXPLOSIVE: "Explosivo", TRAPPER: "Armadilheiro",
};

export function getUnlockedTrainingStances(stanceKeys: readonly string[]) {
  return stanceKeys.flatMap((stanceKey) => TRAINING_STANCE_LABELS[stanceKey] ? [TRAINING_STANCE_LABELS[stanceKey]] : []);
}

export function getTrainingMilestoneDisplay(milestone: {
  milestoneKey: string;
  value: number;
  target: number;
  details: unknown;
}) {
  const details: MilestoneDetails = milestone.details && typeof milestone.details === "object" && !Array.isArray(milestone.details)
    ? milestone.details as MilestoneDetails
    : null;
  const value = Math.min(milestone.target, Math.max(0, milestone.value));
  const label = typeof details?.label === "string" && details.label.trim()
    ? details.label
    : "Objetivo de treinamento";
  const cap = typeof details?.perBattleCap === "number" && details.perBattleCap > 0
    ? `Máx. ${details.perBattleCap} por combate`
    : null;

  const breakdown = details?.type === "EXPEDITIONS"
    ? Object.entries(MODE_LABELS).map(([mode, modeLabel]) => {
        const count = details.modes?.[mode] ?? 0;
        return { label: modeLabel, count: Math.min(count, 6), target: 6, done: count >= 6 };
      })
    : null;

  return {
    breakdown,
    label,
    progressLabel: `${value}/${milestone.target}`,
    perBattleCapLabel: cap,
    complete: value >= milestone.target,
  };
}
