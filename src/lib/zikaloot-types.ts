export type PrizeItem =
  | { type: "COINS"; amount: number; label?: string }
  | { type: "STICKER"; cardId: string; cardName: string }
  | { type: "TICKET"; itemId: string; itemName?: string }
  | { type: "COSMETIC"; itemId: string; itemName: string }
  | { type: "CUSTOM"; description: string };

// prizeConfig stored as { prizes: PrizeItem[] }
export type PrizeConfig = { prizes: PrizeItem[] };

// backwards compat for old single-prize format
export type LegacyPrizeConfig = PrizeItem;
