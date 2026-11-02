import assert from "node:assert/strict";
import test from "node:test";
import { getTrainingMilestoneShopItems } from "./shop-training-items";

test("selects only posture Marcos for the dedicated shop section", () => {
  const items = getTrainingMilestoneShopItems([
    { id: "marco", type: "TRAINING_MILESTONE_EXECUTOR" },
    { id: "food", type: "MASCOT_FOOD" },
    { id: "ticket", type: "ZIKALOOT_TICKET" },
  ]);
  assert.deepEqual(items.map((item) => item.id), ["marco"]);
});
