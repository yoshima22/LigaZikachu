import type { Prisma, PrismaClient, ShopPromotionScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PromotionDb = PrismaClient | Prisma.TransactionClient;

export type ShopPromotionPriceInput = {
  id: string;
  name: string;
  scope: ShopPromotionScope;
  itemId: string | null;
  discountPct: number;
  startsAt: Date;
  endsAt: Date;
  active: boolean;
};

export type EffectiveShopPrice = {
  originalPrice: number;
  price: number;
  discountPct: number;
  promotionId: string | null;
  promotionName: string | null;
  promotionEndsAt: Date | null;
};

export function resolveShopPromotionPrice(
  originalPrice: number,
  itemId: string,
  promotions: readonly ShopPromotionPriceInput[],
  now = new Date(),
): EffectiveShopPrice {
  const applicable = promotions
    .filter((promotion) =>
      promotion.active
      && promotion.startsAt <= now
      && promotion.endsAt > now
      && (promotion.scope === "GLOBAL" || promotion.itemId === itemId),
    )
    .sort((left, right) =>
      right.discountPct - left.discountPct
      || Number(right.scope === "ITEM") - Number(left.scope === "ITEM")
      || left.endsAt.getTime() - right.endsAt.getTime(),
    );
  const promotion = applicable[0];
  if (!promotion) {
    return {
      originalPrice,
      price: originalPrice,
      discountPct: 0,
      promotionId: null,
      promotionName: null,
      promotionEndsAt: null,
    };
  }

  const discountPct = Math.max(1, Math.min(99, Math.trunc(promotion.discountPct)));
  return {
    originalPrice,
    price: Math.max(1, Math.floor(originalPrice * (1 - discountPct / 100))),
    discountPct,
    promotionId: promotion.id,
    promotionName: promotion.name,
    promotionEndsAt: promotion.endsAt,
  };
}

export async function getCurrentShopPromotionPrice(
  itemId: string,
  originalPrice: number,
  db: PromotionDb = prisma,
  now = new Date(),
) {
  const promotions = await db.shopPromotion.findMany({
    where: {
      active: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
      OR: [{ scope: "GLOBAL" }, { scope: "ITEM", itemId }],
    },
    select: {
      id: true,
      name: true,
      scope: true,
      itemId: true,
      discountPct: true,
      startsAt: true,
      endsAt: true,
      active: true,
    },
  });
  return resolveShopPromotionPrice(originalPrice, itemId, promotions, now);
}
