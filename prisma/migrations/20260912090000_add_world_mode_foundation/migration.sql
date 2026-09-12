CREATE TABLE "world_player_states" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "currentLocationId" TEXT NOT NULL DEFAULT 'pallet-town',
  "discoveredLocationIds" TEXT[] NOT NULL DEFAULT ARRAY['pallet-town']::TEXT[],
  "badges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fatigue" INTEGER NOT NULL DEFAULT 0,
  "inventoryJson" JSONB NOT NULL DEFAULT '{"pokeBalls":5,"potions":1,"antidotes":0}',
  "avatarJson" JSONB,
  "travelingToId" TEXT,
  "travelStartedAt" TIMESTAMP(3),
  "travelEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "world_player_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "world_travel_logs" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "fromLocationId" TEXT NOT NULL,
  "toLocationId" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "fatigueGained" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "arrivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "world_travel_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "world_player_states_playerId_key" ON "world_player_states"("playerId");
CREATE INDEX "world_player_states_currentLocationId_idx" ON "world_player_states"("currentLocationId");
CREATE INDEX "world_player_states_travelEndsAt_idx" ON "world_player_states"("travelEndsAt");
CREATE INDEX "world_travel_logs_playerId_createdAt_idx" ON "world_travel_logs"("playerId", "createdAt");

ALTER TABLE "world_player_states" ADD CONSTRAINT "world_player_states_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "world_travel_logs" ADD CONSTRAINT "world_travel_logs_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
