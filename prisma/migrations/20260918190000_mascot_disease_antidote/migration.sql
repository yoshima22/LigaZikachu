ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'ANTIDOTE';

ALTER TABLE "mascots"
  ADD COLUMN IF NOT EXISTS "diseasedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "diseaseLastSpreadAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "mascots_playerId_diseasedAt_idx"
  ON "mascots"("playerId", "diseasedAt");
