import { TRAINING_STANCE_KEYS, type TrainingStanceKey } from "./training-milestones";

export type TrainingMilestoneValue = { milestoneKey: string; target: number; value: number };

/** Pure, bounded counter used by the transaction layer and the simulator. */
export function applyTrainingProgress(
  milestones: TrainingMilestoneValue[],
  increments: Record<string, number>,
): TrainingMilestoneValue[] {
  return milestones.map((milestone) => ({
    ...milestone,
    value: Math.min(milestone.target, milestone.value + Math.max(0, Math.floor(increments[milestone.milestoneKey] ?? 0))),
  }));
}

export function completeTrainingJourney(milestones: TrainingMilestoneValue[]) {
  return milestones.length > 0 && milestones.every((milestone) => milestone.value >= milestone.target);
}

export function isTrainingStance(role: string): role is TrainingStanceKey {
  return (TRAINING_STANCE_KEYS as readonly string[]).includes(role);
}

export function canSelectTrainingStance(role: string, unlockedStances: readonly string[]) {
  return !isTrainingStance(role) || unlockedStances.includes(role);
}
