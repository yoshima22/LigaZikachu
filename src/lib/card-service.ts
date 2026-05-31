// ── Pokemon TCG API Service ────────────────────────────────────────────────────
// Documentação: https://pokemontcg.io/
// Chave opcional: defina POKEMON_TCG_API_KEY para mais rate limit

import { resolveCardName } from "./card-names-ptbr";

const TCG_BASE = "https://api.pokemontcg.io/v2";

function headers(): Record<string, string> {
  const key = process.env.POKEMON_TCG_API_KEY;
  if (key) return { "X-Api-Key": key };
  return {};
}

export interface TcgCard {
  id: string;
  name: string;
  supertype: string;          // Pokémon | Trainer | Energy
  subtypes: string[];         // Basic, Stage 1, Item, Supporter, etc.
  types?: string[];           // Fire, Water, etc.
  text?: string;              // habilidades / efeitos (primeiro texto)
  flavorText?: string;
  imageSmall: string;
  imageLarge: string;
  set: { id: string; name: string; series: string };
  number: string;
  rarity?: string;
  legalities?: { standard?: string; expanded?: string; unlimited?: string };
}

function mapCard(raw: Record<string, unknown>): TcgCard {
  const images = raw.images as Record<string, string>;
  const set = raw.set as Record<string, unknown>;
  const abilities = raw.abilities as Array<{ name: string; text: string }> | undefined;
  const attacks = raw.attacks as Array<{ name: string; text?: string }> | undefined;
  const rules = raw.rules as string[] | undefined;

  // Primeiro texto relevante da carta
  const text =
    abilities?.[0]?.text ??
    attacks?.[0]?.text ??
    rules?.[0] ??
    undefined;

  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    supertype: String(raw.supertype ?? ""),
    subtypes: (raw.subtypes as string[]) ?? [],
    types: (raw.types as string[]) ?? undefined,
    text,
    flavorText: (raw.flavorText as string) ?? undefined,
    imageSmall: images?.small ?? "",
    imageLarge: images?.large ?? "",
    set: {
      id: String((set?.id as string) ?? ""),
      name: String((set?.name as string) ?? ""),
      series: String((set?.series as string) ?? "")
    },
    number: String(raw.number ?? ""),
    rarity: (raw.rarity as string) ?? undefined,
    legalities: (raw.legalities as TcgCard["legalities"]) ?? undefined
  };
}

// ── Buscar cartas por nome exato ou parcial ──────────────────────────────────

// Nomes que são Supporters — força filtro de supertype para evitar pegar o Pokémon
const KNOWN_SUPPORTERS = new Set([
  "iono", "professor's research", "boss's orders", "marnie", "judge",
  "cynthia", "n", "sonia", "hop", "raihan", "arven", "lillie",
  "colress's experiment", "irida", "melony", "acerola"
]);

export async function searchCards(query: string, pageSize = 8): Promise<TcgCard[]> {
  try {
    const isKnownSupporter = KNOWN_SUPPORTERS.has(query.toLowerCase());
    const nameQ = `name:"${query}"`;
    const typeQ = isKnownSupporter ? ` supertype:Trainer subtypes:Supporter` : "";
    const q = encodeURIComponent(`${nameQ}${typeQ}`);
    const url = `${TCG_BASE}/cards?q=${q}&pageSize=${pageSize}&orderBy=-set.releaseDate`;
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json() as { data: Record<string, unknown>[] };
    return (json.data ?? []).map(mapCard);
  } catch {
    return [];
  }
}

// ── Buscar lista de cartas por nomes (para sugestões da IA) ──────────────────

export async function fetchCardsByNames(names: string[], preferLegal = true): Promise<TcgCard[]> {
  const results = await Promise.allSettled(
    names.map(async (rawName) => {
      const resolved = resolveCardName(rawName);
      const cards = await searchCards(resolved, preferLegal ? 10 : 1);

      if (!preferLegal || cards.length === 0) return cards.slice(0, 1);

      // Preferir versão legal no Standard quando possível
      const legal = cards.find(c => c.legalities?.standard === "Legal");
      if (legal) return [legal];

      // Fallback: versão mais recente
      return cards.slice(0, 1);
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<TcgCard[]> => r.status === "fulfilled")
    .flatMap((r) => r.value.slice(0, 1))
    .filter((c) => c.imageSmall); // só cartas com imagem
}

// ── Buscar por função/categoria no Standard atual ─────────────────────────────
// Usa a TCG API diretamente — sem hardcode de nomes

export async function searchStandardByFunction(
  fn: "DRAW" | "SEARCH" | "SWITCH" | "DISRUPTION" | "RECOVERY" | "ACCELERATION",
  limit = 8
): Promise<TcgCard[]> {
  const queries: Record<string, string> = {
    DRAW:         `subtypes:Supporter legalities.standard:Legal -name:*ex`,
    SEARCH:       `subtypes:Item text:"search your deck" legalities.standard:Legal`,
    SWITCH:       `subtypes:Item text:"switch" legalities.standard:Legal`,
    DISRUPTION:   `subtypes:Supporter legalities.standard:Legal text:"opponent"`,
    RECOVERY:     `subtypes:Item text:"recover" legalities.standard:Legal`,
    ACCELERATION: `subtypes:Item text:"attach" text:"energy" legalities.standard:Legal`
  };

  const q = encodeURIComponent(queries[fn] ?? `legalities.standard:Legal`);
  const url = `${TCG_BASE}/cards?q=${q}&pageSize=${limit}&orderBy=-set.releaseDate`;

  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json() as { data: Record<string, unknown>[] };
    return (json.data ?? []).map(mapCard);
  } catch { return []; }
}

// ── Buscar cartas similares por efeito de texto ────────────────────────────────

export async function searchSimilarEffect(textKeyword: string, subtype?: string, limit = 6): Promise<TcgCard[]> {
  const parts = [`legalities.standard:Legal`, `text:"${textKeyword}"`];
  if (subtype) parts.push(`subtypes:${subtype}`);
  const q = encodeURIComponent(parts.join(" "));
  const url = `${TCG_BASE}/cards?q=${q}&pageSize=${limit}&orderBy=-set.releaseDate`;

  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json() as { data: Record<string, unknown>[] };
    return (json.data ?? []).map(mapCard);
  } catch { return []; }
}

// ── Buscar carta por ID ──────────────────────────────────────────────────────

export async function getCardById(id: string): Promise<TcgCard | null> {
  try {
    const res = await fetch(`${TCG_BASE}/cards/${id}`, {
      headers: headers(),
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    const json = await res.json() as { data: Record<string, unknown> };
    return mapCard(json.data);
  } catch {
    return null;
  }
}
