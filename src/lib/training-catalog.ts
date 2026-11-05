import { TRAINING_STANCE_KEYS, TRAINING_STANCES, type TrainingStanceKey } from "./training-milestones";

export type TrainingMilestoneItem = {
  stanceKey: TrainingStanceKey;
  stanceName: string;
  type: `TRAINING_MILESTONE_${TrainingStanceKey}`;
  name: string;
  imageUrl: string;
  price: number;
  tradeable: true;
  metadata: { stanceKey: TrainingStanceKey; catalogVersion: 1 };
};

export const TRAINING_MILESTONE_ITEMS: TrainingMilestoneItem[] = TRAINING_STANCE_KEYS.map((stanceKey) => {
  const stanceName = TRAINING_STANCES[stanceKey].label;
  return { stanceKey, stanceName, type: `TRAINING_MILESTONE_${stanceKey}`, name: `Marco de Postura - ${stanceName}`, imageUrl: "/items/marco-de-postura.webp", price: 5000, tradeable: true, metadata: { stanceKey, catalogVersion: 1 } };
});

export function isTrainingMilestoneItemType(type: string): boolean {
  return type.startsWith("TRAINING_MILESTONE_");
}
