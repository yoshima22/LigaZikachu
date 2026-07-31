ALTER TABLE "tournaments"
  ADD COLUMN IF NOT EXISTS "enguicaContractsEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "tournament_weeks"
  ADD COLUMN IF NOT EXISTS "enguicaContractKey" TEXT,
  ADD COLUMN IF NOT EXISTS "enguicaContractTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "enguicaContractDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "enguicaContractRevealedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "tournament_enguica_completions" (
  "id" TEXT NOT NULL,
  "tournamentWeekId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "contractKey" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rewardedAt" TIMESTAMP(3),
  "giftId" TEXT,
  CONSTRAINT "tournament_enguica_completions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tournament_enguica_completions_tournamentWeekId_fkey"
    FOREIGN KEY ("tournamentWeekId") REFERENCES "tournament_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_enguica_completions_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tournament_enguica_completions_matchId_fkey"
    FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tournament_enguica_completions_tournamentWeekId_playerId_key"
  ON "tournament_enguica_completions"("tournamentWeekId", "playerId");
CREATE INDEX IF NOT EXISTS "tournament_enguica_completions_matchId_idx"
  ON "tournament_enguica_completions"("matchId");
CREATE INDEX IF NOT EXISTS "tournament_enguica_completions_tournamentWeekId_rewardedAt_idx"
  ON "tournament_enguica_completions"("tournamentWeekId", "rewardedAt");
