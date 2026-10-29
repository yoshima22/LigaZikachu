import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowExpeditionCancellation, shouldShowExpeditionStatus } from "./mascot-expedition-visibility";

test("hides the blue expedition status after the reward becomes claimable", () => {
  assert.equal(shouldShowExpeditionStatus(true), false);
});

test("keeps the blue expedition status while time remains", () => {
  assert.equal(shouldShowExpeditionStatus(false), true);
});

test("hides expedition cancellation after the reward becomes claimable", () => {
  assert.equal(shouldShowExpeditionCancellation(true), false);
});
