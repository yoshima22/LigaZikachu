-- Preferência de esconder resultados (spoiler) da Liga Semanal + rastreio de
-- quais partidas cada jogador já revelou/assistiu.

ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "hideLeagueResults" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "weekly_mascot_league_result_reveals" (
  "id"         TEXT NOT NULL,
  "playerId"   TEXT NOT NULL,
  "matchId"    TEXT NOT NULL,
  "revealedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_mascot_league_result_reveals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "weekly_mascot_league_result_reveals_playerId_matchId_key"
  ON "weekly_mascot_league_result_reveals" ("playerId", "matchId");

CREATE INDEX IF NOT EXISTS "weekly_mascot_league_result_reveals_playerId_idx"
  ON "weekly_mascot_league_result_reveals" ("playerId");
