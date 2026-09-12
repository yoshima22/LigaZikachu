ALTER TABLE "world_encounter_sessions"
  ADD COLUMN IF NOT EXISTS "wildJson" JSONB;
