export type PrizeConfig =
  | { type: "COINS"; amount: number }
  | { type: "STICKER"; cardId: string; cardName: string }
  | { type: "TICKET"; itemId: string }
  | { type: "COSMETIC"; itemId: string; itemName: string }
  | { type: "CUSTOM" };
