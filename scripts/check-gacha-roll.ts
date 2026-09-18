// Conferência do sorteio dos banners: npx tsx scripts/check-gacha-roll.ts
// Falha (assert) se garantia do x10, barras de pity ou rate-up pararem de valer.
import assert from "node:assert";
import { rollPulls, rarityRank, currentWeekKey, type RollEntry } from "../src/lib/gacha";

const POOL: RollEntry[] = [
  { id: "comum", rarity: "COMMON", weight: 90, rateUp: false },
  { id: "raro", rarity: "RARE", weight: 9, rateUp: false },
  { id: "lugia", rarity: "CELESTIAL", weight: 1, rateUp: true },
];

// Gerador determinístico para o teste não depender de sorte.
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

// 1. x10 sempre entrega ao menos um resultado no piso garantido.
for (let seed = 1; seed <= 200; seed += 1) {
  const { results } = rollPulls(POOL, 10, { rateUpMultiplier: 3, guaranteedRarity: "RARE", pity: [], random: seeded(seed) });
  assert.equal(results.length, 10);
  assert.ok(results.some((r) => rarityRank(r.rarity) >= rarityRank("RARE")), `sem garantido no seed ${seed}`);
}

// 2. Barra de pity: a cada 5 aberturas sem Especial+, a 5ª vem Especial+.
const pity = [{ id: "barra", everyPulls: 5, rarity: "CELESTIAL", counter: 0 }];
const onlyCommon: RollEntry[] = [POOL[0], POOL[2]];
const run = rollPulls(onlyCommon, 5, { rateUpMultiplier: 1, pity, random: () => 0.0001 });
assert.equal(run.results[4].rarity, "CELESTIAL", "a barra de pity não disparou na 5ª abertura");
assert.equal(run.results[4].guaranteedBy, "PITY");
assert.equal(run.pity[0].counter, 0, "a barra não zerou depois de pagar");

// 3. Rate-up aumenta a frequência do item em destaque.
const count = (multiplier: number) => {
  let hits = 0;
  const random = seeded(7);
  for (let i = 0; i < 2000; i += 1) {
    hits += rollPulls(POOL, 1, { rateUpMultiplier: multiplier, pity: [], random }).results[0].entryId === "lugia" ? 1 : 0;
  }
  return hits;
};
assert.ok(count(10) > count(1), "rate-up não aumentou a chance do destaque");

// 4. Semana das missões vira na segunda-feira (BRT).
assert.equal(currentWeekKey(new Date("2026-09-20T12:00:00Z")), "2026-09-14"); // domingo → semana anterior
assert.equal(currentWeekKey(new Date("2026-09-21T12:00:00Z")), "2026-09-21"); // segunda → nova semana

console.log("ok: garantia do x10, barras de pity, rate-up e reset semanal");
