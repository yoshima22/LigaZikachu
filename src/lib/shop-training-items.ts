/** Shop-facing filter kept separate so Marcos never disappear into Mascot items. */
export function getTrainingMilestoneShopItems<T extends { type: string }>(items: T[]) {
  return items.filter((item) => item.type.startsWith("TRAINING_MILESTONE_"));
}
