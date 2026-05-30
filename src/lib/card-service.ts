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

export async function searchCards(query: string, pageSize = 8): Promise<TcgCard[]> {
  try {
    const q = encodeURIComponent(`name:"${query}"`);
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

export async function fetchCardsByNames(names: string[]): Promise<TcgCard[]> {
  const results = await Promise.allSettled(
    names.map((rawName) => searchCards(resolveCardName(rawName), 1))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<TcgCard[]> => r.status === "fulfilled")
    .flatMap((r) => r.value.slice(0, 1))
    .filter((c) => c.imageSmall); // só cartas com imagem
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
