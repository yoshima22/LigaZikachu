CREATE TABLE "arena_draft_presences" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "arena_draft_presences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "arena_draft_presences_matchId_playerId_key" ON "arena_draft_presences"("matchId", "playerId");
CREATE INDEX "arena_draft_presences_matchId_lastSeenAt_idx" ON "arena_draft_presences"("matchId", "lastSeenAt");
ALTER TABLE "arena_draft_presences" ADD CONSTRAINT "arena_draft_presences_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "arena_draft_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
