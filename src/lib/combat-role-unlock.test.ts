import assert from "node:assert/strict";
import test from "node:test";
import { defaultCombatRoleFor } from "./combat-roles";

const mascot = { preferredCombatRole: "EXECUTOR", statForce: 80, statAgility: 30, statVitality: 20, statInstinct: 20, statCharisma: 20 };

test("does not resolve a locked journey posture into a battle role", () => {
  assert.notEqual(defaultCombatRoleFor(mascot, []), "EXECUTOR");
});

test("resolves a journey posture only when the mascot-specific unlock exists", () => {
  assert.equal(defaultCombatRoleFor(mascot, ["EXECUTOR"]), "EXECUTOR");
});
