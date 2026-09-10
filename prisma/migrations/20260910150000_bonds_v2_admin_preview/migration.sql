ALTER TABLE "mascot_relations"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dormantAt" TIMESTAMP(3);

ALTER TABLE "mascot_social_events"
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'SOCIAL',
  ADD COLUMN "sourceId" TEXT,
  ADD COLUMN "contextJson" JSONB,
  ADD COLUMN "isImportant" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "mascot_bond_memories" (
  "id" TEXT NOT NULL,
  "mascotAId" TEXT NOT NULL,
  "mascotBId" TEXT,
  "memoryType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "intensity" INTEGER NOT NULL DEFAULT 1,
  "isMilestone" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mascot_bond_memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mascot_routines" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "mascotId" TEXT NOT NULL,
  "locationType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "accumulatedUnits" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastProcessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mascot_routines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mascot_bond_memories_mascotAId_createdAt_idx" ON "mascot_bond_memories"("mascotAId", "createdAt");
CREATE INDEX "mascot_bond_memories_mascotBId_createdAt_idx" ON "mascot_bond_memories"("mascotBId", "createdAt");
CREATE INDEX "mascot_bond_memories_sourceType_sourceId_idx" ON "mascot_bond_memories"("sourceType", "sourceId");
CREATE UNIQUE INDEX "mascot_routines_mascotId_key" ON "mascot_routines"("mascotId");
CREATE INDEX "mascot_routines_playerId_locationType_status_idx" ON "mascot_routines"("playerId", "locationType", "status");

ALTER TABLE "mascot_bond_memories" ADD CONSTRAINT "mascot_bond_memories_mascotAId_fkey" FOREIGN KEY ("mascotAId") REFERENCES "mascots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mascot_bond_memories" ADD CONSTRAINT "mascot_bond_memories_mascotBId_fkey" FOREIGN KEY ("mascotBId") REFERENCES "mascots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mascot_routines" ADD CONSTRAINT "mascot_routines_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mascot_routines" ADD CONSTRAINT "mascot_routines_mascotId_fkey" FOREIGN KEY ("mascotId") REFERENCES "mascots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
