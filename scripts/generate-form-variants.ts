/**
 * Gera src/lib/form-variants-data.ts: mapa forma alternativa -> espécie base
 * (apenas formas NÃO-mega que estavam nas pools de ovo). A ideia é colapsar
 * essas formas na espécie base e sortear a forma numa "segunda rolagem" interna.
 * Offline: deriva a base pelo prefixo do nome da forma ("Base-Sufixo").
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXTRA_FORM_NAMES, EXTRA_FORM_POOL_BY_GEN } from "../src/lib/extra-forms-data";
import { getPokemonName } from "../src/lib/mascot-data";
import { MEGA_FORM_IDS } from "../src/lib/mega-evolution";

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

const poolable = new Set<number>();
for (const ids of Object.values(EXTRA_FORM_POOL_BY_GEN)) for (const id of ids) poolable.add(id);

const formBase: Record<number, number> = {};
const variantsByBase: Record<number, number[]> = {};
const unmatched: Array<{ id: number; name: string }> = [];

for (const id of [...poolable].sort((a, b) => a - b)) {
  if (MEGA_FORM_IDS.has(id)) continue; // megas não colapsam (só via pedra)
  const name = EXTRA_FORM_NAMES[id];
  if (!name) continue;
  const base = resolveBase(id, name);
  if (!base) { unmatched.push({ id, name }); continue; }
  if (base === id) continue;
  formBase[id] = base;
  (variantsByBase[base] ??= []).push(id);
}

for (const base of Object.keys(variantsByBase)) variantsByBase[Number(base)].sort((a, b) => a - b);

if (unmatched.length) {
  console.warn("Formas sem base resolvida:", unmatched);
}

const header = `// GERADO por scripts/generate-form-variants.ts — não editar à mão.
// Mapa de formas alternativas NÃO-mega (que estavam nas pools) para a espécie
// base. No sorteio de ovo, só a base entra na pool; a forma é decidida numa
// segunda rolagem interna entre { base + formas ligadas }.

`;
const body = `export const EXTRA_FORM_BASE: Record<number, number> = ${JSON.stringify(formBase)};

export const FORM_VARIANTS_BY_BASE: Record<number, number[]> = ${JSON.stringify(variantsByBase)};
`;

const OUT = resolve("src/lib/form-variants-data.ts");
writeFileSync(OUT, header + body, "utf8");
console.log("OK ->", OUT, "| formas colapsadas:", Object.keys(formBase).length, "| bases com variantes:", Object.keys(variantsByBase).length, "| não resolvidas:", unmatched.length);
