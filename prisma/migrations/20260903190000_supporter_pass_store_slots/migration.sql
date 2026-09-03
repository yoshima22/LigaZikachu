ALTER TABLE "pass_schedule_config"
ADD COLUMN "isCurrentStorePass" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isNextStorePass" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "liga_cash_orders"
ADD COLUMN "passScheduleKey" TEXT,
ADD COLUMN "passOfferSlot" TEXT;

CREATE INDEX "liga_cash_orders_passOfferSlot_status_idx"
ON "liga_cash_orders"("passOfferSlot", "status");
