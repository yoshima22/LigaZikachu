/**
 * Check do Doce Raro — puro, nao toca no banco.
 * Trava a regra: sacia como um doce comum, mas rende o EXP de 8 de uma vez.
 * Rodar: npx tsx scripts/check-rare-sweet.ts
 */
import assert from "node:assert/strict";
import { EXP_REWARDS, RARE_SWEET_EXP_MULTIPLIER, feedBaseExp } from "../src/lib/mascot-data";

assert.equal(RARE_SWEET_EXP_MULTIPLIER, 8, "o Doce Raro vale 8 doces");

for (const glutton of [false, true]) {
  const comum = feedBaseExp("SWEET", glutton ? "GLUTTON" : null);
  const raro = feedBaseExp("RARE_SWEET", glutton ? "GLUTTON" : null);
  assert.equal(raro, comum * 8, `raro deve render 8x o comum (guloso=${glutton})`);
  // Bonus de personalidade incide sobre o total, igual a alimentar 8 vezes.
  assert.equal(raro, feedBaseExp("SWEET", glutton ? "GLUTTON" : null) * RARE_SWEET_EXP_MULTIPLIER);
}

assert.equal(feedBaseExp("SWEET", null), EXP_REWARDS.FEED_SWEET, "doce comum nao muda");
assert.ok(
  feedBaseExp("RARE_SWEET", "GLUTTON") > feedBaseExp("RARE_SWEET", null),
  "guloso ganha mais tambem no raro",
);

console.log("ok — Doce Raro rende exatamente 8 doces de EXP");

// A barra "Alimentar todos" usa a mesma fórmula do botão individual — o mesmo
// item tem de valer o mesmo EXP não importa por onde o jogador alimente.
assert.equal(feedBaseExp("FOOD", null), EXP_REWARDS.FEED_FOOD);
assert.equal(feedBaseExp("FOOD", "LOYAL"), EXP_REWARDS.FEED_FOOD * 1.10, "leal ganha +10% com comida");
assert.equal(feedBaseExp("FOOD", "GLUTTON"), EXP_REWARDS.FEED_FOOD * 1.15, "guloso ganha +15% com comida");
assert.equal(feedBaseExp("SWEET", "LOYAL"), EXP_REWARDS.FEED_SWEET, "leal nao tem bonus em doce");
