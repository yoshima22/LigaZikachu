/**
 * Gera src/lib/form-variants-data.ts: mapa forma alternativa -> espécie base
 * (apenas formas NÃO-mega que estavam nas pools de ovo). A ideia é colapsar
 * essas formas na espécie base e sortear a forma numa "segunda rolagem" interna.
 * Offline: deriva a base pelo prefixo do nome da forma ("Base-Sufixo").
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXTRA_FORM_NAMES, EXTRA_FORM_POOL_BY_GEN, EXTRA_FORM_IDS, EXTRA_FORM_GENERATION } from "../src/lib/extra-forms-data";
import { getPokemonName, EGG_POOLS, LEGENDARY_POOL } from "../src/lib/mascot-data";
import { MEGA_FORM_IDS } from "../src/lib/mega-evolution";

// Geração de uma espécie/forma (espelha generationForEggPokemon do runtime).
function genOf(id: number): number | null {
  if (id >= 1 && id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  if (id <= 1025) return 9;
  if (id === 10006 || id === 10007) return 4;
  if (id >= 10091 && id <= 10115) return 7;
  if (id >= 10158 && id <= 10180) return 8;
  if (id >= 10229 && id <= 10244) return 8;
  if (id >= 201001 && id <= 201027) return 2; // Unown letras
  return EXTRA_FORM_GENERATION[id] ?? null;
}

// Nomes das espécies base reais (ids 1..1025) via getPokemonName (cobre todas).
const baseNameToId = new Map<string, number>();
for (let id = 1; id <= 1025; id++) {
  const name = getPokemonName(id);
  if (name && !baseNameToId.has(name)) baseNameToId.set(name, id);
}
const baseNamesByLength = [...baseNameToId.keys()].sort((a, b) => b.length - a.length);

function resolveBase(formId: number, formName: string): number | null {
  if (formId >= 201001 && formId <= 201027) return 201; // Unown letras
  for (const baseName of baseNamesByLength) {
    if (formName === baseName || formName.startsWith(baseName + "-")) {
      return baseNameToId.get(baseName)!;
    }
  }
  return null;
}

// Formas (ids >= 10000) que aparecem em QUALQUER pool: EXTRA_FORM_POOL_BY_GEN +
// EGG_POOLS (já com extras mesclados) + LEGENDARY_POOL (formas estáticas como
// Shaymin-Céu 10006, Giratina-Origem 10007, aves de Galar 10166-8).
const poolable = new Set<number>();
for (const ids of Object.values(EXTRA_FORM_POOL_BY_GEN)) for (const id of ids) poolable.add(id);
for (const ids of Object.values(EGG_POOLS)) for (const id of ids) if (id >= 10000 && id < 200000) poolable.add(id);
for (const id of LEGENDARY_POOL) if (id >= 10000 && id < 200000) poolable.add(id);

const formBase: Record<number, number> = {};
const variantsByBase: Record<number, number[]> = {};
const unmatched: Array<{ id: number; name: string }> = [];

const crossGen: Array<{ id: number; name: string; gf: number | null; base: number; gb: number | null }> = [];
for (const id of [...poolable].sort((a, b) => a - b)) {
  if (MEGA_FORM_IDS.has(id)) continue; // megas não colapsam (só via pedra)
  const name = EXTRA_FORM_NAMES[id] ?? getPokemonName(id);
  if (!name) continue;
  const base = resolveBase(id, name);
  if (!base) { unmatched.push({ id, name }); continue; }
  if (base === id) continue;
  // Regra: NÃO misturar gerações. Formas regionais (Alola/Galar/Hisui) têm
  // geração própria e ficam separadas na geração delas, sem colapsar na base.
  const gf = genOf(id), gb = genOf(base);
  if (gf !== gb) { crossGen.push({ id, name, gf, base, gb }); continue; }
  formBase[id] = base;
  (variantsByBase[base] ??= []).push(id);
}
if (crossGen.length) console.warn(`Formas NÃO colapsadas por geração diferente (ficam separadas): ${crossGen.length}`);

for (const base of Object.keys(variantsByBase)) variantsByBase[Number(base)].sort((a, b) => a - b);

if (unmatched.length) {
  console.warn("Formas sem base resolvida:", unmatched);
}

// Base de TODAS as formas (incluindo megas e Unown) — usado para AGRUPAR na
// Pokédex/painel admin (não afeta o sorteio, que usa só EXTRA_FORM_BASE).
const formBaseAll: Record<number, number> = {};
const unmatchedAll: Array<{ id: number; name: string }> = [];
for (const id of [...EXTRA_FORM_IDS].sort((a, b) => a - b)) {
  const name = EXTRA_FORM_NAMES[id];
  if (!name) continue;
  const base = resolveBase(id, name);
  if (!base) { unmatchedAll.push({ id, name }); continue; }
  if (base === id) continue;
  // Mesma trava de geração: formas regionais não agrupam sob base de outra gen.
  if (genOf(id) !== genOf(base)) continue;
  formBaseAll[id] = base;
}
if (unmatchedAll.length) console.warn("Formas (todas) sem base:", unmatchedAll.length, unmatchedAll.slice(0, 10));

const header = `// GERADO por scripts/generate-form-variants.ts — não editar à mão.
// Mapa de formas alternativas NÃO-mega (que estavam nas pools) para a espécie
// base. No sorteio de ovo, só a base entra na pool; a forma é decidida numa
// segunda rolagem interna entre { base + formas ligadas }.

`;
const body = `export const EXTRA_FORM_BASE: Record<number, number> = ${JSON.stringify(formBase)};

export const FORM_VARIANTS_BY_BASE: Record<number, number[]> = ${JSON.stringify(variantsByBase)};

// Base de TODAS as formas (megas e Unown inclusos) — só para AGRUPAR na UI.
export const EXTRA_FORM_BASE_ALL: Record<number, number> = ${JSON.stringify(formBaseAll)};
`;

const OUT = resolve("src/lib/form-variants-data.ts");
writeFileSync(OUT, header + body, "utf8");
console.log("OK ->", OUT, "| formas colapsadas:", Object.keys(formBase).length, "| bases com variantes:", Object.keys(variantsByBase).length, "| não resolvidas:", unmatched.length);
