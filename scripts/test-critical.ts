// Crítico: chance baixa por padrão, teto natural 15,6% e total 20%. npx tsx scripts/test-critical.ts
import assert from "node:assert/strict";
import { criticalChance, CRIT_NATURAL_CAP, CRIT_TOTAL_CAP, CRIT_DAMAGE_BONUS } from "../src/lib/critical";

const pct = (n: number) => Math.round(n * 1000) / 10;
assert.equal(pct(criticalChance(65, 65)), 4.2); // soma 130
assert.equal(pct(criticalChance(130, 130)), 8.5); // soma 260
assert.equal(criticalChance(250, 250), CRIT_NATURAL_CAP); // cap natural
assert.equal(pct(CRIT_NATURAL_CAP), 15.6);
assert.equal(criticalChance(250, 250, 0.2), CRIT_TOTAL_CAP); // habilidades nunca passam de 20%
assert.ok(CRIT_DAMAGE_BONUS < 0.2); // menor que 1 passo de vantagem de tipo
console.log("ok");
