ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "rewardConfig" JSONB;

ALTER TABLE "deck_submissions"
  ADD COLUMN IF NOT EXISTS "gymBadgeId" TEXT,
  ADD COLUMN IF NOT EXISTS "gymBadgeValid" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "gymBadgeValidation" JSONB;

CREATE INDEX IF NOT EXISTS "deck_submissions_gymBadgeId_gymBadgeValid_idx"
  ON "deck_submissions" ("gymBadgeId", "gymBadgeValid");

DO $$ BEGIN
  ALTER TABLE "deck_submissions"
    ADD CONSTRAINT "deck_submissions_gymBadgeId_fkey"
    FOREIGN KEY ("gymBadgeId") REFERENCES "league_badges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tournament_day_closures" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "tournamentWeekId" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "topPlayerId" TEXT,
  "rafflePlayerId" TEXT,
  "closedById" TEXT NOT NULL,
  "summary" JSONB,
  "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_day_closures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_day_closures_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_day_closures_tournamentWeekId_fkey" FOREIGN KEY ("tournamentWeekId") REFERENCES "tournament_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_day_closures_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tournament_day_closures_tournamentWeekId_dateKey_key"
  ON "tournament_day_closures" ("tournamentWeekId", "dateKey");
CREATE INDEX IF NOT EXISTS "tournament_day_closures_tournamentId_closedAt_idx"
  ON "tournament_day_closures" ("tournamentId", "closedAt");

CREATE TABLE IF NOT EXISTS "tournament_day_rewards" (
  "id" TEXT NOT NULL,
  "closureId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "matchId" TEXT,
  "giftId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tournament_day_rewards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_day_rewards_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "tournament_day_closures"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_day_rewards_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tournament_day_rewards_closureId_dedupeKey_key"
  ON "tournament_day_rewards" ("closureId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "tournament_day_rewards_playerId_createdAt_idx"
  ON "tournament_day_rewards" ("playerId", "createdAt");
