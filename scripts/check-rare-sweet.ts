/**
 * Check do Doce Raro — puro, nao toca no banco.
 * Trava a regra: sacia como um doce comum, mas rende o EXP de 8 de uma vez.
 * Rodar: npx tsx scripts/check-rare-sweet.ts
 */
import assert from "node:assert/strict";
import { EXP_REWARDS, RARE_SWEET_EXP_MULTIPLIER, sweetFeedBaseExp } from "../src/lib/mascot-data";

assert.equal(RARE_SWEET_EXP_MULTIPLIER, 8, "o Doce Raro vale 8 doces");

for (const glutton of [false, true]) {
  const comum = sweetFeedBaseExp("SWEET", glutton);
  const raro = sweetFeedBaseExp("RARE_SWEET", glutton);
  assert.equal(raro, comum * 8, `raro deve render 8x o comum (guloso=${glutton})`);
  // Bonus de personalidade incide sobre o total, igual a alimentar 8 vezes.
  assert.equal(raro, sweetFeedBaseExp("SWEET", glutton) * RARE_SWEET_EXP_MULTIPLIER);
}

assert.equal(sweetFeedBaseExp("SWEET", false), EXP_REWARDS.FEED_SWEET, "doce comum nao muda");
assert.ok(
  sweetFeedBaseExp("RARE_SWEET", true) > sweetFeedBaseExp("RARE_SWEET", false),
  "guloso ganha mais tambem no raro",
);

console.log("ok — Doce Raro rende exatamente 8 doces de EXP");
