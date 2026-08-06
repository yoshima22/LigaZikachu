CREATE TABLE "mascot_interaction_jobs" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resultJson" JSONB,
    "lastError" TEXT,
    "lockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mascot_interaction_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mascot_interaction_jobs_idempotencyKey_key"
ON "mascot_interaction_jobs"("idempotencyKey");

CREATE INDEX "mascot_interaction_jobs_status_createdAt_idx"
ON "mascot_interaction_jobs"("status", "createdAt");

CREATE INDEX "mascot_interaction_jobs_playerId_createdAt_idx"
ON "mascot_interaction_jobs"("playerId", "createdAt");

ALTER TABLE "mascot_interaction_jobs"
ADD CONSTRAINT "mascot_interaction_jobs_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
