-- Raid dos Líderes de Johto (evento Semana 8). Idempotente.
CREATE TABLE IF NOT EXISTS "johto_raid_events" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "defeatedAt" TIMESTAMP(3),
  "rewardsGrantedAt" TIMESTAMP(3),
  "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
  "rewardConfigJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "johto_raid_leaders" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "johto_raid_events"("id") ON DELETE CASCADE,
  "position" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "hpMax" INTEGER NOT NULL,
  "hpCurrent" INTEGER NOT NULL,
  "defeatedAt" TIMESTAMP(3),
  "finalBlowPlayerId" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "johto_raid_leaders_eventId_position_key" ON "johto_raid_leaders"("eventId","position");
CREATE TABLE IF NOT EXISTS "johto_raid_attempts" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "johto_raid_events"("id") ON DELETE CASCADE,
  "leaderKey" TEXT NOT NULL,
  "playerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "damage" INTEGER NOT NULL DEFAULT 0,
  "koCount" INTEGER NOT NULL DEFAULT 0,
  "finalBlow" BOOLEAN NOT NULL DEFAULT false,
  "teamSnapshotJson" JSONB NOT NULL,
  "replayJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "johto_raid_attempts_eventId_playerId_createdAt_idx" ON "johto_raid_attempts"("eventId","playerId","createdAt");
CREATE TABLE IF NOT EXISTS "johto_raid_rankings" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "johto_raid_events"("id") ON DELETE CASCADE,
  "playerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "totalDamage" INTEGER NOT NULL DEFAULT 0,
  "attackCount" INTEGER NOT NULL DEFAULT 0,
  "highestSingleDamage" INTEGER NOT NULL DEFAULT 0,
  "finalBlows" INTEGER NOT NULL DEFAULT 0,
  "leadersJson" JSONB NOT NULL DEFAULT '[]',
  "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
  "lastAttackAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "johto_raid_rankings_eventId_playerId_key" ON "johto_raid_rankings"("eventId","playerId");
CREATE INDEX IF NOT EXISTS "johto_raid_rankings_eventId_totalDamage_idx" ON "johto_raid_rankings"("eventId","totalDamage");
-- RLS como nas demais tabelas de servidor (acesso só pelo backend).
ALTER TABLE "johto_raid_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "johto_raid_leaders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "johto_raid_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "johto_raid_rankings" ENABLE ROW LEVEL SECURITY;
