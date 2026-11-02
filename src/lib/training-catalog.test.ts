import assert from "node:assert/strict";
import test from "node:test";
import { TRAINING_MILESTONE_ITEMS } from "./training-catalog";

test("creates all tradable posture Marcos at the approved full price", () => {
  assert.equal(TRAINING_MILESTONE_ITEMS.length, 13);
  assert.equal(new Set(TRAINING_MILESTONE_ITEMS.map((item) => item.stanceKey)).size, 13);
  for (const item of TRAINING_MILESTONE_ITEMS) {
    assert.equal(item.price, 5000);
    assert.equal(item.name, `Marco de Postura - ${item.stanceName}`);
    assert.equal(item.imageUrl, "/items/marco-de-postura.png");
    assert.equal(item.tradeable, true);
  }
});
