export type DirectOfferItemIdentity = {
  type: string;
  mascotId?: string;
  shopItemId?: string;
  eggBonusPct?: number;
};

export type DirectInventoryOffer = DirectOfferItemIdentity & {
  quantity: number;
  displayName: string;
};

/**
 * Keeps separately catalogued items distinct in direct negotiations. Several
 * ShopItems share a type (for example, the Rainbow Feather variants), so the
 * type alone is not a safe selection or transfer identity.
 */
export function directOfferItemKey(item: DirectOfferItemIdentity): string {
  if (item.mascotId) return `mascot:${item.mascotId}`;
  if (item.shopItemId) return `shop:${item.shopItemId}`;
  if (item.eggBonusPct !== undefined) return `egg:${item.type}#${item.eggBonusPct}`;
  return `type:${item.type}`;
}

export function toDirectInventoryOffer(item: {
  shopItemId: string;
  type: string;
  name: string;
  quantity?: number;
}): DirectInventoryOffer {
  return {
    shopItemId: item.shopItemId,
    type: item.type,
    quantity: item.quantity ?? 1,
    displayName: item.name,
  };
}

/** Uses the item actually found in inventory as the source of delivery data. */
export function canonicalizeReservedInventoryOffer<T extends DirectInventoryOffer>(
  offer: T,
  inventoryItem: { itemId: string; name: string },
) {
  return {
    ...offer,
    shopItemId: inventoryItem.itemId,
    displayName: inventoryItem.name,
    escrowed: true,
  };
}
