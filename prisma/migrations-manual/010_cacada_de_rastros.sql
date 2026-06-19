-- Migration 010: cacada_de_rastros
-- Novo modo de jogo: Caçada de Rastros (hide-and-seek assíncrono, admin-only)
--
-- Aplicar no Supabase Dashboard > SQL Editor
-- Ordem: rodar inteiro de uma vez

-- 1. Novos valores no enum MascotArenaState
ALTER TYPE "MascotArenaState" ADD VALUE IF NOT EXISTS 'TRACE_HIDING';
ALTER TYPE "MascotArenaState" ADD VALUE IF NOT EXISTS 'TRACE_HUNTING';

-- 2. Novos valores no enum ShopItemType
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_MAP_SHORT';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_MAP_MEDIUM';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_MAP_LONG';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_MAP_WEEKLY';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_HUNT_TICKET';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_SIGNAL_FLARE';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_DECOY';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_SILENCE_POTION';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_ARMOR_VEST';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_MIST_SHIELD';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_INSTINCT_BOOST';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_GOLDEN_TICKET';
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'TRACE_SPECIAL_MAP';

-- 3. goldenPaws no Player
ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "goldenPaws" INTEGER NOT NULL DEFAULT 0;

-- 4. Enums novos para o modo Rastros
DO $$ BEGIN
  CREATE TYPE "TraceRouteType" AS ENUM ('SHORT', 'MEDIUM', 'LONG', 'WEEKLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TraceRoomStatus" AS ENUM ('WAITING', 'HUNTING', 'FOUND', 'ESCAPED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TraceTarget" AS ENUM ('HIDER', 'HUNTER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. trace_rooms
CREATE TABLE IF NOT EXISTS "trace_rooms" (
  "id"               TEXT        NOT NULL,
  "hiderId"          TEXT        NOT NULL,
  "hiderMascotId"    TEXT        NOT NULL,
  "hunterId"         TEXT,
  "hunterMascotId"   TEXT,
  "routeType"        "TraceRouteType" NOT NULL,
  "routePath"        TEXT        NOT NULL,
  "focusPoints"      INTEGER     NOT NULL,
  "maxFocus"         INTEGER     NOT NULL,
  "currentStep"      INTEGER     NOT NULL DEFAULT 0,
  "status"           "TraceRoomStatus" NOT NULL DEFAULT 'WAITING',
  "lastHunterMoveAt" TIMESTAMPTZ,
  "sinalizadorUsed"  BOOLEAN     NOT NULL DEFAULT false,
  "skipNextMove"     BOOLEAN     NOT NULL DEFAULT false,
  "hintDirection"    TEXT,
  "isAdminSim"       BOOLEAN     NOT NULL DEFAULT false,
  "expiresAt"        TIMESTAMPTZ NOT NULL,
  "resolvedAt"       TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "trace_rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trace_rooms_hiderId_fkey"
    FOREIGN KEY ("hiderId") REFERENCES "players"("id") ON DELETE CASCADE,
  CONSTRAINT "trace_rooms_hiderMascotId_fkey"
    FOREIGN KEY ("hiderMascotId") REFERENCES "mascots"("id") ON DELETE CASCADE,
  CONSTRAINT "trace_rooms_hunterId_fkey"
    FOREIGN KEY ("hunterId") REFERENCES "players"("id") ON DELETE CASCADE,
  CONSTRAINT "trace_rooms_hunterMascotId_fkey"
    FOREIGN KEY ("hunterMascotId") REFERENCES "mascots"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "trace_rooms_hiderId_idx"  ON "trace_rooms"("hiderId");
CREATE INDEX IF NOT EXISTS "trace_rooms_hunterId_idx" ON "trace_rooms"("hunterId");
CREATE INDEX IF NOT EXISTS "trace_rooms_status_idx"   ON "trace_rooms"("status");

-- 6. trace_moves
CREATE TABLE IF NOT EXISTS "trace_moves" (
  "id"        TEXT        NOT NULL,
  "roomId"    TEXT        NOT NULL,
  "step"      INTEGER     NOT NULL,
  "direction" TEXT        NOT NULL,
  "correct"   BOOLEAN     NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "trace_moves_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trace_moves_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "trace_rooms"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "trace_moves_roomId_idx" ON "trace_moves"("roomId");

-- 7. trace_room_events
CREATE TABLE IF NOT EXISTS "trace_room_events" (
  "id"            TEXT        NOT NULL,
  "roomId"        TEXT        NOT NULL,
  "eventCode"     TEXT        NOT NULL,
  "target"        "TraceTarget" NOT NULL,
  "step"          INTEGER     NOT NULL,
  "effectApplied" BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "trace_room_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trace_room_events_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "trace_rooms"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "trace_room_events_roomId_idx" ON "trace_room_events"("roomId");

-- 8. trace_event_logs (histórico global)
CREATE TABLE IF NOT EXISTS "trace_event_logs" (
  "id"          TEXT        NOT NULL,
  "roomId"      TEXT,
  "description" TEXT        NOT NULL,
  "playerName"  TEXT        NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "trace_event_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trace_event_logs_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "trace_rooms"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "trace_event_logs_createdAt_idx" ON "trace_event_logs"("createdAt" DESC);

-- 9. golden_paw_transactions
CREATE TABLE IF NOT EXISTS "golden_paw_transactions" (
  "id"        TEXT        NOT NULL,
  "playerId"  TEXT        NOT NULL,
  "amount"    INTEGER     NOT NULL,
  "reason"    TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "golden_paw_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "golden_paw_transactions_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "golden_paw_transactions_playerId_idx" ON "golden_paw_transactions"("playerId");
