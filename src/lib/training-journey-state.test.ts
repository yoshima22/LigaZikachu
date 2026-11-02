import assert from "node:assert/strict";
import test from "node:test";
import { applyTrainingProgress, canSelectTrainingStance, completeTrainingJourney } from "./training-journey-state";
import { buildTrainingJourney } from "./training-milestones";

test("progress caps each milestone and only unlocks after every target", () => {
  const progress = [
    { milestoneKey: "a", target: 2, value: 1 },
    { milestoneKey: "b", target: 3, value: 3 },
  ];
  const after = applyTrainingProgress(progress, { a: 10, b: 1 });
  assert.deepEqual(after, [
    { milestoneKey: "a", target: 2, value: 2 },
    { milestoneKey: "b", target: 3, value: 3 },
  ]);
  assert.equal(completeTrainingJourney(after), true);
});

test("locked training stances cannot be selected until mascot-specific unlock", () => {
  assert.equal(canSelectTrainingStance("EXECUTOR", []), false);
  assert.equal(canSelectTrainingStance("EXECUTOR", ["EXECUTOR"]), true);
  assert.equal(canSelectTrainingStance("ATTACKER", []), true);
});

test("simulation completes a seven-milestone journey only on its final target", () => {
  const journey = buildTrainingJourney({ stance: "EXECUTOR", personality: "COMPETITIVE", seed: 42 });
  const initial = journey.objectives.map((objective) => ({ milestoneKey: objective.id, target: objective.target, value: 0 }));
  const almost = applyTrainingProgress(initial, Object.fromEntries(initial.slice(0, -1).map((m) => [m.milestoneKey, m.target])));
  assert.equal(completeTrainingJourney(almost), false);
  const done = applyTrainingProgress(almost, { [initial.at(-1)!.milestoneKey]: initial.at(-1)!.target });
  assert.equal(completeTrainingJourney(done), true);
});
