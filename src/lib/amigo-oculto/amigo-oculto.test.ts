import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SS_CONFIG as C, countCheckins, daysBetween, draw, earnedMimo, goalFor, hashSeed, levelFor } from "./core";
import { GIFT_CATALOG, defaultGift, giftsForLevel } from "./catalog";
import { validateCard } from "./cards";

test("sorteio: ninguém tira a si mesmo, sem trocas diretas, todos recebem 1, determinístico", () => {
  for (const n of [3, 6, 13]) {
    const ids = Array.from({ length: n }, (_, i) => `p${i}`);
    for (let s = 0; s < 50; s++) {
      const m = draw(ids, `seed${s}`);
      assert.equal(new Set(m.values()).size, n);
      for (const [a, b] of m) {
        assert.notEqual(a, b);
        assert.notEqual(m.get(b), a);
      }
    }
  }
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual([...draw(ids, "x")], [...draw([...ids].reverse(), "x")]);
  assert.throws(() => draw(["a", "b"], "x"));
  assert.equal(hashSeed("x").length, 64);
});

test("laços: meta sobre inscritos, níveis e check-in 1 por dia", () => {
  assert.equal(daysBetween("2026-12-01", "2026-12-14"), 14);
  const goal = goalFor(13, 14, C);
  assert.equal(goal, 137);
  assert.deepEqual([0, 35, 69, 103, 137].map((b) => levelFor(b, goal, C)), [0, 1, 2, 3, 4]);
  assert.equal(countCheckins(["2026-12-01", "2026-12-01", "2026-11-30", "2026-12-03"], "2026-12-01", "2026-12-14"), 2);
  assert.ok(earnedMimo(10, 14, C) && !earnedMimo(9, 14, C));
});

test("catálogo e cartão", () => {
  assert.ok(giftsForLevel(1).every((g) => g.tier === 1) && giftsForLevel(4).length === GIFT_CATALOG.length);
  assert.equal(defaultGift(0).tier, 1);
  assert.equal(defaultGift(3).tier, 3);
  const ok = { greeting: "g1", lines: ["l1"], closing: "c1", background: "noite", sticker: "🎄" };
  assert.ok(validateCard(ok).ok);
  assert.ok(!validateCard({ ...ok, lines: [] }).ok);
  assert.ok(!validateCard({ ...ok, lines: ["l1", "l1"] }).ok);
  assert.ok(!validateCard({ ...ok, background: "x" }).ok);
  assert.ok(validateCard({ ...ok, image: "noel-chamine", lines: ["f1", "f2"] }).ok);
  assert.ok(!validateCard({ ...ok, image: "nada" }).ok);
});
