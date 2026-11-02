import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainingLabView } from "./training-milestones-lab-view";

test("builds an admin-only Purifier preview with the dynamic item name and long affinity goal", () => {
  const view = buildTrainingLabView({ stance: "PURIFIER", personality: "LOYAL", seed: 7, focusA: 125, focusB: 125 });

  assert.equal(view.itemName, "Marco de Postura - Purificador");
  assert.equal(view.persistenceNotice, "Simulação local — não cria item, não consome ZC e não libera postura.");
  assert.ok(view.objectives.length >= 5 && view.objectives.length <= 7);
  assert.equal(view.objectives.find((objective) => objective.type === "AFFINITY")?.target, 30);
  assert.match(view.effectPreview, /50%/);
});
