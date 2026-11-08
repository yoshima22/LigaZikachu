CREATE TABLE IF NOT EXISTS "bazar_buy_orders" (
  "id" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "pokemonId" INTEGER,
  "minLevel" INTEGER NOT NULL DEFAULT 1,
  "shopItemId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "imageUrl" TEXT,
  "priceCoins" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "filledById" TEXT,
  "filledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bazar_buy_orders_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "bazar_buy_orders_status_expiresAt_createdAt_idx" ON "bazar_buy_orders"("status","expiresAt","createdAt");
CREATE INDEX IF NOT EXISTS "bazar_buy_orders_buyerId_status_idx" ON "bazar_buy_orders"("buyerId","status");
DO $$ BEGIN
  ALTER TABLE "bazar_buy_orders" ADD CONSTRAINT "bazar_buy_orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
