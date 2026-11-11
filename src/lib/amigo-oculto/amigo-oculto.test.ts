import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SS_CONFIG as C, countCheckins, daysBetween, draw, drawAvoiding, earnedMimo, goalFor, hashSeed, levelFor, pickIndex } from "./core";
import { PACKAGES, defaultOptions, packagesForLevel, validateOptions } from "./catalog";
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
  assert.ok(packagesForLevel(1).every((g) => g.tier === 1) && packagesForLevel(4).length === PACKAGES.length);
  for (const t of [1, 2, 3, 4]) assert.ok(PACKAGES.filter((p) => p.tier === t).length >= 3, `nível ${t} precisa de 3+ pacotes`);
  assert.equal(new Set(PACKAGES.map((p) => p.key)).size, PACKAGES.length);
  assert.equal(defaultOptions(0).length, 3);
  assert.ok(defaultOptions(3).every((k) => PACKAGES.find((p) => p.key === k)!.tier === 3));
  assert.ok(validateOptions(["guloseimas", "torcedor", "visual"], 1).ok);
  assert.ok(!validateOptions(["guloseimas", "torcedor"], 1).ok);              // precisa de 3
  assert.ok(!validateOptions(["guloseimas", "guloseimas", "visual"], 1).ok);  // distintos
  assert.ok(!validateOptions(["guloseimas", "torcedor", "raro"], 1).ok);      // nível 3 bloqueado
  const ok = { greeting: "g1", lines: ["l1"], closing: "c1", background: "noite", sticker: "🎄" };
  assert.ok(validateCard(ok).ok);
  assert.ok(!validateCard({ ...ok, lines: [] }).ok);
  assert.ok(!validateCard({ ...ok, lines: ["l1", "l1"] }).ok);
  assert.ok(!validateCard({ ...ok, background: "x" }).ok);
  assert.ok(validateCard({ ...ok, image: "noel-chamine", lines: ["f1", "f2"] }).ok);
  assert.ok(!validateCard({ ...ok, image: "nada" }).ok);
});

test("sorteio entre as 3 opções e pares anteriores evitados", () => {
  const hits = [0, 0, 0];
  for (let i = 0; i < 3000; i++) hits[pickIndex(`s:${i}`, 3)]++;
  assert.ok(hits.every((h) => h > 800), `distribuição desbalanceada ${hits}`);
  assert.equal(pickIndex("a:b", 3), pickIndex("a:b", 3));
  const ids = Array.from({ length: 8 }, (_, i) => `p${i}`);
  const first = draw(ids, "base");
  const avoid = new Set([...first].map(([a, b]) => `${a}>${b}`));
  const { pairs } = drawAvoiding(ids, avoid);
  assert.ok([...pairs].every(([a, b]) => !avoid.has(`${a}>${b}`)));
});
