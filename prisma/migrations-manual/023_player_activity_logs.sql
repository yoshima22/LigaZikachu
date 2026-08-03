CREATE TABLE IF NOT EXISTS "player_activity_logs" (
  "id" TEXT NOT NULL,
  "playerId" TEXT,
  "actorUserId" TEXT,
  "category" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "source" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "amount" INTEGER,
  "unit" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "player_activity_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_activity_logs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "player_activity_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "player_activity_logs_playerId_createdAt_idx" ON "player_activity_logs"("playerId", "createdAt");
CREATE INDEX IF NOT EXISTS "player_activity_logs_category_createdAt_idx" ON "player_activity_logs"("category", "createdAt");
CREATE INDEX IF NOT EXISTS "player_activity_logs_entityType_entityId_createdAt_idx" ON "player_activity_logs"("entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "player_activity_logs_createdAt_idx" ON "player_activity_logs"("createdAt");
