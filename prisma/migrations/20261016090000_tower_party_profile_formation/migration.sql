CREATE TYPE "TowerPartyProfile" AS ENUM ('SOLO', 'GROUP');

ALTER TABLE "tower_runs"
  ADD COLUMN "partyProfile" "TowerPartyProfile",
  ADD COLUMN "balanceVersion" INTEGER;

ALTER TABLE "tower_run_mascots"
  ADD COLUMN "formationSlot" INTEGER;
