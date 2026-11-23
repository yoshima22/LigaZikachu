CREATE TABLE IF NOT EXISTS ability_feedback (
  id TEXT PRIMARY KEY,
  "playerId" TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  "abilitySlug" TEXT NOT NULL,
  verdict TEXT NOT NULL,
  comment TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ability_feedback_player_slug_key ON ability_feedback("playerId", "abilitySlug");
CREATE INDEX IF NOT EXISTS ability_feedback_slug_idx ON ability_feedback("abilitySlug");
