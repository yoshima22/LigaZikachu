ALTER TABLE "world_player_states"
  ADD COLUMN IF NOT EXISTS "partyJson" JSONB NOT NULL DEFAULT '[]';
