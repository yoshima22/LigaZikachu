CREATE TABLE IF NOT EXISTS "redeem_codes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "maxUses" INTEGER,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "redeem_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "redeem_codes_code_key" ON "redeem_codes"("code");

CREATE TABLE IF NOT EXISTS "redeem_code_rewards" (
  "id" TEXT NOT NULL,
  "codeId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "redeem_code_rewards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "redeem_code_rewards_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "redeem_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "redeem_code_rewards_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "shop_items"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "redeem_code_rewards_codeId_itemId_key" ON "redeem_code_rewards"("codeId", "itemId");

CREATE TABLE IF NOT EXISTS "redeem_code_redemptions" (
  "id" TEXT NOT NULL,
  "codeId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "redeem_code_redemptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "redeem_code_redemptions_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "redeem_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "redeem_code_redemptions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "redeem_code_redemptions_codeId_playerId_key" ON "redeem_code_redemptions"("codeId", "playerId");
CREATE INDEX IF NOT EXISTS "redeem_code_redemptions_playerId_idx" ON "redeem_code_redemptions"("playerId");
