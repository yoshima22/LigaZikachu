import assert from "node:assert/strict";
import test from "node:test";
import { normalizeArenaDraftPosture } from "./arena-draft";

test("normalizes persisted posture to the closed Draft posture set", () => {
  assert.equal(normalizeArenaDraftPosture("DEFENDER"), "DEFENDER");
  assert.equal(normalizeArenaDraftPosture("EXECUTOR"), "ATTACKER");
  assert.equal(normalizeArenaDraftPosture("anything"), "ATTACKER");
});
