CREATE TYPE "LigaCashOrderStatus" AS ENUM ('PENDING','PAID','EXPIRED','CANCELLED','REFUNDED');
CREATE TYPE "LigaCashProductType" AS ENUM ('LIGA_COINS','SUPPORTER_PASS');
CREATE TABLE "liga_coin_wallets" ("id" TEXT NOT NULL,"playerId" TEXT NOT NULL,"balance" INTEGER NOT NULL DEFAULT 0,"purchased" INTEGER NOT NULL DEFAULT 0,"spent" INTEGER NOT NULL DEFAULT 0,"updatedAt" TIMESTAMP(3) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "liga_coin_wallets_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "liga_coin_wallets_playerId_key" ON "liga_coin_wallets"("playerId");
CREATE TABLE "liga_cash_orders" ("id" TEXT NOT NULL,"playerId" TEXT NOT NULL,"productType" "LigaCashProductType" NOT NULL,"productCode" TEXT NOT NULL,"productLabel" TEXT NOT NULL,"ligaCoins" INTEGER NOT NULL DEFAULT 0,"bonusLigaCoins" INTEGER NOT NULL DEFAULT 0,"amountCents" INTEGER NOT NULL,"status" "LigaCashOrderStatus" NOT NULL DEFAULT 'PENDING',"provider" TEXT NOT NULL DEFAULT 'MERCADO_PAGO',"providerPaymentId" TEXT,"qrCode" TEXT,"qrCodeBase64" TEXT,"expiresAt" TIMESTAMP(3),"paidAt" TIMESTAMP(3),"fulfilledAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "liga_cash_orders_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "liga_cash_orders_providerPaymentId_key" ON "liga_cash_orders"("providerPaymentId");
CREATE INDEX "liga_cash_orders_playerId_createdAt_idx" ON "liga_cash_orders"("playerId","createdAt");
CREATE INDEX "liga_cash_orders_status_productType_idx" ON "liga_cash_orders"("status","productType");
