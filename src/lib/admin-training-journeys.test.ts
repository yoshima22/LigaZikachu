import assert from "node:assert/strict";
import test from "node:test";
import { getAdminTrainingCompletionPlan } from "./admin-training-journeys";

test("targets only the requested milestone without marking the journey complete early", () => {
  const plan = getAdminTrainingCompletionPlan([
    { milestoneKey: "arena", value: 1, target: 6 },
    { milestoneKey: "kos", value: 5, target: 20 },
  ], "kos");
  assert.deepEqual(plan, { milestoneKeys: ["kos"], completesJourney: false });
});

test("finishing all objectives completes the journey", () => {
  const plan = getAdminTrainingCompletionPlan([
    { milestoneKey: "arena", value: 6, target: 6 },
    { milestoneKey: "kos", value: 5, target: 20 },
  ], "ALL");
  assert.deepEqual(plan, { milestoneKeys: ["arena", "kos"], completesJourney: true });
});
