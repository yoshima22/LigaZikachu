import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowExpeditionStatus } from "./mascot-expedition-visibility";

test("hides the blue expedition status after the reward becomes claimable", () => {
  assert.equal(shouldShowExpeditionStatus(true), false);
});

test("keeps the blue expedition status while time remains", () => {
  assert.equal(shouldShowExpeditionStatus(false), true);
});
