import assert from "node:assert/strict";
import { test } from "node:test";
import { initialStanceFor, resolveTowerClassEffects, TOWER_EXPEDITION_ROLES } from "./config";
import { resolveTowerTalents, towerLuckCoins, towerRescueCapacity } from "./talents";

test("each Tower class has the advertised bounded combat or support effect", () => {
  const cases = [
    ["INVESTIGADOR", "instinctMult", 1.08],
    ["NAVEGADOR", "agilityMult", 1.03],
    ["PROTETOR", "vitalityMult", 1.06],
    ["ARTIFICE", "forceMult", 1.04],
    ["RITUALISTA", "charismaMult", 1.1],
    ["BATEDOR", "agilityMult", 1.07],
  ] as const;
  for (const [role, property, value] of cases) {
    const effect = resolveTowerClassEffects(role, { kind: "COMBAT" });
    assert.equal(effect[property], value, role);
    assert.ok(effect.reasons.length, role);
  }
  assert.equal(TOWER_EXPEDITION_ROLES.length, 6);
});

test("support effects depend on context and first-use rules", () => {
  assert.equal(resolveTowerClassEffects("NAVEGADOR", { kind: "WAIT", firstWait: true }).pressureReduction, 1);
  assert.equal(resolveTowerClassEffects("NAVEGADOR", { kind: "WAIT", firstWait: false }).pressureReduction, 0);
  assert.equal(resolveTowerClassEffects("ARTIFICE", { kind: "PUZZLE_MISTAKE" }).pressureReduction, 1);
  assert.equal(resolveTowerClassEffects("RITUALISTA", { kind: "REST" }).healingMult, 1.1);
  assert.equal(resolveTowerClassEffects("INVESTIGADOR", { kind: "PUZZLE_HINT" }).revealsHint, true);
});

test("preferred posture is accepted only when that class allows it", () => {
  assert.equal(initialStanceFor("PROTETOR", "DEFENDER"), "DEFENDER");
  assert.equal(initialStanceFor("PROTETOR", "ATTACKER"), "DEFENDER");
});

test("Vigor increases all five combat attributes and ranks are capped", () => {
  const effect = resolveTowerTalents((key) => key === "VIGOR" ? 99 : 0);
  assert.equal(effect.forceMult, 1.075);
  assert.equal(effect.charismaMult, 1.075);
});

test("shared Luck and Rescue talents give a bounded effect at every rank", () => {
  assert.equal(towerLuckCoins(0), 25);
  assert.equal(towerLuckCoins(1), 30);
  assert.equal(towerLuckCoins(99), 50);
  assert.equal(towerRescueCapacity(0), 2);
  assert.equal(towerRescueCapacity(3), 5);
  assert.equal(towerRescueCapacity(99), 7);
});
