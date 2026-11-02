import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrainingStanceDirectHit } from "./training-stance-effects";

test("executor requests a survival-checking execution at scaled threshold", () => {
  const result = resolveTrainingStanceDirectHit({ role: "EXECUTOR", force: 250, agility: 250, vitality: 0, instinct: 0, currentHp: 40, maxHp: 200, damage: 30, directAttackIndex: 1, round: 1 });
  assert.equal(result.execute, true);
  assert.equal(result.damage, 40);
});

test("bloodthirsty uses real direct damage and caps healing by round", () => {
  const result = resolveTrainingStanceDirectHit({ role: "BLOODTHIRSTY", force: 250, vitality: 250, agility: 0, instinct: 0, currentHp: 100, maxHp: 200, damage: 90, directAttackIndex: 1, round: 1, healingThisRound: 10 });
  assert.equal(result.heal, 6);
});

test("explosive third direct hit adds half current HP then forces self KO", () => {
  const result = resolveTrainingStanceDirectHit({ role: "EXPLOSIVE", force: 0, vitality: 100, agility: 100, instinct: 0, currentHp: 80, maxHp: 200, damage: 50, directAttackIndex: 3, round: 2 });
  assert.equal(result.damage, 90);
  assert.equal(result.selfKo, true);
});
