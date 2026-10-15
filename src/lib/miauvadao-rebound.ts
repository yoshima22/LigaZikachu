// Rebote do Miauvadão: segunda chance de compra para quem não conseguiu nenhum slot na rotação.
// Regras (definidas pelos GMs):
// - só nos primeiros 25 min após a rotação geral e só para slots esgotados;
// - só para quem não comprou nenhum slot global (o slot exclusivo não conta) naquela rotação;
// - 1 cópia por slot, no máximo 2 compras de rebote por rotação, desconto um pouco menor que o do slot;
// - o item comprado fica vinculado à conta (não negociável).

export const REBOUND_WINDOW_MINUTES = 25;
export const REBOUND_MAX_PER_CYCLE = 2;
/** Pontos percentuais a menos de desconto em relação ao slot original. */
export const REBOUND_DISCOUNT_DROP = 5;

export type ReboundSlotOffer = {
  itemType: string;
  shopItemId?: string;
  name: string;
  imageUrl?: string;
  description?: string;
  originalPrice: number;
  discountPct: number;
  finalPrice: number;
  stock: number;
  sold: number;
};

/** Estado do jogador guardado em miauvadao_config.playerRefreshData[playerId]. */
export type ReboundPlayerState = {
  globalBuyCycle?: string;
  reboundCycle?: string;
  reboundBought?: string[];
};

export type ReboundBlock = "window_closed" | "bought_global" | "limit_reached" | null;

export type ReboundOfferView = {
  index: number;
  key: string;
  itemType: string;
  shopItemId?: string;
  name: string;
  imageUrl?: string;
  description?: string;
  originalPrice: number;
  discountPct: number;
  finalPrice: number;
  /** Slot ainda tem estoque no principal (não esgotou) — só aparece no preview de debug. */
  slotHasStock: boolean;
  /** Este slot/item já foi comprado como rebote nesta rotação. */
  alreadyBought: boolean;
};

export type ReboundView = {
  windowEndsAt: string;
  block: ReboundBlock;
  boughtCount: number;
  maxPerCycle: number;
  offers: ReboundOfferView[];
};

export const reboundKey = (index: number, offer: { shopItemId?: string; itemType: string }) =>
  `${index}:${offer.shopItemId ?? offer.itemType}`;

export function reboundWindowEnd(rotationStart: Date) {
  return new Date(rotationStart.getTime() + REBOUND_WINDOW_MINUTES * 60_000);
}

export function reboundPrice(offer: Pick<ReboundSlotOffer, "originalPrice" | "discountPct">) {
  const discountPct = Math.max(0, offer.discountPct - REBOUND_DISCOUNT_DROP);
  return { discountPct, finalPrice: Math.max(1, Math.round(offer.originalPrice * (1 - discountPct / 100))) };
}

/**
 * Calcula o que o jogador pode ver/comprar de rebote. O rebote sempre espelha o item atual do slot
 * (se o slot for trocado, o rebote acompanha); só existe quando o slot esgotou.
 * `includeAll` (debug de admin) lista todos os slots, mesmo sem estar esgotados ou fora da janela.
 */
export function computeRebound(input: {
  offers: ReboundSlotOffer[];
  entry: ReboundPlayerState | null | undefined;
  rotationStart: Date;
  now?: Date;
  includeAll?: boolean;
}): ReboundView {
  const now = input.now ?? new Date();
  const iso = input.rotationStart.toISOString();
  const windowEnd = reboundWindowEnd(input.rotationStart);
  const entry = input.entry ?? {};
  const bought = entry.reboundCycle === iso ? entry.reboundBought ?? [] : [];
  let block: ReboundBlock = null;
  if (now >= windowEnd) block = "window_closed";
  else if (entry.globalBuyCycle === iso) block = "bought_global";
  else if (bought.length >= REBOUND_MAX_PER_CYCLE) block = "limit_reached";

  const offers: ReboundOfferView[] = [];
  input.offers.forEach((offer, index) => {
    const soldOut = offer.sold >= offer.stock;
    if (!soldOut && !input.includeAll) return;
    const key = reboundKey(index, offer);
    offers.push({
      index,
      key,
      itemType: offer.itemType,
      shopItemId: offer.shopItemId,
      name: offer.name,
      imageUrl: offer.imageUrl,
      description: offer.description,
      originalPrice: offer.originalPrice,
      ...reboundPrice(offer),
      slotHasStock: !soldOut,
      alreadyBought: bought.includes(key),
    });
  });
  return { windowEndsAt: windowEnd.toISOString(), block, boughtCount: bought.length, maxPerCycle: REBOUND_MAX_PER_CYCLE, offers };
}

export const REBOUND_BLOCK_MESSAGE: Record<Exclude<ReboundBlock, null>, string> = {
  window_closed: "O Rebote só funciona nos primeiros 25 minutos após a rotação do Bazar.",
  bought_global: "Você já comprou um slot nesta rotação, então não tem direito ao Rebote.",
  limit_reached: "Você já usou suas 2 compras de Rebote desta rotação. Volte na próxima.",
};
