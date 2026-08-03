CREATE INDEX IF NOT EXISTS "matches_tournamentWeekId_scheduledAt_idx"
ON "matches" ("tournamentWeekId", "scheduledAt");
