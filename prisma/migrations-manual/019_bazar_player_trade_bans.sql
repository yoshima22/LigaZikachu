CREATE TABLE IF NOT EXISTS "bazar_player_trade_bans" (
  "id" TEXT PRIMARY KEY,
  "playerAId" TEXT NOT NULL,
  "playerBId" TEXT NOT NULL,
  "reason" TEXT,
  "createdByUserId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bazar_player_trade_bans_playerAId_playerBId_key" UNIQUE ("playerAId", "playerBId")
);

CREATE INDEX IF NOT EXISTS "bazar_player_trade_bans_playerAId_active_idx"
  ON "bazar_player_trade_bans" ("playerAId", "active");
CREATE INDEX IF NOT EXISTS "bazar_player_trade_bans_playerBId_active_idx"
  ON "bazar_player_trade_bans" ("playerBId", "active");
