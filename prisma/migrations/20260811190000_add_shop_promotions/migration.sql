CREATE TYPE "ShopPromotionScope" AS ENUM ('GLOBAL', 'ITEM');

CREATE TABLE "shop_promotions" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "ShopPromotionScope" NOT NULL,
  "itemId" TEXT,
  "discountPct" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "shop_promotions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shop_promotions_active_startsAt_endsAt_idx"
  ON "shop_promotions"("active", "startsAt", "endsAt");
CREATE INDEX "shop_promotions_itemId_active_idx"
  ON "shop_promotions"("itemId", "active");

ALTER TABLE "shop_promotions"
  ADD CONSTRAINT "shop_promotions_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "shop_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_promotions"
  ADD CONSTRAINT "shop_promotions_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
