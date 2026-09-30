CREATE TABLE IF NOT EXISTS "construtor_change_requests" (
  "id" TEXT NOT NULL,
  "tournamentWeekId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "playerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "acceptedIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "construtor_change_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "construtor_change_requests_matchId_status_idx" ON "construtor_change_requests"("matchId", "status");
