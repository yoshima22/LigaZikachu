ALTER TABLE "bazar_listings"
ADD COLUMN "premiumUntil" TIMESTAMP(3);

CREATE INDEX "bazar_listings_status_premiumUntil_idx"
ON "bazar_listings"("status", "premiumUntil");

ALTER TABLE "miauvadao_config"
ADD COLUMN "premiumTickerNextAt" TIMESTAMP(3),
ADD COLUMN "premiumTickerLastListingId" TEXT;
