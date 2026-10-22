import assert from "node:assert/strict";
import test from "node:test";
import { getTypeAdvantageStep, getTypeAdvantageMultiplier, getTypeDefenseProfile, formatTypeNote } from "./mascot-data";

test("passo de vantagem/resistência de tipo (±2, ±20% por passo)", () => {
  assert.equal(getTypeAdvantageStep("fire", "grass"), 1);              // super efetivo
  assert.equal(getTypeAdvantageStep("fire", ["grass", "bug"]), 2);     // dupla vantagem (×4)
  assert.equal(getTypeAdvantageStep("water", "fire"), 1);
  assert.equal(getTypeAdvantageStep("fire", "water"), -1);             // resistência
  assert.equal(getTypeAdvantageStep("fire", ["water", "dragon"]), -2); // dupla resistência
  assert.equal(getTypeAdvantageStep("normal", "ghost"), -2);          // imunidade oficial → -40%
  assert.equal(getTypeAdvantageStep("normal", "normal"), 0);          // neutro
  // atacante de 2 tipos: os passos de cada tipo se SOMAM (teto ±2)
  assert.equal(getTypeAdvantageStep(["water", "normal"], "fire"), 1);       // +1 + 0
  assert.equal(getTypeAdvantageStep(["dragon", "ground"], "fairy"), -2);    // −2 + 0 (antes era 0)
  assert.equal(getTypeAdvantageStep(["dragon", "flying"], "fairy"), -2);
  assert.equal(getTypeAdvantageStep(["fire", "water"], "grass"), 0);        // +1 − 1
  assert.equal(getTypeAdvantageStep(["fighting", "rock"], "ice"), 2);       // +1 + 1
  assert.equal(getTypeAdvantageStep(["fire", "ground"], ["steel", "rock"]), 2); // +1 (fogo) + 2 (terra ×4), teto
  assert.equal(getTypeAdvantageStep(["fire", "fighting"], ["fairy", "ghost"]), -2); // 0 + −2
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

test("log mostra a contribuição de cada tipo do atacante", () => {
  assert.equal(formatTypeNote(["dragon", "ground"], ["fairy"], -2, -30), "Muito resistente: -30 de dano por resistência (Dragão −2, Terra 0 → Fada).");
  assert.equal(formatTypeNote(["fire", "water"], ["grass"], 0, 0), "Tipos se anularam (Fogo +1, Água −1 → Planta): neutro.");
  assert.equal(formatTypeNote(["dragon"], ["fairy"], -2, -30), "Muito resistente: -30 de dano por resistência.");
  assert.equal(formatTypeNote(["fairy"], ["dragon"], 1, 20), "✦ Super efetivo: +20 de dano por vantagem.");
  assert.equal(formatTypeNote(["normal", "flying"], ["fire"], 0, 0), null);
});
