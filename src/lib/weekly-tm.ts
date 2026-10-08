// TMs da Semana (Miauvadão): 5 slots fixos que só resetam na segunda-feira, 00:00 (Brasília).

const BRT_UTC_OFFSET_MS = 3 * 60 * 60_000;
const WEEK_MS = 7 * 24 * 60 * 60_000;

export const WEEKLY_TM_SLOTS = 5;

/** Janela da semana atual: de segunda 00:00 BRT até a próxima segunda 00:00 BRT. */
export function getWeeklyTmWindow(now = new Date()) {
  const brt = new Date(now.getTime() - BRT_UTC_OFFSET_MS);
  const sinceMonday = (brt.getUTCDay() + 6) % 7; // segunda = 0
  const startBrt = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() - sinceMonday);
  const start = new Date(startBrt + BRT_UTC_OFFSET_MS);
  return { start, next: new Date(start.getTime() + WEEK_MS) };
}

/** Sorteia até `count` itens diferentes (nunca repete). */
export function pickDistinct<T>(items: readonly T[], count: number, rng: () => number = Math.random): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/** Slot guardado no banco. Estoque sempre 1: comprou, o slot fica apagado até o reset. */
export type WeeklyTmSlot = {
  shopItemId: string;
  abilityKey: string;
  name: string;
  originalPrice: number;
  discountPct: number;
  finalPrice: number;
  sold: 0 | 1;
  soldAt?: string;
  soldToName?: string;
};

/** Vitrine entregue ao cliente (já com compatibilidade e preço em LC). */
export type WeeklyTmView = {
  weekEndsAt: string;
  ligaCashEnabled: boolean;
  slots: Array<{
    index: number;
    shopItemId: string;
    abilityKey: string;
    name: string;
    imageUrl: string | null;
    ability: {
      name: string;
      category: string | null;
      effectName: string | null;
      trigger: string | null;
      activations: number;
      scale: string | null;
      dex: string | null;
      description: string;
    } | null;
    originalPrice: number;
    discountPct: number;
    finalPrice: number;
    priceLc: number;
    sold: boolean;
    soldToName: string | null;
    /** TM ainda à venda (ativo na loja e com espécie liberada). */
    available: boolean;
    compatibleIds: number[];
    mine: Array<{ id: string; pokemonId: number; nickname: string | null; level: number; unlocked: boolean }>;
  }>;
};
