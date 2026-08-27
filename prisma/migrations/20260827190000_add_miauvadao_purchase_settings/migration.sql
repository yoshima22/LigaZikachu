ALTER TABLE "miauvadao_config"
  ADD COLUMN "purchaseRechargeMinutes" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "offerStockOverrides" JSONB NOT NULL DEFAULT '{}';
