ALTER TABLE "shop_items" ADD COLUMN "ligaCashPrice" INTEGER;

ALTER TABLE "bazar_listings"
ADD COLUMN "priceLigaCash" INTEGER,
ADD COLUMN "listingFeeCurrency" TEXT NOT NULL DEFAULT 'ZC',
ADD COLUMN "auctionCurrency" TEXT NOT NULL DEFAULT 'ZC';

ALTER TABLE "bazar_proposals"
ADD COLUMN "ligaCashOffer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ligaCashEscrowed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "liga_cash_ledger" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "actorUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "liga_cash_ledger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "liga_cash_ledger_playerId_createdAt_idx" ON "liga_cash_ledger"("playerId", "createdAt");
CREATE INDEX "liga_cash_ledger_reason_createdAt_idx" ON "liga_cash_ledger"("reason", "createdAt");
CREATE INDEX "liga_cash_ledger_referenceType_referenceId_idx" ON "liga_cash_ledger"("referenceType", "referenceId");

CREATE TABLE "economy_settings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "zcPerLcReference" INTEGER NOT NULL DEFAULT 10,
  "shopLcValueMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.1,
  "bazarListingFeeZc" INTEGER NOT NULL DEFAULT 10,
  "bazarListingFeeLc" INTEGER NOT NULL DEFAULT 1,
  "allowLcShop" BOOLEAN NOT NULL DEFAULT true,
  "allowLcBazar" BOOLEAN NOT NULL DEFAULT true,
  "allowMixedProposals" BOOLEAN NOT NULL DEFAULT true,
  "allowLcAuctions" BOOLEAN NOT NULL DEFAULT true,
  "allowLcLoans" BOOLEAN NOT NULL DEFAULT false,
  "allowLcPassRewards" BOOLEAN NOT NULL DEFAULT true,
  "allowLcWalletRewards" BOOLEAN NOT NULL DEFAULT true,
  "allowLcEventRewards" BOOLEAN NOT NULL DEFAULT true,
  "allowAdminLcGrants" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "economy_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "economy_settings" ("id", "updatedAt") VALUES ('singleton', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "shop_items" SET "ligaCashPrice" = CASE
  WHEN "type"='MASCOT_FOOD' THEN 2 WHEN "type"='ZIKALOOT_TICKET' THEN 8
  WHEN "type"='MASCOT_SWEET' THEN 10 WHEN "type"='MASCOT_BUFF_MOOD' THEN 14
  WHEN "type"='MASCOT_BUFF_HAPPY' THEN 28 WHEN "type"='EGG_COMMON' THEN 55
  WHEN "type"='WEAKNESS_POLICY' THEN 55 WHEN "type"='MASCOT_BUFF_EXP' THEN 69
  WHEN "type"='MASCOT_BUFF_LUCK' THEN 110 WHEN "type"='LUCKY_EGG' THEN 150
  WHEN "type"='VACATION_TICKET' THEN 150 WHEN "type"='PICNIC_BASKET' THEN 230
  WHEN "type"='MASCOT_BUFF_STAT' THEN 410 WHEN "type"='EGG_RARE' THEN 310
  WHEN "type"='EGG_SPECIAL' THEN 620 WHEN "type" IN ('XP_SHARE','XP_SHARE_TEAM') THEN 730
  WHEN "type"='EGG_LAB' THEN 1100
  WHEN "type" IN ('LEAGUE_CONFUSION_SPRAY','LEAGUE_FIELD_SAND') THEN 37
  WHEN "type" IN ('LEAGUE_FORMATION_WHISTLE','LEAGUE_ANNOYING_WHISTLE','LEAGUE_CROWD_NOISE') THEN 46
  WHEN "type" IN ('LEAGUE_BENCH_SHIELD','LEAGUE_WRONG_SIGN','LEAGUE_EMBARRASSING_TAPE') THEN 55
  WHEN "type" IN ('LEAGUE_CHEER_FLAG','LEAGUE_EVIL_EYE') THEN 64
  WHEN "type" IN ('LEAGUE_CAPTAIN_BAND','LEAGUE_ROUND_BOOTS','LEAGUE_PROVOCATION_TICKET') THEN 73
  WHEN "type"='LEAGUE_ANALYSIS_LANTERN' THEN 82 WHEN "type"='LEAGUE_LOCKER_TONIC' THEN 91
  WHEN "type"='LEAGUE_ENGUICA_STRATEGY' THEN 110
  WHEN "type"::text LIKE 'MEGA_STONE_%' AND "type"='MEGA_STONE_RAYQUAZITE' THEN 2000
  WHEN "type"::text LIKE 'MEGA_STONE_%' THEN 1370
  WHEN "name"='Pena Arco-Íris Comum' THEN 82 WHEN "name"='Pena Arco-Íris Rara' THEN 185
  WHEN "name"='Pena Arco-Íris de Evento' THEN 240 WHEN "name"='Pena Arco-Íris Especial' THEN 285
  WHEN "name"='Pena Arco-Íris de Laboratório' THEN 385
  WHEN "type"='TITLE' AND "name"='Anti Trapaça' THEN 185
  WHEN "type"='TITLE' THEN CASE "rarity"::text WHEN 'COMMON' THEN 5 WHEN 'UNCOMMON' THEN 11 WHEN 'RARE' THEN 23 WHEN 'EPIC' THEN 46 WHEN 'LEGENDARY' THEN 91 ELSE 185 END
  WHEN "type"='BANNER' AND "name"='Meu Time Na Praia' THEN 46
  WHEN "type"='BANNER' AND "name"='Mistério Genético' THEN 140
  WHEN "type"='BANNER' THEN CASE "rarity"::text WHEN 'COMMON' THEN 8 WHEN 'UNCOMMON' THEN 19 WHEN 'RARE' THEN 37 WHEN 'EPIC' THEN 73 ELSE 140 END
  WHEN "type"='FRAME' THEN CASE WHEN "name"='Chapéu de Palha' THEN 23 ELSE 10 END
  ELSE GREATEST(1,ROUND("price"/11.0)::integer)
END;
