DO $$ BEGIN
  CREATE TYPE "TournamentPostseasonStage" AS ENUM ('TITLE_SURVIVAL', 'CUP_JOHTO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TournamentPostseasonStatus" AS ENUM ('ACTIVE', 'ELIMINATED', 'CHAMPION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tournaments"
  ADD COLUMN IF NOT EXISTS "postseasonEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "postseasonConfig" JSONB;

ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "postseasonStage" "TournamentPostseasonStage",
  ADD COLUMN IF NOT EXISTS "postseasonRound" INTEGER,
  ADD COLUMN IF NOT EXISTS "postseasonSlot" TEXT,
  ADD COLUMN IF NOT EXISTS "postseasonProcessedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "matches_postseasonStage_postseasonRound_idx"
  ON "matches"("postseasonStage", "postseasonRound");

CREATE TABLE IF NOT EXISTS "tournament_postseason_entries" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "stage" "TournamentPostseasonStage" NOT NULL,
  "seed" INTEGER NOT NULL,
  "initialLives" INTEGER NOT NULL DEFAULT 1,
  "lives" INTEGER NOT NULL DEFAULT 1,
  "status" "TournamentPostseasonStatus" NOT NULL DEFAULT 'ACTIVE',
  "eliminatedRound" INTEGER,
  "finalPlacement" INTEGER,
  "resultLabel" TEXT,
  "byeCount" INTEGER NOT NULL DEFAULT 0,
  "lastByeRound" INTEGER,
  "rewardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tournament_postseason_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_postseason_entries_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_postseason_entries_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tournament_postseason_entries_tournamentId_playerId_key"
  ON "tournament_postseason_entries"("tournamentId", "playerId");
CREATE INDEX IF NOT EXISTS "tournament_postseason_entries_tournamentId_stage_status_idx"
  ON "tournament_postseason_entries"("tournamentId", "stage", "status");
