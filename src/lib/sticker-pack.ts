import { PokemonRarity } from "@prisma/client";

// Probabilidades por tipo de pacote
// BÁSICO: figurinhas comuns, lendários muito raros
export const RARITY_WEIGHTS_BASIC: Record<PokemonRarity, number> = {
  COMMON:    60,
  UNCOMMON:  25,
  RARE:      12,
  EPIC:       2.5,
  LEGENDARY:  0.5,   // 0.5% por slot
};

// DELUXE (rarityBoost): mais raro, MAS lendários ainda devem ser especiais
// Legenda estava em 5% — muito alto. Ajustado para 1.2%
export const RARITY_WEIGHTS_BOOST: Record<PokemonRarity, number> = {
  COMMON:    28,
  UNCOMMON:  34,
  RARE:      26,
  EPIC:      10.8,
  LEGENDARY:  1.2,   // era 5% — reduzido para ~1.2% por slot
};

// Conversão de ZikaCoins por duplicata
export const DUPLICATE_COINS: Record<PokemonRarity, number> = {
  COMMON:     5,
  UNCOMMON:  10,
  RARE:      20,
  EPIC:      50,
  LEGENDARY: 100
};

export function pickRarity(rarityBoost: boolean): PokemonRarity {
  const weights = rarityBoost ? RARITY_WEIGHTS_BOOST : RARITY_WEIGHTS_BASIC;
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return rarity as PokemonRarity;
  }
  return PokemonRarity.COMMON;
}

/**
 * Seleciona uma carta de um pool evitando repetições já no pacote.
 * Tenta até 3 vezes pegar uma não-repetida; se não conseguir, aceita repetição.
 */
export function pickCardFromPool<T extends { id: string }>(
  pool: T[],
  alreadyDrawn: Set<string>,
  maxAttempts = 3
): T {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const card = pool[Math.floor(Math.random() * pool.length)];
    if (card && !alreadyDrawn.has(card.id)) return card;
  }
  // Fallback: retorna qualquer carta (pool pode ser pequeno)
  return pool[Math.floor(Math.random() * pool.length)];
}

// Heurística de raridade com base no total de base stats
export function rarityFromStats(baseStatTotal: number, isLegendary: boolean, isMythical: boolean): PokemonRarity {
  if (isLegendary || isMythical) return PokemonRarity.LEGENDARY;
  if (baseStatTotal >= 550) return PokemonRarity.EPIC;
  if (baseStatTotal >= 480) return PokemonRarity.RARE;
  if (baseStatTotal >= 400) return PokemonRarity.UNCOMMON;
  return PokemonRarity.COMMON;
}

// Geração a partir do national ID
export function generationFromId(id: number): number {
  if (id <= 151) return 1;
  if (id <= 251) return 2;
  if (id <= 386) return 3;
  if (id <= 493) return 4;
  if (id <= 649) return 5;
  if (id <= 721) return 6;
  if (id <= 809) return 7;
  if (id <= 905) return 8;
  return 9;
}

export const GENERATION_RANGES: Record<number, [number, number]> = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
  7: [722, 809],
  8: [810, 905],
  9: [906, 1025]
};
