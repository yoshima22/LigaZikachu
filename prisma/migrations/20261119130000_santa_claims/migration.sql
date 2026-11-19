CREATE TABLE IF NOT EXISTS santa_claims (
  "playerId" TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  "lastClaimAt" TIMESTAMP(3) NOT NULL,
  "nextAvailableAt" TIMESTAMP(3) NOT NULL,
  "totalClaims" INTEGER NOT NULL DEFAULT 1,
  "lastPrize" TEXT
);
