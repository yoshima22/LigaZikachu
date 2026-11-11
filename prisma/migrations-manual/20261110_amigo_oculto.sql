-- Amigo Oculto (admin-only). Idempotente. Aplicar com `prisma db execute --file`.
CREATE TABLE IF NOT EXISTS "ss_editions" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "isTest" BOOLEAN NOT NULL DEFAULT true,
  "phase" TEXT NOT NULL DEFAULT 'REGISTRATION',
  "startsOn" TEXT NOT NULL,
  "deliverAt" TIMESTAMP(3) NOT NULL,
  "drawnAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "seedHash" TEXT,
  "seed" TEXT,
  "configJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ss_participants" (
  "id" TEXT PRIMARY KEY,
  "editionId" TEXT NOT NULL REFERENCES "ss_editions"("id") ON DELETE CASCADE,
  "playerId" TEXT,
  "displayName" TEXT NOT NULL,
  "recipientId" TEXT,
  "checkinsJson" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "giftKey" TEXT,
  "cardJson" JSONB,
  "builtAt" TIMESTAMP(3),
  "deliveredGiftId" TEXT,
  "openedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ss_participants_editionId_playerId_key" ON "ss_participants"("editionId","playerId");
CREATE INDEX IF NOT EXISTS "ss_participants_editionId_idx" ON "ss_participants"("editionId");
ALTER TABLE "ss_editions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ss_participants" ENABLE ROW LEVEL SECURITY;
