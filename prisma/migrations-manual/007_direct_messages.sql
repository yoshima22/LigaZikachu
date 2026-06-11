-- Migration 007: direct_messages (DM entre jogadores)
CREATE TABLE IF NOT EXISTS "direct_messages" (
  "id"         TEXT        NOT NULL,
  "senderId"   TEXT        NOT NULL,
  "receiverId" TEXT        NOT NULL,
  "content"    TEXT        NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "readAt"     TIMESTAMPTZ,
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_messages_senderId_fkey"
    FOREIGN KEY ("senderId")   REFERENCES "players"("id") ON DELETE CASCADE,
  CONSTRAINT "direct_messages_receiverId_fkey"
    FOREIGN KEY ("receiverId") REFERENCES "players"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "direct_messages_senderId_receiverId_idx"
  ON "direct_messages"("senderId", "receiverId");

CREATE INDEX IF NOT EXISTS "direct_messages_receiverId_readAt_idx"
  ON "direct_messages"("receiverId", "readAt");
