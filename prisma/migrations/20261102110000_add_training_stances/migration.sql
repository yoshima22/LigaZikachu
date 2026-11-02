-- Jornadas de Marco de Postura. Os enums usam ADD VALUE IF NOT EXISTS para
-- permitir aplicar em bases que já receberam os itens por seed/admin.
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_EXECUTOR';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_COMMANDER';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_PURIFIER';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_BLOODTHIRSTY';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_ARTILLERY';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_RETRIBUTOR';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_CORROSIVE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_STRATEGIST';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_UNSHAKABLE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_FORTRESS';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_ACCUMULATOR';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_EXPLOSIVE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRAINING_MILESTONE_TRAPPER';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'EXECUTOR';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'COMMANDER';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'PURIFIER';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'BLOODTHIRSTY';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'ARTILLERY';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'RETRIBUTOR';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'CORROSIVE';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'STRATEGIST';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'UNSHAKABLE';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'FORTRESS';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'ACCUMULATOR';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'EXPLOSIVE';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'TRAPPER';

DO $$ BEGIN
  CREATE TYPE "MascotTrainingJourneyStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELED', 'CANCELED_REPLACED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "mascot_training_journeys" (
  "id" TEXT NOT NULL,
  "mascotId" TEXT NOT NULL,
  "stanceKey" TEXT NOT NULL,
  "status" "MascotTrainingJourneyStatus" NOT NULL DEFAULT 'ACTIVE',
  "catalogVersion" INTEGER NOT NULL DEFAULT 1,
  "seed" INTEGER NOT NULL,
  "sourceItemId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "mascot_training_journeys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mascot_training_journeys_mascotId_fkey" FOREIGN KEY ("mascotId") REFERENCES "mascots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mascot_training_journeys_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "shop_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "mascot_training_journeys_mascotId_status_idx" ON "mascot_training_journeys"("mascotId", "status");
CREATE INDEX IF NOT EXISTS "mascot_training_journeys_stanceKey_status_idx" ON "mascot_training_journeys"("stanceKey", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "mascot_training_journeys_one_active_per_mascot" ON "mascot_training_journeys"("mascotId") WHERE "status" = 'ACTIVE';

CREATE TABLE IF NOT EXISTS "mascot_training_milestones" (
  "id" TEXT NOT NULL,
  "journeyId" TEXT NOT NULL,
  "milestoneKey" TEXT NOT NULL,
  "target" INTEGER NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "detailsJson" JSONB,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "mascot_training_milestones_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mascot_training_milestones_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "mascot_training_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "mascot_training_milestones_journeyId_milestoneKey_key" ON "mascot_training_milestones"("journeyId", "milestoneKey");

CREATE TABLE IF NOT EXISTS "mascot_stance_unlocks" (
  "id" TEXT NOT NULL,
  "mascotId" TEXT NOT NULL,
  "stanceKey" TEXT NOT NULL,
  "journeyId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mascot_stance_unlocks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mascot_stance_unlocks_mascotId_fkey" FOREIGN KEY ("mascotId") REFERENCES "mascots"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "mascot_stance_unlocks_mascotId_stanceKey_key" ON "mascot_stance_unlocks"("mascotId", "stanceKey");
CREATE INDEX IF NOT EXISTS "mascot_stance_unlocks_mascotId_idx" ON "mascot_stance_unlocks"("mascotId");
