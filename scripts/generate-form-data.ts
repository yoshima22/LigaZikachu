/**
 * generate-form-data.ts (execução única)
 *
 * Gera src/lib/extra-forms-data.ts com nomes, tipos, geração e pool das formas
 * alternativas (IDs 10001+) fora do jogo + as 27 letras do Unown (IDs sintéticos
 * 201001–201027). Busca tipos/espécie na PokéAPI. Todos entram DESLIGADOS por
 * padrão via a tabela EggPokemonToggle (feito em outro script).
 */
import fs from "node:fs";
import path from "node:path";

const SP = process.env.SP || ".";
const OUT = path.resolve("src/lib/extra-forms-data.ts");

// nomes-base do jogo (para montar "Base-Sufixo")
const md = fs.readFileSync("src/lib/mascot-data.ts", "utf8");
const nameChunk = md.slice(md.indexOf("POKEMON_PT_NAMES"), md.indexOf("export function getPokemonName"));
const baseNames: Record<number, string> = {};
for (const m of nameChunk.matchAll(/(\d{1,7})\s*:\s*"([^"]+)"/g)) baseNames[+m[1]] = m[2];

function generationForBase(id: number): number {
  if (id <= 151) return 1; if (id <= 251) return 2; if (id <= 386) return 3;
  if (id <= 493) return 4; if (id <= 649) return 5; if (id <= 721) return 6;
  if (id <= 809) return 7; if (id <= 905) return 8; return 9;
}
const pretty = (s: string) => s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

async function fetchJson(url: string, tries = 3): Promise<any> {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 400));
  }
  throw new Error("falhou: " + url);
}

async function main() {
  const A: { id: number; slug: string }[] = JSON.parse(fs.readFileSync(SP + "/final.json", "utf8")).A;
  const names: Record<number, string> = {};
  const elements: Record<number, string> = {};
  const generation: Record<number, number> = {};

  // Formas 10001+ (250)
  let done = 0;
  const batch = 12;
  for (let i = 0; i < A.length; i += batch) {
    await Promise.all(A.slice(i, i + batch).map(async (f) => {
      const p = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${f.id}`);
      const types = p.types.sort((a: any, b: any) => a.slot - b.slot).map((t: any) => t.type.name).join("/");
      const speciesId = Number(p.species.url.match(/\/(\d+)\/$/)[1]);
      const speciesName = p.species.name; // ex.: "deoxys"
      const suffix = f.slug.startsWith(speciesName + "-") ? f.slug.slice(speciesName.length + 1) : f.slug.split("-").slice(1).join("-");
      const base = baseNames[speciesId] ?? pretty(speciesName);
      names[f.id] = `${base}-${pretty(suffix)}`;
      elements[f.id] = types || "normal";
      generation[f.id] = generationForBase(speciesId);
    }));
    done += Math.min(batch, A.length - i);
    process.stdout.write(`\rformas: ${done}/${A.length}`);
  }
  console.log();

  // Unown 27 letras (B–Z, !, ?) — IDs 201001–201027
  const letters = [..."BCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "!", "?"];
  letters.forEach((ch, idx) => {
    const id = 201001 + idx;
    names[id] = `Unown-${ch}`;
    elements[id] = "psychic";
    generation[id] = 2;
  });

  // pool por geração
  const poolByGen: Record<number, number[]> = {};
  for (const [idStr, gen] of Object.entries(generation)) (poolByGen[gen] ??= []).push(+idStr);
  for (const gen of Object.keys(poolByGen)) poolByGen[+gen].sort((a, b) => a - b);

  const entriesObj = (o: Record<number, any>, q = false) =>
    Object.entries(o).map(([k, v]) => `  ${k}: ${q ? JSON.stringify(v) : v}`).join(",\n");

  const out = `// GERADO por scripts/generate-form-data.ts — não editar à mão.
// Formas alternativas (IDs 10001+) + 27 letras do Unown (201001–201027).
// Todas entram DESLIGADAS por padrão (tabela EggPokemonToggle).

export const EXTRA_FORM_NAMES: Record<number, string> = {
${entriesObj(names, true)},
};

export const EXTRA_FORM_ELEMENTS: Record<number, string> = {
${entriesObj(elements, true)},
};

export const EXTRA_FORM_GENERATION: Record<number, number> = {
${entriesObj(generation)},
};

// Geração -> IDs de forma para injetar nas EGG_POOLS.
export const EXTRA_FORM_POOL_BY_GEN: Record<number, number[]> = {
${Object.keys(poolByGen).sort((a, b) => +a - +b).map((g) => `  ${g}: [${poolByGen[+g].join(", ")}]`).join(",\n")},
};

// Lista completa dos IDs adicionados (para seed do toggle e para o painel admin).
export const EXTRA_FORM_IDS: number[] = [${Object.keys(names).map(Number).sort((a, b) => a - b).join(", ")}];
`;
  fs.writeFileSync(OUT, out);
  console.log("OK ->", OUT, "| formas:", A.length, "| unown:", letters.length, "| total:", Object.keys(names).length);
}
main();
