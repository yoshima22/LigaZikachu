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

// ── Standard 2026: cartas com Regulation Mark H, I, J (e futuras) ─────────────
export const CURRENT_STANDARD_MARKS = ["H", "I", "J"] as const;
export type StandardMark = typeof CURRENT_STANDARD_MARKS[number];

export interface TcgCard {
  id: string;
  name: string;
  supertype: string;
  subtypes: string[];
  types?: string[];
  text?: string;
  flavorText?: string;
  imageSmall: string;
  imageLarge: string;
  set: { id: string; name: string; series: string };
  number: string;
  rarity?: string;
  regulationMark?: string;   // A, B, C, D, E, F, G (rotated) | H, I, J (standard)
  legalities?: { standard?: string; expanded?: string; unlimited?: string };
}

/** Regra da temporada da Liga: somente Regulation Mark H, I ou J. */
export function isStandardLegal(card: TcgCard): boolean {
  return !!card.regulationMark &&
    (CURRENT_STANDARD_MARKS as readonly string[]).includes(card.regulationMark);
}

function mapCard(raw: Record<string, unknown>): TcgCard {
  const images = raw.images as Record<string, string>;
  const set = raw.set as Record<string, unknown>;
  const abilities = raw.abilities as Array<{ name: string; text: string }> | undefined;
  const attacks = raw.attacks as Array<{ name: string; text?: string }> | undefined;
  const rules = raw.rules as string[] | undefined;

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
    regulationMark: (raw.regulationMark as string) ?? undefined,
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
      // Buscar múltiplas versões para poder filtrar pela regulation mark
      const cards = (await searchCards(resolved, 20)).filter(
        (card) => card.name.trim().toLowerCase() === resolved.trim().toLowerCase(),
      );
      if (cards.length === 0) return [];

      if (!preferLegal) return cards.slice(0, 1);

      // 1. Preferir versão com Regulation Mark Standard (H, I, J)
      const legalByMark = cards.find(c => isStandardLegal(c));
      if (legalByMark) return [legalByMark];

      // 2. Nenhuma versão Standard encontrada → não sugerir essa carta
      return [];
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
    DRAW:         `subtypes:Supporter rules:"draw"`,
    SEARCH:       `rules:"search"`,
    SWITCH:       `rules:"Switch"`,
    DISRUPTION:   `subtypes:Supporter rules:"opponent"`,
    RECOVERY:     `rules:"from your discard"`,
    ACCELERATION: `rules:"attach Energy"`,
  };

  const q = encodeURIComponent(queries[fn]);
  const url = `${TCG_BASE}/cards?q=${q}&pageSize=${Math.max(20, limit * 4)}&orderBy=-set.releaseDate`;

  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (res.ok) {
      const json = await res.json() as { data: Record<string, unknown>[] };
      const cards = (json.data ?? []).map(mapCard).filter(isStandardLegal).slice(0, limit);
      if (cards.length > 0) return cards;
    }
  } catch { /* usa o catálogo verificado abaixo */ }

  const fallbackNames: Record<typeof fn, string[]> = {
    DRAW: ["Judge", "Iono", "Professor's Research"],
    SEARCH: ["Ultra Ball", "Buddy-Buddy Poffin", "Arven"],
    SWITCH: ["Switch", "Switch Cart", "Rescue Board"],
    DISRUPTION: ["Judge", "Iono", "Boss's Orders"],
    RECOVERY: ["Night Stretcher", "Energy Retrieval", "Super Rod"],
    ACCELERATION: ["Energy Retrieval", "Earthen Vessel", "Dark Patch"],
  };
  return (await fetchCardsByNames(fallbackNames[fn], true)).slice(0, limit);
}

// ── Buscar cartas similares por efeito de texto (Standard apenas) ─────────────

export async function searchSimilarEffect(textKeyword: string, subtype?: string, limit = 6): Promise<TcgCard[]> {
  const parts = [`rules:"${textKeyword}"`];
  if (subtype) parts.push(`subtypes:${subtype}`);
  const q = encodeURIComponent(parts.join(" "));
  const url = `${TCG_BASE}/cards?q=${q}&pageSize=${limit}&orderBy=-set.releaseDate`;

  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json() as { data: Record<string, unknown>[] };
    return (json.data ?? []).map(mapCard).filter(isStandardLegal);
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
