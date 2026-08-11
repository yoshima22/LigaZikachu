CREATE TABLE "shop_promotion_items" (
  "promotionId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  CONSTRAINT "shop_promotion_items_pkey" PRIMARY KEY ("promotionId", "itemId")
);

CREATE INDEX "shop_promotion_items_itemId_idx" ON "shop_promotion_items"("itemId");

ALTER TABLE "shop_promotion_items"
ADD CONSTRAINT "shop_promotion_items_promotionId_fkey"
FOREIGN KEY ("promotionId") REFERENCES "shop_promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_promotion_items"
ADD CONSTRAINT "shop_promotion_items_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "shop_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mantém todas as promoções específicas já cadastradas.
INSERT INTO "shop_promotion_items" ("promotionId", "itemId")
SELECT "id", "itemId" FROM "shop_promotions"
WHERE "scope" = 'ITEM' AND "itemId" IS NOT NULL
ON CONFLICT DO NOTHING;
