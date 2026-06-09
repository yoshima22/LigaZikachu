-- Migration: VIP Supporter Pass
-- Apply this in Supabase Dashboard → SQL Editor

-- 1. Add new enum values
ALTER TYPE "TitleEntranceEffect" ADD VALUE IF NOT EXISTS 'PILAR_DA_COMUNIDADE';
ALTER TYPE "ZikaCoinTxType" ADD VALUE IF NOT EXISTS 'VIP_PASS_REWARD';

-- 2. Add source column to player_inventory
ALTER TABLE "player_inventory" ADD COLUMN IF NOT EXISTS "source" TEXT;

-- 3. Create supporter_passes table
CREATE TABLE IF NOT EXISTS "supporter_passes" (
  "id"               TEXT NOT NULL,
  "playerId"         TEXT NOT NULL,
  "active"           BOOLEAN NOT NULL DEFAULT true,
  "startsAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"        TIMESTAMP(3) NOT NULL,
  "titleItemId"      TEXT,
  "createdByAdminId" TEXT,
  "revokedByAdminId" TEXT,
  "revokedAt"        TIMESTAMP(3),
  "revokeReason"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supporter_passes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "supporter_passes_playerId_idx"
  ON "supporter_passes"("playerId");

CREATE INDEX IF NOT EXISTS "supporter_passes_active_expiresAt_idx"
  ON "supporter_passes"("active", "expiresAt");

ALTER TABLE "supporter_passes"
  ADD CONSTRAINT "supporter_passes_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 4. Create supporter_pass_claims table
CREATE TABLE IF NOT EXISTS "supporter_pass_claims" (
  "id"            TEXT NOT NULL,
  "passId"        TEXT NOT NULL,
  "playerId"      TEXT NOT NULL,
  "dayNumber"     INTEGER NOT NULL,
  "rewardType"    TEXT NOT NULL,
  "rewardPayload" JSONB NOT NULL,
  "claimedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supporter_pass_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supporter_pass_claims_passId_dayNumber_key" UNIQUE ("passId", "dayNumber")
);

CREATE INDEX IF NOT EXISTS "supporter_pass_claims_playerId_idx"
  ON "supporter_pass_claims"("playerId");

ALTER TABLE "supporter_pass_claims"
  ADD CONSTRAINT "supporter_pass_claims_passId_fkey"
  FOREIGN KEY ("passId") REFERENCES "supporter_passes"("id") ON DELETE CASCADE
  ON UPDATE CASCADE;
