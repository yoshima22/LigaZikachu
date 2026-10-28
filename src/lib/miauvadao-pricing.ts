// Regras de desconto do Miauvadão, compartilhadas pelos slots padrão e pelos TMs da Semana.
import { Prisma } from "@prisma/client";

/**
 * Fração do desconto que sai do cofre. O resto é margem do Miauvadão: com 100%, descontos
 * médios acima de ~20% faziam o cofre perder mais do que os 30% que entram em cada compra.
 */
export const VAULT_DISCOUNT_COVERAGE = 0.5;
/** Fração do preço pago num slot do Miauvadão (em ZC) que entra no cofre. */
export const VAULT_SLOT_SALE_SHARE = 0.3;

/**
 * Acerta o cofre numa compra: entra VAULT_SLOT_SALE_SHARE do pago em ZC e sai VAULT_DISCOUNT_COVERAGE do
 * desconto dado (preço original - preço final, em ZC). O cofre nunca fica negativo.
 */
export async function settleVaultForPurchase(
  tx: Prisma.TransactionClient,
  { coinsToVault, discountZc }: { coinsToVault: number; discountZc: number },
) {
  const net = coinsToVault - Math.round(Math.max(0, discountZc) * VAULT_DISCOUNT_COVERAGE);
  if (net === 0) return;
  await tx.$executeRaw(Prisma.sql`UPDATE miauvadao_config SET "vaultBalance" = GREATEST(0, "vaultBalance" + ${net}) WHERE id = 'singleton'`);
}

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
