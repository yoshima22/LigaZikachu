ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'BOND_PROMISE_SHIELD';

ALTER TABLE "mascot_relations"
  ADD COLUMN IF NOT EXISTS "distanceStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "distanceStartedByPlayerId" TEXT,
  ADD COLUMN IF NOT EXISTS "distanceRemainingMs" INTEGER,
  ADD COLUMN IF NOT EXISTS "promiseCharmStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "promiseCharmResolvesAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "promiseCharmByPlayerId" TEXT,
  ADD COLUMN IF NOT EXISTS "promiseShielded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "distanceContestants" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "mascot_routines" ADD COLUMN IF NOT EXISTS "nextEventAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "pendingRewardType" TEXT, ADD COLUMN IF NOT EXISTS "pendingRewardAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "mascot_social_influences" (
  "id" TEXT NOT NULL,
  "observerPlayerId" TEXT NOT NULL,
  "targetMascotId" TEXT NOT NULL,
  "direction" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mascot_social_influences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mascot_social_influences_observerPlayerId_targetMascotId_key" ON "mascot_social_influences"("observerPlayerId", "targetMascotId");
CREATE INDEX IF NOT EXISTS "mascot_social_influences_targetMascotId_direction_idx" ON "mascot_social_influences"("targetMascotId", "direction");
