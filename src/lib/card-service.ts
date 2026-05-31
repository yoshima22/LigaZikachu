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

/** Regra oficial: carta é Standard-legal se tiver Regulation Mark H, I, J (ou futura) */
export function isStandardLegal(card: TcgCard): boolean {
  if (card.regulationMark) {
    return (CURRENT_STANDARD_MARKS as readonly string[]).includes(card.regulationMark);
  }
  // Cartas sem regulation mark (Energy básica, muito antigas) — usar campo legalities
  return card.legalities?.standard === "Legal";
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
      const cards = await searchCards(resolved, 12);
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

// Standard 2026: H, I, J — filtro aplicado na query E no código
const STD_MARKS = `(regulationMark:H OR regulationMark:I OR regulationMark:J)`;

export async function searchStandardByFunction(
  fn: "DRAW" | "SEARCH" | "SWITCH" | "DISRUPTION" | "RECOVERY" | "ACCELERATION",
  limit = 8
): Promise<TcgCard[]> {
  const queries: Record<string, string> = {
    DRAW:         `subtypes:Supporter ${STD_MARKS}`,
    SEARCH:       `(subtypes:Item OR subtypes:Supporter) text:"search your deck" ${STD_MARKS}`,
    SWITCH:       `subtypes:Item text:"Switch" ${STD_MARKS}`,
    DISRUPTION:   `subtypes:Supporter ${STD_MARKS}`,
    RECOVERY:     `subtypes:Item (text:"recover" OR text:"from your discard") ${STD_MARKS}`,
    ACCELERATION: `(subtypes:Item OR subtypes:Supporter) text:"attach" text:"Energy" ${STD_MARKS}`
  };

  const q = encodeURIComponent(queries[fn]);
  const url = `${TCG_BASE}/cards?q=${q}&pageSize=${limit}&orderBy=-set.releaseDate`;

  try {
    const res = await fetch(url, { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json() as { data: Record<string, unknown>[] };
    // Duplo filtro: query por mark + verificação no código
    return (json.data ?? []).map(mapCard).filter(isStandardLegal);
  } catch { return []; }
}

// ── Buscar cartas similares por efeito de texto (Standard apenas) ─────────────

export async function searchSimilarEffect(textKeyword: string, subtype?: string, limit = 6): Promise<TcgCard[]> {
  const parts = [STD_MARKS, `text:"${textKeyword}"`];
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

// ── Verificar se uma carta é Standard pelo regulation mark ────────────────────

export function isStandardLegal(card: TcgCard): boolean {
  const mark = (card as unknown as Record<string, string>).regulationMark;
  if (mark) return ["H", "I", "J"].includes(mark);
  // Fallback: usar legalities se não tiver mark
  return card.legalities?.standard === "Legal";
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
