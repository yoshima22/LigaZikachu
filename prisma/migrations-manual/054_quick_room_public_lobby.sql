-- Lobby público do ZikaChat: metadados seguros, controle de anfitrião e leases de presença.
DO $$ BEGIN
  CREATE TYPE "QuickRoomVisibility" AS ENUM ('UNLISTED', 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "QuickRoomReportReason" AS ENUM ('ABUSE', 'HARASSMENT', 'INAPPROPRIATE_CONTENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "quick_rooms"
  ADD COLUMN IF NOT EXISTS "hostTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "publicId" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" "QuickRoomVisibility" NOT NULL DEFAULT 'UNLISTED',
  ADD COLUMN IF NOT EXISTS "publicLastSeenAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "quick_rooms_visibility_publicLastSeenAt_idx"
  ON "quick_rooms"("visibility", "publicLastSeenAt");

CREATE TABLE IF NOT EXISTS "quick_room_participant_leases" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES "quick_rooms"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "micOn" BOOLEAN NOT NULL DEFAULT false,
  "cameraOn" BOOLEAN NOT NULL DEFAULT false,
  "screenOn" BOOLEAN NOT NULL DEFAULT false,
  "isHost" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "quick_room_participant_leases_roomId_lastSeenAt_idx"
  ON "quick_room_participant_leases"("roomId", "lastSeenAt");

CREATE TABLE IF NOT EXISTS "quick_room_reports" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES "quick_rooms"("id") ON DELETE CASCADE,
  "reason" "QuickRoomReportReason" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "quick_room_reports_roomId_createdAt_idx"
  ON "quick_room_reports"("roomId", "createdAt");
