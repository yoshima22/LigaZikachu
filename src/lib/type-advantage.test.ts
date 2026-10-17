import assert from "node:assert/strict";
import test from "node:test";
import { getTypeAdvantageStep, getTypeAdvantageMultiplier, getTypeDefenseProfile } from "./mascot-data";

test("passo de vantagem/resistência de tipo (±2, ±20% por passo)", () => {
  assert.equal(getTypeAdvantageStep("fire", "grass"), 1);              // super efetivo
  assert.equal(getTypeAdvantageStep("fire", ["grass", "bug"]), 2);     // dupla vantagem (×4)
  assert.equal(getTypeAdvantageStep("water", "fire"), 1);
  assert.equal(getTypeAdvantageStep("fire", "water"), -1);             // resistência
  assert.equal(getTypeAdvantageStep("fire", ["water", "dragon"]), -2); // dupla resistência
  assert.equal(getTypeAdvantageStep("normal", "ghost"), -2);          // imunidade oficial → -40%
  assert.equal(getTypeAdvantageStep("normal", "normal"), 0);          // neutro
  // atacante de 2 tipos usa o melhor matchup
  assert.equal(getTypeAdvantageStep(["water", "normal"], "fire"), 1);
});

test("multiplicador mapeia passos para ±20% com teto ±40%", () => {
  assert.equal(getTypeAdvantageMultiplier("fire", "grass"), 1.2);
  assert.equal(getTypeAdvantageMultiplier("fire", ["grass", "bug"]), 1.4);
  assert.equal(getTypeAdvantageMultiplier("fire", "water"), 0.8);
  assert.equal(getTypeAdvantageMultiplier("normal", "ghost"), 0.6);
  assert.equal(getTypeAdvantageMultiplier("normal", "normal"), 1.0);
});

test("perfil defensivo lista vulnerabilidades e resistências", () => {
  const p = getTypeDefenseProfile(["grass"]);
  assert.ok(p.weak.includes("fire"));   // grama é fraca a fogo
  assert.ok(p.resist.includes("water")); // grama resiste a água
});
