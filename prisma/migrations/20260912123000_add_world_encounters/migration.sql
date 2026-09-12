CREATE TYPE "WorldEncounterStatus" AS ENUM ('ACTIVE', 'CAPTURED', 'ESCAPED', 'FAILED');

CREATE TABLE "world_encounter_sessions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "pokemonId" INTEGER NOT NULL,
    "rarity" TEXT NOT NULL,
    "captureChance" INTEGER NOT NULL,
    "status" "WorldEncounterStatus" NOT NULL DEFAULT 'ACTIVE',
    "roll" INTEGER,
    "mascotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "world_encounter_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "world_encounter_sessions_playerId_status_createdAt_idx" ON "world_encounter_sessions"("playerId", "status", "createdAt");
CREATE INDEX "world_encounter_sessions_locationId_createdAt_idx" ON "world_encounter_sessions"("locationId", "createdAt");
ALTER TABLE "world_encounter_sessions" ADD CONSTRAINT "world_encounter_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
