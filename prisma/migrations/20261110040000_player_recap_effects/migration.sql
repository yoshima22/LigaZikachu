ALTER TABLE "player_recap_counters" ADD COLUMN IF NOT EXISTS "buffsApplied" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_recap_counters" ADD COLUMN IF NOT EXISTS "debuffsApplied" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "player_recap_counters" ADD COLUMN IF NOT EXISTS "effectsBackfilledAt" TIMESTAMP(3);
