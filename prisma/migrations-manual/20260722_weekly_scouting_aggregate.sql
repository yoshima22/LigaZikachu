CREATE TABLE IF NOT EXISTS "weekly_mascot_scouting_aggregates" (
  "playerId" TEXT PRIMARY KEY REFERENCES "players"("id") ON DELETE CASCADE,
  "matches" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "damageDealt" BIGINT NOT NULL DEFAULT 0,
  "mascotUsage" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "typeUsage" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "roleUsage" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "recentMatches" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "lastProcessedAt" TIMESTAMP(3),
  "lastProcessedMatchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
