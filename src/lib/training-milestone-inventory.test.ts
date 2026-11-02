import assert from "node:assert/strict";
import test from "node:test";
import { getTrainingMilestoneInventoryItems } from "./training-milestone-inventory";

test("keeps purchasable posture Marcos visible and excludes unavailable units", () => {
  const items = getTrainingMilestoneInventoryItems([
    { quantity: 3, boundQuantity: 1, item: { id: "executor", name: "Marco de Postura - Executor", type: "TRAINING_MILESTONE_EXECUTOR", imageUrl: "/items/marco.png" } },
    { quantity: 1, boundQuantity: 1, item: { id: "bound", name: "Marco de Postura - Comandante", type: "TRAINING_MILESTONE_COMMANDER", imageUrl: "/items/marco.png" } },
    { quantity: 2, boundQuantity: 0, item: { id: "food", name: "Comida", type: "MASCOT_FOOD", imageUrl: null } },
  ]);

  assert.deepEqual(items, [{
    id: "executor",
    name: "Marco de Postura - Executor",
    type: "TRAINING_MILESTONE_EXECUTOR",
    imageUrl: "/items/marco.png",
    quantity: 2,
  }]);
});
