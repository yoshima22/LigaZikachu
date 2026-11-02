export type AdminTrainingMilestone = { milestoneKey: string; value: number; target: number };

export function getAdminTrainingCompletionPlan(milestones: AdminTrainingMilestone[], milestoneKey: string) {
  const milestoneKeys = milestoneKey === "ALL"
    ? milestones.map((milestone) => milestone.milestoneKey)
    : milestones.some((milestone) => milestone.milestoneKey === milestoneKey) ? [milestoneKey] : [];
  const completesJourney = milestoneKey === "ALL"
    ? milestones.length > 0
    : milestones.length > 0 && milestones.every((milestone) => milestone.milestoneKey === milestoneKey || milestone.value >= milestone.target);
  return { milestoneKeys, completesJourney };
}
