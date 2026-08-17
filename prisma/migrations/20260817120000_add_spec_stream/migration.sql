-- CreateEnum
CREATE TYPE "SpecStreamStatus" AS ENUM ('PREPARING', 'LIVE', 'ENDED', 'FAILED');

-- CreateTable
CREATE TABLE "spec_streams" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "broadcasterUserId" TEXT NOT NULL,
  "status" "SpecStreamStatus" NOT NULL DEFAULT 'PREPARING',
  "provider" TEXT NOT NULL DEFAULT 'stub',
  "videoTrackId" TEXT,
  "audioTrackId" TEXT,
  "broadcastSessionId" TEXT,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "spec_streams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spec_streams_status_idx" ON "spec_streams"("status");

-- CreateIndex
CREATE INDEX "spec_streams_tournamentId_status_idx" ON "spec_streams"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "spec_streams_matchId_idx" ON "spec_streams"("matchId");
