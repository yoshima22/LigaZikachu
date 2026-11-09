-- Rei do Rio: tabelas do modo (idempotente). Aplicar com `prisma db execute --file`.
CREATE TABLE IF NOT EXISTS "rdr_editions" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "theme" TEXT NOT NULL DEFAULT 'natal',
  "isTest" BOOLEAN NOT NULL DEFAULT true,
  "autoRun" BOOLEAN NOT NULL DEFAULT false,
  "mondayDate" TEXT NOT NULL,
  "phase" TEXT NOT NULL DEFAULT 'PREPARATION',
  "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
  "restDay" INTEGER,
  "lockedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "championKey" TEXT,
  "configJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "rdr_editions_phase_idx" ON "rdr_editions"("phase");

CREATE TABLE IF NOT EXISTS "rdr_participants" (
  "id" TEXT PRIMARY KEY,
  "editionId" TEXT NOT NULL REFERENCES "rdr_editions"("id") ON DELETE CASCADE,
  "playerKey" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "isBot" BOOLEAN NOT NULL DEFAULT false,
  "originalJson" JSONB NOT NULL,
  "rosterJson" JSONB,
  "dayPlansJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "scoresJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "totalScore" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "byes" INTEGER NOT NULL DEFAULT 0,
  "damageDealt" INTEGER NOT NULL DEFAULT 0,
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "rdr_participants_editionId_playerKey_key" ON "rdr_participants"("editionId","playerKey");
CREATE INDEX IF NOT EXISTS "rdr_participants_editionId_idx" ON "rdr_participants"("editionId");

CREATE TABLE IF NOT EXISTS "rdr_day_states" (
  "id" TEXT PRIMARY KEY,
  "participantId" TEXT NOT NULL REFERENCES "rdr_participants"("id") ON DELETE CASCADE,
  "dayIndex" INTEGER NOT NULL,
  "formationJson" JSONB NOT NULL,
  "stateJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "rdr_day_states_participantId_dayIndex_key" ON "rdr_day_states"("participantId","dayIndex");

CREATE TABLE IF NOT EXISTS "rdr_rounds" (
  "id" TEXT PRIMARY KEY,
  "editionId" TEXT NOT NULL REFERENCES "rdr_editions"("id") ON DELETE CASCADE,
  "roundIndex" INTEGER NOT NULL,
  "dayIndex" INTEGER NOT NULL,
  "slotInDay" INTEGER NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "claimToken" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "snapshotJson" JSONB,
  "standingsJson" JSONB,
  "error" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "rdr_rounds_editionId_roundIndex_key" ON "rdr_rounds"("editionId","roundIndex");
CREATE INDEX IF NOT EXISTS "rdr_rounds_editionId_status_idx" ON "rdr_rounds"("editionId","status");

CREATE TABLE IF NOT EXISTS "rdr_matches" (
  "id" TEXT PRIMARY KEY,
  "editionId" TEXT NOT NULL REFERENCES "rdr_editions"("id") ON DELETE CASCADE,
  "roundId" TEXT NOT NULL REFERENCES "rdr_rounds"("id") ON DELETE CASCADE,
  "roundIndex" INTEGER NOT NULL,
  "dayIndex" INTEGER NOT NULL,
  "participantAId" TEXT NOT NULL,
  "participantBId" TEXT,
  "winnerId" TEXT,
  "isDraw" BOOLEAN NOT NULL DEFAULT false,
  "seed" TEXT NOT NULL,
  "summaryJson" JSONB NOT NULL,
  "statsJson" JSONB NOT NULL,
  "replayJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "rdr_matches_roundId_participantAId_key" ON "rdr_matches"("roundId","participantAId");
CREATE INDEX IF NOT EXISTS "rdr_matches_editionId_roundIndex_idx" ON "rdr_matches"("editionId","roundIndex");

ALTER TABLE "rdr_editions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rdr_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rdr_day_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rdr_rounds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rdr_matches" ENABLE ROW LEVEL SECURITY;
