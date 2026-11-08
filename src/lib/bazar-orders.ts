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
