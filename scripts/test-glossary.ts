// Palavras-chave das descrições. npx tsx scripts/test-glossary.ts
import assert from "node:assert/strict";
import { splitKeywords, GLOSSARY } from "../src/lib/glossary";

const kw = (t: string) => splitKeywords(t).filter((p) => p.entry).map((p) => p.text);
assert.deepEqual(kw("Tem 6% a 20% de chance de deixar o atacante apaixonado (um estado por vez)."), ["apaixonado"]);
assert.deepEqual(kw("Imunidade a estados alterados: Amendrontado e Intimidação."), ["estados alterados", "Amendrontado"]);
assert.deepEqual(kw("Golpes críticos aumentam a Força, o Instinto e a Vitalidade dos aliados."), ["críticos", "Força", "Instinto", "Vitalidade", "aliados"]);
assert.equal(splitKeywords("Recupera 5% do HP").map((p) => p.text).join(""), "Recupera 5% do HP"); // sem perda de texto
assert.equal(splitKeywords("sonolento").some((p) => p.entry), false); // palavra inteira apenas
assert.ok(GLOSSARY.every((e) => e.body.length > 20 && !/undefined|NaN/.test(e.body)));
console.log("ok");
