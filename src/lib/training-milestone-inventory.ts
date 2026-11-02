import { isTrainingMilestoneItemType } from "./training-catalog";

type InventoryRow = {
  quantity: number;
  boundQuantity: number;
  item: { id: string; name: string; type: string; imageUrl: string | null };
};

export type TrainingMilestoneInventoryItem = {
  id: string;
  name: string;
  type: string;
  imageUrl: string | null;
  quantity: number;
};

/** Returns only tradable Marcos that can actually activate a training journey. */
export function getTrainingMilestoneInventoryItems(rows: InventoryRow[]): TrainingMilestoneInventoryItem[] {
  return rows.flatMap((row) => {
    const quantity = Math.max(0, row.quantity - row.boundQuantity);
    if (!isTrainingMilestoneItemType(row.item.type) || quantity === 0) return [];
    return [{ ...row.item, quantity }];
  });
}
