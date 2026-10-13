CREATE TABLE IF NOT EXISTS "direct_message_blocks" (
  "id" TEXT PRIMARY KEY,
  "blockerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "blockedId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_message_blocks_blocker_not_blocked" CHECK ("blockerId" <> "blockedId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "direct_message_blocks_blockerId_blockedId_key" ON "direct_message_blocks"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "direct_message_blocks_blockedId_idx" ON "direct_message_blocks"("blockedId");
ALTER TABLE "direct_message_blocks" ENABLE ROW LEVEL SECURITY;
