// Consultas sobre o catálogo de habilidades (aba Habilidades): por mascote e por habilidade.
import { SPECIES_ABILITIES, ABILITIES } from "./data.generated";
import { getAbilityInfo, getSpeciesAbilities, ABILITY_CATEGORIES, type AbilityCategory, type AbilityInfo } from "./index";
import { getPokemonName } from "@/lib/mascot-data";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export type AbilityHolders = { normal: number[]; hidden: number[] };
let holders: Map<string, AbilityHolders> | null = null;

/** Quais espécies têm cada habilidade (comum ou oculta). */
export function getAbilityHolders(slug: string): AbilityHolders {
  if (!holders) {
    holders = new Map();
    for (const [id, [normal, hidden]] of Object.entries(SPECIES_ABILITIES)) {
      const pid = Number(id);
      for (const s of normal) (holders.get(s) ?? holders.set(s, { normal: [], hidden: [] }).get(s)!).normal.push(pid);
      if (hidden && !normal.includes(hidden)) (holders.get(hidden) ?? holders.set(hidden, { normal: [], hidden: [] }).get(hidden)!).hidden.push(pid);
    }
  }
  return holders.get(slug) ?? { normal: [], hidden: [] };
}

export function allTriggers(): string[] {
  const set = new Set<string>();
  for (const slug of Object.keys(ABILITIES)) {
    const t = getAbilityInfo(slug)?.trigger;
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function searchAbilities(args: { q?: string; category?: string; trigger?: string; includeNoEffect?: boolean }): AbilityInfo[] {
  const q = norm(args.q ?? "");
  const result: AbilityInfo[] = [];
  for (const slug of Object.keys(ABILITIES)) {
    const info = getAbilityInfo(slug);
    if (!info) continue;
    if (!info.hasEffect && !(args.includeNoEffect || q)) continue;
    if (args.category && info.category !== args.category) continue;
    if (args.trigger && info.trigger !== args.trigger) continue;
    if (q && !norm(`${info.name} ${info.effectName ?? ""} ${info.category ?? ""}`).includes(q)) continue;
    result.push(info);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export type SpeciesHit = { id: number; name: string; normal: AbilityInfo[]; hidden: AbilityInfo | null };

function toHit(id: number): SpeciesHit {
  const sp = getSpeciesAbilities(id);
  return {
    id,
    name: getPokemonName(id),
    normal: sp.normal.map((s) => getAbilityInfo(s)).filter((x): x is AbilityInfo => Boolean(x)),
    hidden: sp.hidden ? getAbilityInfo(sp.hidden) : null,
  };
}

export function getSpeciesHit(id: number): SpeciesHit | null {
  return SPECIES_ABILITIES[id] ? toHit(id) : null;
}

export function searchSpecies(q: string, limit = 30): SpeciesHit[] {
  const term = norm(q);
  if (!term) return [];
  const out: SpeciesHit[] = [];
  const asNumber = /^\d+$/.test(term) ? Number(term) : null;
  for (const key of Object.keys(SPECIES_ABILITIES)) {
    const id = Number(key);
    if (asNumber !== null ? id !== asNumber : !norm(getPokemonName(id)).includes(term)) continue;
    out.push(toHit(id));
    if (out.length >= limit) break;
  }
  return out;
}

export { ABILITY_CATEGORIES };
export type { AbilityCategory };
