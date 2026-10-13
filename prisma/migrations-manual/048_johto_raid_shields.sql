CREATE TABLE IF NOT EXISTS "johto_raid_shields" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "johto_raid_events"("id") ON DELETE CASCADE,
  "playerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "usedAt" TIMESTAMP(3),
  "rechargedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "johto_raid_shields_eventId_playerId_key" ON "johto_raid_shields"("eventId", "playerId");
CREATE INDEX IF NOT EXISTS "johto_raid_shields_eventId_available_idx" ON "johto_raid_shields"("eventId", "available");
ALTER TABLE "johto_raid_shields" ENABLE ROW LEVEL SECURITY;
