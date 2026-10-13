-- Raid de Johto v2: times de 6 mascotes por líder, prazo por líder, estatísticas por líder e recompensas com escolha de mascote. Idempotente.
ALTER TABLE "johto_raid_events" ADD COLUMN IF NOT EXISTS "damageScale" DOUBLE PRECISION NOT NULL DEFAULT 10;
ALTER TABLE "johto_raid_events" ADD COLUMN IF NOT EXISTS "leaderDays" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "johto_raid_leaders" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "johto_raid_leaders" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "johto_raid_leaders" ADD COLUMN IF NOT EXISTS "escapedAt" TIMESTAMP(3);
ALTER TABLE "johto_raid_leaders" ADD COLUMN IF NOT EXISTS "rewardsGrantedAt" TIMESTAMP(3);
ALTER TABLE "johto_raid_attempts" ADD COLUMN IF NOT EXISTS "summaryJson" JSONB;
CREATE TABLE IF NOT EXISTS "johto_raid_leader_mascots" (
  "id" TEXT PRIMARY KEY,
  "leaderId" TEXT NOT NULL REFERENCES "johto_raid_leaders"("id") ON DELETE CASCADE,
  "slot" INTEGER NOT NULL,
  "pokemonId" INTEGER NOT NULL,
  "hpMax" INTEGER NOT NULL,
  "hpCurrent" INTEGER NOT NULL,
  "defeatedAt" TIMESTAMP(3),
  "defeatedByPlayerId" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "johto_raid_leader_mascots_leaderId_slot_key" ON "johto_raid_leader_mascots"("leaderId","slot");
CREATE TABLE IF NOT EXISTS "johto_raid_leader_stats" (
  "id" TEXT PRIMARY KEY,
  "leaderId" TEXT NOT NULL REFERENCES "johto_raid_leaders"("id") ON DELETE CASCADE,
  "playerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "damage" INTEGER NOT NULL DEFAULT 0,
  "attackCount" INTEGER NOT NULL DEFAULT 0,
  "highestSingleDamage" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "johto_raid_leader_stats_leaderId_playerId_key" ON "johto_raid_leader_stats"("leaderId","playerId");
CREATE INDEX IF NOT EXISTS "johto_raid_leader_stats_leaderId_damage_idx" ON "johto_raid_leader_stats"("leaderId","damage");
CREATE TABLE IF NOT EXISTS "johto_raid_rewards" (
  "id" TEXT PRIMARY KEY,
  "eventId" TEXT NOT NULL REFERENCES "johto_raid_events"("id") ON DELETE CASCADE,
  "leaderKey" TEXT NOT NULL,
  "playerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "tier" TEXT NOT NULL,
  "zc" INTEGER NOT NULL DEFAULT 0,
  "mascotLevel" INTEGER NOT NULL DEFAULT 55,
  "egg" BOOLEAN NOT NULL DEFAULT false,
  "claimedAt" TIMESTAMP(3),
  "chosenPokemonId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "johto_raid_rewards_event_leader_player_tier_key" ON "johto_raid_rewards"("eventId","leaderKey","playerId","tier");
CREATE INDEX IF NOT EXISTS "johto_raid_rewards_playerId_idx" ON "johto_raid_rewards"("playerId");
ALTER TABLE "johto_raid_leader_mascots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "johto_raid_leader_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "johto_raid_rewards" ENABLE ROW LEVEL SECURITY;
