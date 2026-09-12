ALTER TABLE "world_player_states"
  ADD COLUMN IF NOT EXISTS "mascotStateJson" JSONB NOT NULL DEFAULT '{}';
