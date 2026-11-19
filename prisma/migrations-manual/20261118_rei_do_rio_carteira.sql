-- Rei do Rio: carteira de pontos acumulados entre edições + resgate de caixas (idempotente).
CREATE TABLE IF NOT EXISTS "rdr_wallets" (
  "playerId" TEXT PRIMARY KEY,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "earned" INTEGER NOT NULL DEFAULT 0,
  "spent" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "rdr_credits" (
  "id" TEXT PRIMARY KEY,
  "editionId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "rdr_credits_editionId_playerId_key" ON "rdr_credits"("editionId","playerId");
CREATE INDEX IF NOT EXISTS "rdr_credits_playerId_idx" ON "rdr_credits"("playerId");
CREATE TABLE IF NOT EXISTS "rdr_box_claims" (
  "id" TEXT PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "boxKey" TEXT NOT NULL,
  "optionKey" TEXT NOT NULL,
  "cost" INTEGER NOT NULL,
  "giftId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "rdr_box_claims_playerId_boxKey_key" ON "rdr_box_claims"("playerId","boxKey");
ALTER TABLE "rdr_wallets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rdr_credits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rdr_box_claims" ENABLE ROW LEVEL SECURITY;
