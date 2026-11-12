import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SS_CONFIG as C, countCheckins, daysBetween, draw, drawAvoiding, earnedMimo, hashSeed, lastCheckinDay, levelFor, pickIndex } from "./core";
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

test("bengalas: categorias por pontos absolutos e check-in 1 por dia", () => {
  assert.equal(daysBetween("2026-12-01", "2026-12-24"), 24);
  assert.equal(lastCheckinDay(new Date("2026-12-25T03:00:00Z")), "2026-12-24"); // entrega à 00:00 BRT: o dia 25 não conta
  assert.deepEqual([0, 1, 30, 31, 150, 151, 299, 300, 500].map((b) => levelFor(b, C)), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.equal(countCheckins(["2026-12-01", "2026-12-01", "2026-11-30", "2026-12-03"], "2026-12-01", "2026-12-24"), 2);
  assert.ok(earnedMimo(17, 24, C) && !earnedMimo(16, 24, C));
});

test("catálogo e cartão", () => {
  const count = (t: number) => PACKAGES.filter((p) => p.tier === t);
  assert.deepEqual([1, 2, 3, 4].map((t) => count(t).length), [5, 10, 10, 15]);
  // itens por kit: 3, 3, 4, 4 (cada linha conta como 1 item)
  for (const [t, n] of [[1, 3], [2, 3], [3, 4], [4, 4]]) for (const p of count(t)) assert.equal(p.items.length, n, p.key);
  assert.equal(new Set(PACKAGES.map((p) => p.key)).size, PACKAGES.length);
  assert.ok(packagesForLevel(1).every((g) => g.tier === 1) && packagesForLevel(4).length === PACKAGES.length);
  assert.equal(defaultOptions(0).length, 3);
  assert.ok(defaultOptions(3).every((k) => PACKAGES.find((p) => p.key === k)!.tier === 3));
  assert.ok(validateOptions(["n1-lanchinho", "n1-ninho", "n1-ovo"], 1).ok);
  assert.ok(validateOptions(["n1-lanchinho"], 1).ok);                               // até 3: 1 basta
  assert.ok(!validateOptions([], 1).ok);
  assert.ok(!validateOptions(["n1-lanchinho", "n1-ninho", "n1-ovo", "n1-penas"], 1).ok); // máximo 3
  assert.ok(!validateOptions(["n1-lanchinho", "n1-lanchinho"], 1).ok);             // distintos
  assert.ok(!validateOptions(["n1-lanchinho", "n3-gala"], 1).ok);                  // categoria 3 bloqueada
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
