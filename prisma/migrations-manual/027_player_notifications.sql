CREATE TABLE IF NOT EXISTS "player_notifications" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "entityId" TEXT,
  "eventKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "player_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "player_notifications_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "player_notifications_eventKey_key"
  ON "player_notifications"("eventKey");

CREATE INDEX IF NOT EXISTS "player_notifications_playerId_category_readAt_createdAt_idx"
  ON "player_notifications"("playerId", "category", "readAt", "createdAt");
