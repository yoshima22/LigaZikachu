/**
 * generate-mega-stone-data.ts (execução única)
 * Gera src/lib/extra-mega-stones.ts com uma Pedra de Mega para cada forma mega
 * custom (10278–10326), no mesmo padrão de MEGA_STONES.
 */
import fs from "node:fs";
import { getPokemonName } from "../src/lib/mascot-data";

const SP = process.env.SP || ".";
const need: { id: number; slug: string }[] = JSON.parse(fs.readFileSync(SP + "/mega-need-stone.json", "utf8"));
// Mapa nome-normalizado -> id nacional (só espécies-base 1..1025), lido direto do
// arquivo (o import runtime de POKEMON_PT_NAMES vem truncado no tsx).
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const md = fs.readFileSync("src/lib/mascot-data.ts", "utf8");
const nameChunk = md.slice(md.indexOf("POKEMON_PT_NAMES"), md.indexOf("export function getPokemonName"));
const baseNameToId = new Map<string, number>();
for (const m of nameChunk.matchAll(/(\d{1,7})\s*:\s*"([^"]+)"/g)) {
  const id = Number(m[1]);
  if (id >= 1 && id <= 1025) baseNameToId.set(norm(m[2]), id);
}

function resolveBase(slug: string): { id: number; suffix: string } {
  const m = slug.match(/^(.*)-mega(?:-([xyz]))?$/);
  let base = m ? m[1] : slug;
  const suffix = m && m[2] ? " " + m[2].toUpperCase() : "";
  // Progressivamente remove sufixos de forma até achar a espécie-base nacional.
  const parts = base.split("-");
  while (parts.length > 0) {
    const cand = norm(parts.join(""));
    if (baseNameToId.has(cand)) return { id: baseNameToId.get(cand)!, suffix };
    parts.pop();
  }
  throw new Error("base não resolvida: " + slug);
}

const stones = need.map(({ id, slug }) => {
  const { id: baseId, suffix } = resolveBase(slug);
  const baseName = getPokemonName(baseId);
  return {
    type: `MEGA_STONE_CUSTOM_${id}`,
    stoneName: `${baseName}ita${suffix}`,
    compatiblePokemonId: baseId,
    compatiblePokemonName: baseName,
    megaPokemonId: id,
    megaPokemonName: getPokemonName(id),
  };
}).sort((a, b) => a.megaPokemonId - b.megaPokemonId);

const out = `// GERADO por scripts/generate-mega-stone-data.ts — não editar à mão.
// Pedras de Mega das formas mega custom (10278–10326). Visibilidade no shop/bazar
// é controlada pelo toggle EggPokemonToggle do mascote mega correspondente.
// minLevel 50 e price 15000 = mesmo padrão de MEGA_MIN_LEVEL_DEFAULT / MEGA_STONE_PRICE
// (inline para evitar import circular com mega-evolution.ts).
import type { MegaStoneConfig } from "@/lib/mega-evolution";

export const EXTRA_MEGA_STONES: readonly MegaStoneConfig[] = [
${stones.map((s) => `  { type: "${s.type}", stoneName: "${s.stoneName}", compatiblePokemonId: ${s.compatiblePokemonId}, compatiblePokemonName: "${s.compatiblePokemonName}", megaPokemonId: ${s.megaPokemonId}, megaPokemonName: "${s.megaPokemonName}", minLevel: 50, price: 15000 }`).join(",\n")},
];

// IDs das formas mega custom que possuem pedra (para o gate por toggle).
export const CUSTOM_MEGA_POKEMON_IDS: number[] = [${stones.map((s) => s.megaPokemonId).join(", ")}];
`;
fs.writeFileSync("src/lib/extra-mega-stones.ts", out);
console.log("OK -> src/lib/extra-mega-stones.ts | pedras:", stones.length);
console.log("amostra:", stones.slice(0, 4).map((s) => `${s.megaPokemonId} ${s.stoneName} (base ${s.compatiblePokemonName})`).join(" | "));
