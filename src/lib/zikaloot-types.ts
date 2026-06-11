export type PrizeItem =
  | { type: "COINS"; amount: number; label?: string }
  | { type: "STICKER"; cardId: string; cardName: string }
  | { type: "TICKET"; itemId: string; itemName?: string }
  | { type: "COSMETIC"; itemId: string; itemName: string }
  | { type: "CUSTOM"; description: string }
  | { type: "EGG"; eggType: string; qty?: number }
  | { type: "FOOD"; qty: number }
  | { type: "SWEET"; qty: number }
  | { type: "SHOP_ITEM"; shopItemName: string; qty?: number }
  | { type: "STICKER_PACK"; packName: string };

// prizeConfig stored as { prizes: PrizeItem[], maxPicks?: number }
export type PrizeConfig = { prizes: PrizeItem[]; maxPicks?: number };

// backwards compat for old single-prize format
export type LegacyPrizeConfig = PrizeItem;
