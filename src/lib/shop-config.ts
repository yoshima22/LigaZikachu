/**
 * Configurações públicas da ZikaShop — sem "use server"
 * Pode ser importado tanto em client quanto em server components.
 */

export const SUGGESTED_PRICES: Record<string, Record<string, number>> = {
  TITLE:           { COMMON:   50, UNCOMMON:  120, RARE:   250, EPIC:   500, LEGENDARY: 1000 },
  BANNER:          { COMMON:   80, UNCOMMON:  200, RARE:   400, EPIC:   800, LEGENDARY: 1500 },
  FRAME:           { COMMON:  100, UNCOMMON:  250, RARE:   500, EPIC:  1000, LEGENDARY: 2000 },
  ZIKALOOT_TICKET: { COMMON:  150, UNCOMMON:  150, RARE:   150, EPIC:   150, LEGENDARY:  150 },
  EGG_COMMON:      { COMMON: 1200, UNCOMMON: 1200, RARE:  1200, EPIC:  1200, LEGENDARY: 1200 },
  EGG_RARE:        { COMMON: 2800, UNCOMMON: 2800, RARE:  2800, EPIC:  2800, LEGENDARY: 2800 },
  EGG_SPECIAL:     { COMMON: 5000, UNCOMMON: 5000, RARE:  5000, EPIC:  5000, LEGENDARY: 5000 },
  MASCOT_FOOD:     { COMMON:  120, UNCOMMON:  120, RARE:   120, EPIC:   120, LEGENDARY:  120 },
  MASCOT_SWEET:    { COMMON:  350, UNCOMMON:  350, RARE:   350, EPIC:   350, LEGENDARY:  350 },
};

export function getSuggestedPrice(type: string, rarity: string): number {
  return SUGGESTED_PRICES[type]?.[rarity] ?? 100;
}
