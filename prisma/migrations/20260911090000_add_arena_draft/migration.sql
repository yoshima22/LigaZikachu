CREATE TABLE "arena_draft_presets" (
  "id" TEXT NOT NULL, "ownerId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "petsJson" JSONB NOT NULL, "isReady" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "arena_draft_presets_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "arena_draft_matches" (
  "id" TEXT NOT NULL, "playerAId" TEXT NOT NULL, "playerBId" TEXT,
  "winnerId" TEXT, "state" TEXT NOT NULL DEFAULT 'CREATED', "stateVersion" INTEGER NOT NULL DEFAULT 1,
  "deadlineAt" TIMESTAMP(3), "presetASnapshot" JSONB NOT NULL, "presetBSnapshot" JSONB,
  "draftJson" JSONB, "battleJson" JSONB, "metricsJson" JSONB, "eventSequence" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3), CONSTRAINT "arena_draft_matches_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "arena_draft_actions" (
  "id" TEXT NOT NULL, "matchId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "sequence" INTEGER NOT NULL, "phase" TEXT NOT NULL,
  "actionType" TEXT NOT NULL, "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "arena_draft_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "arena_draft_presets_ownerId_updatedAt_idx" ON "arena_draft_presets"("ownerId", "updatedAt");
CREATE INDEX "arena_draft_matches_state_createdAt_idx" ON "arena_draft_matches"("state", "createdAt");
CREATE INDEX "arena_draft_matches_playerAId_createdAt_idx" ON "arena_draft_matches"("playerAId", "createdAt");
CREATE INDEX "arena_draft_matches_playerBId_createdAt_idx" ON "arena_draft_matches"("playerBId", "createdAt");
CREATE UNIQUE INDEX "arena_draft_actions_idempotencyKey_key" ON "arena_draft_actions"("idempotencyKey");
CREATE UNIQUE INDEX "arena_draft_actions_matchId_sequence_key" ON "arena_draft_actions"("matchId", "sequence");
CREATE INDEX "arena_draft_actions_matchId_createdAt_idx" ON "arena_draft_actions"("matchId", "createdAt");
ALTER TABLE "arena_draft_presets" ADD CONSTRAINT "arena_draft_presets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_draft_matches" ADD CONSTRAINT "arena_draft_matches_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "arena_draft_matches" ADD CONSTRAINT "arena_draft_matches_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "arena_draft_matches" ADD CONSTRAINT "arena_draft_matches_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "arena_draft_actions" ADD CONSTRAINT "arena_draft_actions_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "arena_draft_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
