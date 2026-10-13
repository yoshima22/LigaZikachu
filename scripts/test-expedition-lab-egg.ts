import assert from "node:assert/strict";
import { getExpeditionOdds } from "../src/lib/mascot-data";

const eligible = getExpeditionOdds({
  duration: "6h",
  mode: "ITEMS",
  level: 100,
  instinct: 250,
  allyCount: 10,
  luckBuff: true,
});

assert.equal(eligible.labEgg, 1, "cenário máximo deve ter 1% de Ovo de Lab por expedição de Itens de 6h");

const withoutLuck = getExpeditionOdds({
  duration: "6h",
  mode: "ITEMS",
  level: 100,
  instinct: 250,
  allyCount: 10,
  luckBuff: false,
});
assert.equal(withoutLuck.labEgg, 0, "Amuleto da Sorte é obrigatório para o drop de Lab");

const wrongMode = getExpeditionOdds({
  duration: "6h",
  mode: "STANDARD",
  level: 100,
  instinct: 250,
  allyCount: 10,
  luckBuff: true,
});
assert.equal(wrongMode.labEgg, 0, "somente expedições de Itens podem oferecer Ovo de Lab");

console.log("ok expedition lab egg");
