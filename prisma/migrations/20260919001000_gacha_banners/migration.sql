-- Invocacoes (banners de gacha): moedas, banners, pools, pity, missoes e pacotes.
DO $$ BEGIN CREATE TYPE "GachaCurrency" AS ENUM ('POKEBALL','ULTRABALL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GachaRewardKind" AS ENUM ('EGG','MASCOT','ITEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GachaObjectiveSource" AS ENUM ('ARENA_Z','LIGA_RUSH','LIGA_SEMANAL','BATALHA_TERRENO','ARENA_DRAFT','FIGURINHAS','BAZAR_VENDA','BAZAR_GASTO_ZC','BAZAR_GASTO_LC','OVOS_ABERTOS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "gacha_wallets" (
  "id" TEXT PRIMARY KEY,
  "playerId" TEXT NOT NULL UNIQUE,
  "pokeballs" INTEGER NOT NULL DEFAULT 0,
  "ultraballs" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "gacha_ledger" (
  "id" TEXT PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "currency" "GachaCurrency" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "gacha_ledger_playerId_createdAt_idx" ON "gacha_ledger"("playerId","createdAt");

CREATE TABLE IF NOT EXISTS "gacha_banners" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "subtitle" TEXT,
  "flavor" TEXT,
  "imageUrl" TEXT,
  "mascotArtUrl" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "durationDays" INTEGER NOT NULL DEFAULT 14,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "costSingle" INTEGER NOT NULL DEFAULT 1,
  "costMulti" INTEGER NOT NULL DEFAULT 10,
  "ultraCostSingle" INTEGER NOT NULL DEFAULT 1,
  "ultraCostMulti" INTEGER NOT NULL DEFAULT 10,
  "guaranteedRarity" TEXT NOT NULL DEFAULT 'RARE',
  "ultraGuaranteedRarity" TEXT NOT NULL DEFAULT 'SPECIAL',
  "rateUpMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 3,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "gacha_banners_active_startsAt_idx" ON "gacha_banners"("active","startsAt");

CREATE TABLE IF NOT EXISTS "gacha_banner_entries" (
  "id" TEXT PRIMARY KEY,
  "bannerId" TEXT NOT NULL REFERENCES "gacha_banners"("id") ON DELETE CASCADE,
  "kind" "GachaRewardKind" NOT NULL,
  "label" TEXT NOT NULL,
  "rarity" TEXT NOT NULL DEFAULT 'COMMON',
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "rateUp" BOOLEAN NOT NULL DEFAULT false,
  "imageUrl" TEXT,
  "eggType" "EggType",
  "pokemonId" INTEGER,
  "itemId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS "gacha_banner_entries_bannerId_idx" ON "gacha_banner_entries"("bannerId");

CREATE TABLE IF NOT EXISTS "gacha_pity_rules" (
  "id" TEXT PRIMARY KEY,
  "bannerId" TEXT NOT NULL REFERENCES "gacha_banners"("id") ON DELETE CASCADE,
  "currency" "GachaCurrency" NOT NULL,
  "everyPulls" INTEGER NOT NULL,
  "rarity" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "gacha_pity_rules_bannerId_currency_idx" ON "gacha_pity_rules"("bannerId","currency");

CREATE TABLE IF NOT EXISTS "gacha_pity_states" (
  "id" TEXT PRIMARY KEY,
  "bannerId" TEXT NOT NULL REFERENCES "gacha_banners"("id") ON DELETE CASCADE,
  "playerId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "gacha_pity_states_playerId_ruleId_key" ON "gacha_pity_states"("playerId","ruleId");
CREATE INDEX IF NOT EXISTS "gacha_pity_states_bannerId_playerId_idx" ON "gacha_pity_states"("bannerId","playerId");

CREATE TABLE IF NOT EXISTS "gacha_pulls" (
  "id" TEXT PRIMARY KEY,
  "bannerId" TEXT NOT NULL REFERENCES "gacha_banners"("id") ON DELETE CASCADE,
  "playerId" TEXT NOT NULL,
  "currency" "GachaCurrency" NOT NULL,
  "count" INTEGER NOT NULL,
  "results" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "gacha_pulls_playerId_createdAt_idx" ON "gacha_pulls"("playerId","createdAt");
CREATE INDEX IF NOT EXISTS "gacha_pulls_bannerId_createdAt_idx" ON "gacha_pulls"("bannerId","createdAt");

CREATE TABLE IF NOT EXISTS "gacha_missions" (
  "id" TEXT PRIMARY KEY,
  "bannerId" TEXT REFERENCES "gacha_banners"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "source" "GachaObjectiveSource" NOT NULL,
  "goal" INTEGER NOT NULL,
  "reward" "GachaCurrency" NOT NULL,
  "rewardAmount" INTEGER NOT NULL DEFAULT 1,
  "rarityFilter" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "gacha_missions_active_source_idx" ON "gacha_missions"("active","source");

CREATE TABLE IF NOT EXISTS "gacha_mission_progress" (
  "id" TEXT PRIMARY KEY,
  "missionId" TEXT NOT NULL REFERENCES "gacha_missions"("id") ON DELETE CASCADE,
  "playerId" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "claimedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "gacha_mission_progress_missionId_playerId_weekKey_key" ON "gacha_mission_progress"("missionId","playerId","weekKey");
CREATE INDEX IF NOT EXISTS "gacha_mission_progress_playerId_weekKey_idx" ON "gacha_mission_progress"("playerId","weekKey");

CREATE TABLE IF NOT EXISTS "gacha_packs" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "currency" "GachaCurrency" NOT NULL,
  "amount" INTEGER NOT NULL,
  "bonus" INTEGER NOT NULL DEFAULT 0,
  "priceLc" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
