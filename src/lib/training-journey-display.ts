type MilestoneDetails = { label?: unknown; perBattleCap?: unknown } | null | undefined;

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

  return {
    label,
    progressLabel: `${value}/${milestone.target}`,
    perBattleCapLabel: cap,
    complete: value >= milestone.target,
  };
}
