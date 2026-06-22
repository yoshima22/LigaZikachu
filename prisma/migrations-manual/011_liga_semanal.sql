-- Migration 011: liga_semanal
-- Liga Semanal dos Mascotes
--
-- Aplicar no Supabase Dashboard > SQL Editor
-- Ordem: rodar inteiro de uma vez

-- 1. Novos valores no enum MascotCombatRole
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'GUARDIAN';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'DUELIST';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'SABOTEUR';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'HEALER';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'SCOUT';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'PROVOKER';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'SPECIALIST';
ALTER TYPE "MascotCombatRole" ADD VALUE IF NOT EXISTS 'SURVIVOR';

-- 2. Novos valores no enum ShopItemType
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_CAPTAIN_BAND';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_FORMATION_WHISTLE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_BENCH_SHIELD';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_CHEER_FLAG';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_ENGUICA_STRATEGY';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_ANALYSIS_LANTERN';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_ROUND_BOOTS';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_LOCKER_TONIC';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_CONFUSION_SPRAY';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_WRONG_SIGN';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_ANNOYING_WHISTLE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_FIELD_SAND';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_EVIL_EYE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_CROWD_NOISE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_EMBARRASSING_TAPE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'LEAGUE_PROVOCATION_TICKET';

-- 3. Novos enums
CREATE TYPE "WeeklyLeagueStatus" AS ENUM ('REGISTRATION', 'ACTIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE "WeeklyMatchStatus" AS ENUM ('SCHEDULED', 'RESOLVED', 'BYE', 'WO', 'CANCELLED');

-- 4. weekly_mascot_leagues
CREATE TABLE IF NOT EXISTS "weekly_mascot_leagues" (
  "id"               TEXT NOT NULL,
  "weekKey"          TEXT NOT NULL,
  "weekStart"        TIMESTAMP(3) NOT NULL,
  "weekEnd"          TIMESTAMP(3) NOT NULL,
  "status"           "WeeklyLeagueStatus" NOT NULL DEFAULT 'REGISTRATION',
  "modifierJson"     JSONB,
  "championPlayerId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weekly_mascot_leagues_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_mascot_leagues_weekKey_key" ON "weekly_mascot_leagues"("weekKey");

-- 5. weekly_mascot_league_participants
CREATE TABLE IF NOT EXISTS "weekly_mascot_league_participants" (
  "id"             TEXT NOT NULL,
  "leagueId"       TEXT NOT NULL,
  "playerId"       TEXT NOT NULL,
  "points"         INTEGER NOT NULL DEFAULT 0,
  "wins"           INTEGER NOT NULL DEFAULT 0,
  "losses"         INTEGER NOT NULL DEFAULT 0,
  "draws"          INTEGER NOT NULL DEFAULT 0,
  "woLosses"       INTEGER NOT NULL DEFAULT 0,
  "byes"           INTEGER NOT NULL DEFAULT 0,
  "survivorsScore" INTEGER NOT NULL DEFAULT 0,
  "damageDealt"    INTEGER NOT NULL DEFAULT 0,
  "damageTaken"    INTEGER NOT NULL DEFAULT 0,
  "finalRank"      INTEGER,
  "rewardGranted"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weekly_mascot_league_participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_mascot_league_participants_leagueId_playerId_key"
  ON "weekly_mascot_league_participants"("leagueId", "playerId");
CREATE INDEX IF NOT EXISTS "weekly_mascot_league_participants_leagueId_idx"
  ON "weekly_mascot_league_participants"("leagueId");

-- 6. weekly_mascot_league_daily_teams
CREATE TABLE IF NOT EXISTS "weekly_mascot_league_daily_teams" (
  "id"            TEXT NOT NULL,
  "leagueId"      TEXT NOT NULL,
  "playerId"      TEXT NOT NULL,
  "battleDate"    TEXT NOT NULL,
  "battleSlot"    INTEGER NOT NULL,
  "source"        TEXT NOT NULL DEFAULT 'MANUAL',
  "mascotIdsJson" JSONB NOT NULL,
  "rolesJson"     JSONB,
  "lockedAt"      TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weekly_mascot_league_daily_teams_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_mascot_league_daily_teams_leagueId_playerId_battleDate_battleSlot_key"
  ON "weekly_mascot_league_daily_teams"("leagueId", "playerId", "battleDate", "battleSlot");
CREATE INDEX IF NOT EXISTS "weekly_mascot_league_daily_teams_leagueId_battleDate_idx"
  ON "weekly_mascot_league_daily_teams"("leagueId", "battleDate");

-- 7. weekly_mascot_league_matches
CREATE TABLE IF NOT EXISTS "weekly_mascot_league_matches" (
  "id"                  TEXT NOT NULL,
  "leagueId"            TEXT NOT NULL,
  "roundNumber"         INTEGER NOT NULL,
  "battleDate"          TEXT NOT NULL,
  "battleSlot"          INTEGER NOT NULL,
  "scheduledAt"         TIMESTAMP(3) NOT NULL,
  "playerAId"           TEXT NOT NULL,
  "playerBId"           TEXT,
  "winnerId"            TEXT,
  "loserId"             TEXT,
  "isDraw"              BOOLEAN NOT NULL DEFAULT false,
  "playerASurvivors"    INTEGER NOT NULL DEFAULT 0,
  "playerBSurvivors"    INTEGER NOT NULL DEFAULT 0,
  "playerADamageDealt"  INTEGER NOT NULL DEFAULT 0,
  "playerBDamageDealt"  INTEGER NOT NULL DEFAULT 0,
  "playerADamageTaken"  INTEGER NOT NULL DEFAULT 0,
  "playerBDamageTaken"  INTEGER NOT NULL DEFAULT 0,
  "resultJson"          JSONB,
  "replayJson"          JSONB,
  "status"              "WeeklyMatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "resolvedAt"          TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_mascot_league_matches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "weekly_mascot_league_matches_leagueId_battleDate_idx"
  ON "weekly_mascot_league_matches"("leagueId", "battleDate");
CREATE INDEX IF NOT EXISTS "weekly_mascot_league_matches_playerAId_idx"
  ON "weekly_mascot_league_matches"("playerAId");
CREATE INDEX IF NOT EXISTS "weekly_mascot_league_matches_playerBId_idx"
  ON "weekly_mascot_league_matches"("playerBId");

-- 8. weekly_mascot_league_battle_items
CREATE TABLE IF NOT EXISTS "weekly_mascot_league_battle_items" (
  "id"             TEXT NOT NULL,
  "leagueId"       TEXT NOT NULL,
  "matchId"        TEXT,
  "playerId"       TEXT NOT NULL,
  "itemId"         TEXT NOT NULL,
  "effectType"     TEXT NOT NULL,
  "targetType"     TEXT NOT NULL,
  "targetPlayerId" TEXT,
  "battleDate"     TEXT NOT NULL,
  "battleSlot"     INTEGER NOT NULL,
  "consumedAt"     TIMESTAMP(3),
  "refundedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "weekly_mascot_league_battle_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "weekly_mascot_league_battle_items_leagueId_battleDate_idx"
  ON "weekly_mascot_league_battle_items"("leagueId", "battleDate");
CREATE INDEX IF NOT EXISTS "weekly_mascot_league_battle_items_playerId_idx"
  ON "weekly_mascot_league_battle_items"("playerId");

-- 9. weekly_mascot_league_mascot_stats
CREATE TABLE IF NOT EXISTS "weekly_mascot_league_mascot_stats" (
  "id"               TEXT NOT NULL,
  "leagueId"         TEXT NOT NULL,
  "mascotId"         TEXT NOT NULL,
  "ownerId"          TEXT NOT NULL,
  "combatRole"       TEXT NOT NULL,
  "matchesPlayed"    INTEGER NOT NULL DEFAULT 0,
  "wins"             INTEGER NOT NULL DEFAULT 0,
  "losses"           INTEGER NOT NULL DEFAULT 0,
  "damageDealt"      INTEGER NOT NULL DEFAULT 0,
  "damageTaken"      INTEGER NOT NULL DEFAULT 0,
  "kosDealt"         INTEGER NOT NULL DEFAULT 0,
  "kosReceived"      INTEGER NOT NULL DEFAULT 0,
  "buffsApplied"     INTEGER NOT NULL DEFAULT 0,
  "debuffsApplied"   INTEGER NOT NULL DEFAULT 0,
  "interceptions"    INTEGER NOT NULL DEFAULT 0,
  "successfulFlanks" INTEGER NOT NULL DEFAULT 0,
  "healingDone"      INTEGER NOT NULL DEFAULT 0,
  "turnsSurvived"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weekly_mascot_league_mascot_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_mascot_league_mascot_stats_leagueId_mascotId_key"
  ON "weekly_mascot_league_mascot_stats"("leagueId", "mascotId");
CREATE INDEX IF NOT EXISTS "weekly_mascot_league_mascot_stats_leagueId_idx"
  ON "weekly_mascot_league_mascot_stats"("leagueId");

-- 10. Foreign keys
ALTER TABLE "weekly_mascot_league_participants"
  ADD CONSTRAINT "weekly_mascot_league_participants_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "weekly_mascot_leagues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_mascot_league_daily_teams"
  ADD CONSTRAINT "weekly_mascot_league_daily_teams_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "weekly_mascot_leagues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_mascot_league_matches"
  ADD CONSTRAINT "weekly_mascot_league_matches_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "weekly_mascot_leagues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_mascot_league_battle_items"
  ADD CONSTRAINT "weekly_mascot_league_battle_items_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "weekly_mascot_leagues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "weekly_mascot_league_battle_items"
  ADD CONSTRAINT "weekly_mascot_league_battle_items_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "weekly_mascot_league_matches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "weekly_mascot_league_mascot_stats"
  ADD CONSTRAINT "weekly_mascot_league_mascot_stats_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "weekly_mascot_leagues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
