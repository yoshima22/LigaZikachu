/** Padronização dos tipos: npx tsx scripts/test-type-consistency.ts */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { POKEMON_ELEMENT, TYPE_ADVANTAGE, TYPE_LABELS_PT, getPokemonTypes } from "../src/lib/mascot-data";

const TYPES = Object.keys(TYPE_LABELS_PT);
assert.equal(TYPES.length, 18);
// Chaves internas sempre em inglês minúsculo (ex.: "steel"; rótulo PT "Metal") e rótulo único em português.
for (const [id, value] of Object.entries(POKEMON_ELEMENT)) for (const t of value.split("/")) assert.ok(TYPES.includes(t), `tipo inválido "${t}" no #${id}`);
for (const [atk, defs] of Object.entries(TYPE_ADVANTAGE)) { assert.ok(TYPES.includes(atk)); for (const d of defs) assert.ok(TYPES.includes(d), `vantagem com tipo inválido ${d}`); }
assert.equal(TYPE_LABELS_PT.steel, "Metal");
assert.equal(TYPE_LABELS_PT.dark, "Sombrio");
assert.equal(TYPE_LABELS_PT.grass, "Planta");
// Casos que estavam errados e divergiam entre a página de mascotes e os combates.
assert.deepEqual(getPokemonTypes(486), ["normal"], "Regigigas é Normal");
assert.deepEqual(getPokemonTypes(35), ["fairy"], "Clefairy é Fada");
assert.deepEqual(getPokemonTypes(797), ["steel", "flying"], "Celesteela");

// Nenhum rótulo antigo de tipo pode voltar à interface (TCG tem vocabulário próprio e fica de fora).
const BANNED = [/steel\s*:\s*"Aço"/, /"steel",\s*"Aço"/, /dark\s*:\s*"Noturno"/, /"dark",\s*"Noturno"/, /Psiquico/, /grass\s*:\s*"Grama"/, /"grass",\s*"Grama"/, /poison\s*:\s*"Venenoso"/, /electric\s*:\s*"Eletrico"/];
const SKIP = [/manual[\/]page/, /pokemon-types-data/, /pokemon-type-selector/, /card-names-ptbr/, /seed-season2/, /abilities[\/]data\.generated/];
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => { const p = join(dir, name); return statSync(p).isDirectory() ? (name === "node_modules" ? [] : walk(p)) : /\.(ts|tsx)$/.test(name) ? [p] : []; });
const offenders: string[] = [];
for (const file of walk("src")) {
  if (SKIP.some((re) => re.test(file))) continue;
  const text = readFileSync(file, "utf8");
  for (const re of BANNED) if (re.test(text)) offenders.push(`${file}: ${re}`);
}
assert.deepEqual(offenders, [], "rótulos de tipo fora do padrão:\n" + offenders.join("\n"));
console.log("ok: tipos padronizados");
