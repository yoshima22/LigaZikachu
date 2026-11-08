// Loja de Pedidos do Bazar — constantes e tipos (as mutações ficam em bazar/actions.ts).
export const BUY_ORDER_MAX_ACTIVE = 5;
export const BUY_ORDER_MAX_PRICE = 1_000_000;
export const BUY_ORDER_MAX_QUANTITY = 99;
export const BUY_ORDER_DURATIONS = [3, 7, 14] as const;
export const BUY_ORDERS_PAGE_SIZE = 12;
export const BUY_ORDER_NO_FUNDS_MESSAGE =
  "Este jogador não tem esse valor disponível no momento. Volte mais tarde — o pedido continua aberto.";

/** Tipos de loja que não entram em pedidos (cosméticos, ovos e itens intransferíveis). */
export const BUY_ORDER_EXCLUDED_ITEM_TYPES = [
  "TITLE", "BANNER", "FRAME",
  "EGG_COMMON", "EGG_RARE", "EGG_SPECIAL", "EGG_LAB", "EGG_EVENT",
  "EGG_GEN1", "EGG_GEN2", "EGG_GEN3", "EGG_GEN4", "EGG_GEN5", "EGG_GEN6", "EGG_GEN7", "EGG_GEN8", "EGG_GEN9", "EGG_GEN6PLUS",
  "MASCOT_RARE_SWEET",
] as const;

export type BuyOrderView = {
  id: string;
  kind: "MASCOT" | "ITEM";
  label: string;
  pokemonId: number | null;
  minLevel: number;
  personality: string | null;
  eggType: string | null;
  topStats: string | null;
  quantity: number;
  imageUrl: string | null;
  priceCoins: number;
  expiresAt: string;
  createdAt: string;
  buyer: { id: string; displayName: string };
  mine: boolean;
  /** O saldo atual do criador cobre o valor? (não revela o saldo exato) */
  covered: boolean;
  /** O jogador logado tem algo que atende ao pedido? */
  canFulfill: boolean;
};

// ── Requisitos opcionais de mascote ───────────────────────────────────────────
export const ORDER_STAT_KEYS = ["statForce", "statAgility", "statCharisma", "statInstinct", "statVitality"] as const;
export type OrderStatKey = (typeof ORDER_STAT_KEYS)[number];
export const ORDER_STAT_LABEL: Record<OrderStatKey, string> = {
  statForce: "Força", statAgility: "Agilidade", statCharisma: "Carisma", statInstinct: "Instinto", statVitality: "Vitalidade",
};
export const ORDER_EGG_TYPES = ["COMMON", "RARE", "SPECIAL", "LAB", "EVENT"] as const;
export const ORDER_EGG_LABEL: Record<string, string> = {
  COMMON: "Ovo Comum", RARE: "Ovo Raro", SPECIAL: "Ovo Especial", LAB: "Ovo de Laboratório", EVENT: "Ovo de Evento",
};

export type MascotReq = { personality?: string | null; eggType?: string | null; topStats?: string | null };
export type MascotFacts = {
  personality: string; hatchedFromEggType: string | null;
  statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number;
};

/** Os 3 atributos escolhidos precisam ser os 3 mais altos (empate com os demais vale). */
export function matchesTopStats(topStats: string | null | undefined, m: MascotFacts) {
  if (!topStats) return true;
  const chosen = topStats.split(",") as OrderStatKey[];
  const rest = ORDER_STAT_KEYS.filter((k) => !chosen.includes(k));
  return Math.min(...chosen.map((k) => m[k])) >= Math.max(...rest.map((k) => m[k]));
}

export function matchesMascotRequirements(req: MascotReq, m: MascotFacts) {
  if (req.personality && m.personality !== req.personality) return false;
  if (req.eggType && !req.eggType.split(",").includes(m.hatchedFromEggType ?? "")) return false;
  return matchesTopStats(req.topStats, m);
}
