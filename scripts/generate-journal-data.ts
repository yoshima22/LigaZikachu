/**
 * Gera dados verdadeiros para o Journal a partir da PokeAPI:
 *  - src/journal-data/dex-facts.generated.json  (curiosidades numéricas e de evolução)
 *  - src/journal-data/form-species.generated.json (id de forma 10xxx → id da espécie)
 * Uso: npx tsx scripts/generate-journal-data.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://pokeapi.co/api/v2";
const MAX = 1025;

async function get<T = any>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (res.ok) return (await res.json()) as T;
    } catch {}
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  throw new Error(`falhou: ${url}`);
}

async function pool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

const idFromUrl = (url: string) => Number(url.split("/").filter(Boolean).pop());

type Fact = {
  h: number; // dm
  w: number; // hg
  bst: number;
  top: [string, number];
  leg: 0 | 1 | 2 | 3; // 1 lendário, 2 mítico, 3 bebê
  gr: number;
  cr: number;
  hab: string | null;
  vars: number;
  from: number;
  to: Array<[number, string]>;
  rk?: Record<string, number>;
};

async function main() {
  const ids = Array.from({ length: MAX }, (_, i) => i + 1);
  const facts: Record<number, Fact> = {};
  const chainUrls = new Map<string, number[]>();

  let done = 0;
  await pool(ids, 10, async (id) => {
    const [p, s] = await Promise.all([get(`${API}/pokemon/${id}`), get(`${API}/pokemon-species/${id}`)]);
    if (!p || !s) throw new Error(`id ${id} ausente`);
    const stats: Array<[string, number]> = p.stats.map((x: any) => [x.stat.name, x.base_stat]);
    const top = stats.reduce((a, b) => (b[1] > a[1] ? b : a));
    facts[id] = {
      h: p.height,
      w: p.weight,
      bst: stats.reduce((n, x) => n + x[1], 0),
      top,
      leg: s.is_mythical ? 2 : s.is_legendary ? 1 : s.is_baby ? 3 : 0,
      gr: s.gender_rate,
      cr: s.capture_rate,
      hab: s.habitat?.name ?? null,
      vars: Math.max(0, s.varieties.length - 1),
      from: s.evolves_from_species ? idFromUrl(s.evolves_from_species.url) : 0,
      to: []
    };
    const list = chainUrls.get(s.evolution_chain.url) ?? [];
    list.push(id);
    chainUrls.set(s.evolution_chain.url, list);
    if (++done % 100 === 0) console.log(`species ${done}/${MAX}`);
  });

  // Cadeias de evolução → "evolui para".
  const how = (d: any): string => {
    if (!d) return "O";
    if (d.min_level) return `L${d.min_level}`;
    if (d.trigger?.name === "trade") return "T";
    if (d.item) return "I";
    if (d.min_happiness) return "H";
    return "O";
  };
  await pool([...chainUrls.keys()], 10, async (url) => {
    const chain = await get(url);
    const walk = (node: any) => {
      const from = idFromUrl(node.species.url);
      for (const next of node.evolves_to) {
        const to = idFromUrl(next.species.url);
        if (facts[from] && to <= MAX) facts[from].to.push([to, how(next.evolution_details?.[0])]);
        walk(next);
      }
    };
    if (chain) walk(chain.chain);
  });

  // Rankings (só os destaques, top 10).
  const rank = (key: string, value: (f: Fact) => number, asc = false) => {
    const sorted = ids.slice().sort((a, b) => (asc ? value(facts[a]) - value(facts[b]) : value(facts[b]) - value(facts[a])));
    sorted.slice(0, 10).forEach((id, i) => ((facts[id].rk ??= {})[key] = i + 1));
  };
  rank("heavy", (f) => f.w);
  rank("light", (f) => f.w, true);
  rank("tall", (f) => f.h);
  rank("short", (f) => f.h, true);
  rank("bst", (f) => f.bst);

  writeFileSync(resolve(process.cwd(), "src/journal-data/dex-facts.generated.json"), JSON.stringify(facts));
  console.log("dex-facts ok:", Object.keys(facts).length);

  // Mapa forma → espécie (megas, regionais, formas do jogo).
  const formIds = Array.from({ length: 330 }, (_, i) => 10001 + i);
  const map: Record<number, number> = {};
  await pool(formIds, 10, async (id) => {
    const p = await get(`${API}/pokemon/${id}`);
    if (p) map[id] = idFromUrl(p.species.url);
  });
  for (let n = 1; n <= 28; n++) map[201000 + n] = 201; // letras do Unown
  writeFileSync(resolve(process.cwd(), "src/journal-data/form-species.generated.json"), JSON.stringify(map));
  console.log("form-species ok:", Object.keys(map).length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
