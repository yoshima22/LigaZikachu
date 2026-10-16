DO $$ BEGIN
  CREATE TYPE "MascotOccurrenceTag" AS ENUM ('MISSING', 'DISOBEDIENT', 'BUSY', 'BEWITCHED', 'UNDER_INVESTIGATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MascotOccurrenceStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'RETURNED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "mascot_occurrences" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "mascotId" TEXT NOT NULL,
  "tag" "MascotOccurrenceTag" NOT NULL,
  "status" "MascotOccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
  "message" TEXT NOT NULL,
  "returnMessage" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "showDeadline" BOOLEAN NOT NULL DEFAULT true,
  "previousArenaState" TEXT,
  "previousRestingUntil" TIMESTAMP(3),
  "blockUntil" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "returnedById" TEXT,
  "activatedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "noticeReadAt" TIMESTAMP(3),
  "returnNoticeReadAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mascot_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mascot_occurrences_status_startsAt_idx" ON "mascot_occurrences"("status", "startsAt");
CREATE INDEX IF NOT EXISTS "mascot_occurrences_status_endsAt_idx" ON "mascot_occurrences"("status", "endsAt");
CREATE INDEX IF NOT EXISTS "mascot_occurrences_playerId_status_idx" ON "mascot_occurrences"("playerId", "status");
CREATE INDEX IF NOT EXISTS "mascot_occurrences_mascotId_status_idx" ON "mascot_occurrences"("mascotId", "status");
CREATE INDEX IF NOT EXISTS "mascot_occurrences_batchId_idx" ON "mascot_occurrences"("batchId");

DO $$ BEGIN
  ALTER TABLE "mascot_occurrences" ADD CONSTRAINT "mascot_occurrences_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "mascot_occurrences" ADD CONSTRAINT "mascot_occurrences_mascotId_fkey" FOREIGN KEY ("mascotId") REFERENCES "mascots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
