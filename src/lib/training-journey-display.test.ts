import assert from "node:assert/strict";
import test from "node:test";
import { getTrainingMilestoneDisplay } from "./training-journey-display";

test("shows the saved objective, progress, and battle cap for an active milestone", () => {
  assert.deepEqual(
    getTrainingMilestoneDisplay({
      milestoneKey: "kos-3",
      value: 7,
      target: 20,
      details: { label: "Aplique 20 K.O.s.", perBattleCap: 2 },
    }),
    { label: "Aplique 20 K.O.s.", progressLabel: "7/20", perBattleCapLabel: "Máx. 2 por combate", complete: false },
  );
});

test("uses a safe label when a legacy milestone has no saved description", () => {
  const result = getTrainingMilestoneDisplay({ milestoneKey: "legacy", value: 4, target: 4, details: null });
  assert.equal(result.label, "Objetivo de treinamento");
  assert.equal(result.complete, true);
});
