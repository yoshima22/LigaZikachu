// Regras de desconto do Miauvadão, compartilhadas pelos slots padrão e pelos TMs da Semana.

export const MIAUVADAO_MAX_DISCOUNT = 70;
/** Teto de desconto de Pedras de Mega e TMs (itens de poder). */
export const MIAUVADAO_MEGA_STONE_MAX_DISCOUNT = 20;

/** Faixa de desconto por raridade do item. */
export const DISCOUNT_BY_RARITY: Record<string, [number, number]> = {
  COMMON: [15, 35],
  UNCOMMON: [12, 28],
  RARE: [10, 25],
  EPIC: [8, 20],
  LEGENDARY: [5, 15],
  MYTHIC: [5, 12],
  RELIC: [5, 10],
};

/** Quanto mais ZC no cofre, maior o bônus de desconto (máx. +14 pontos). */
export function vaultDiscountBonus(vaultBalance: number) {
  return Math.min(14, Math.floor(Math.sqrt(Math.max(0, vaultBalance) / 500) * 3));
}

/** Mesma conta dos slots padrão: faixa da raridade + bônus do cofre, respeitando o teto. */
export function rollDiscountPct(args: {
  rarity: string;
  capped: boolean;
  vaultBalance: number;
  rng?: () => number;
  extraBonus?: number;
}) {
  const rng = args.rng ?? Math.random;
  const [minDisc, maxDisc] = DISCOUNT_BY_RARITY[args.rarity] ?? [10, 25];
  const maxAllowed = args.capped ? MIAUVADAO_MEGA_STONE_MAX_DISCOUNT : MIAUVADAO_MAX_DISCOUNT;
  const raw = minDisc + Math.floor(rng() * (maxDisc - minDisc + 1)) + vaultDiscountBonus(args.vaultBalance) + (args.extraBonus ?? 0);
  return Math.min(maxAllowed, raw >= maxAllowed ? (rng() < 0.08 ? maxAllowed : maxAllowed - 1) : raw);
}
