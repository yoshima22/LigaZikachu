/**
 * Configurações públicas da ZikaShop — sem "use server"
 * Pode ser importado tanto em client quanto em server components.
 */

export const SUGGESTED_PRICES: Record<string, Record<string, number>> = {
  TITLE:           { COMMON:   50, UNCOMMON:  120, RARE:   250, EPIC:   500, LEGENDARY: 1000 },
  BANNER:          { COMMON:   80, UNCOMMON:  200, RARE:   400, EPIC:   800, LEGENDARY: 1500 },
  FRAME:           { COMMON:  100, UNCOMMON:  250, RARE:   500, EPIC:  1000, LEGENDARY: 2000 },
  ZIKALOOT_TICKET: { COMMON:  150, UNCOMMON:  150, RARE:   150, EPIC:   150, LEGENDARY:  150 },
};

export function getSuggestedPrice(type: string, rarity: string): number {
  return SUGGESTED_PRICES[type]?.[rarity] ?? 100;
}
