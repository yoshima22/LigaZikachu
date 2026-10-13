-- Convite individual e votação única da campanha de lançamento de Johto. Idempotente.
CREATE TABLE IF NOT EXISTS "johto_invitation_campaigns" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "launchAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "pushStartedAt" TIMESTAMP(3),
  "pushSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "johto_invitation_campaigns_publishedAt_launchAt_idx"
  ON "johto_invitation_campaigns"("publishedAt", "launchAt");

CREATE TABLE IF NOT EXISTS "johto_invitation_recipients" (
  "id" TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES "johto_invitation_campaigns"("id") ON DELETE CASCADE,
  "playerId" TEXT NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "availableAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "votingSkippedAt" TIMESTAMP(3),
  "voteSubmittedAt" TIMESTAMP(3),
  "pushSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "johto_invitation_recipients_campaignId_playerId_key"
  ON "johto_invitation_recipients"("campaignId", "playerId");
CREATE INDEX IF NOT EXISTS "johto_invitation_recipients_campaignId_availableAt_idx"
  ON "johto_invitation_recipients"("campaignId", "availableAt");
CREATE INDEX IF NOT EXISTS "johto_invitation_recipients_playerId_idx"
  ON "johto_invitation_recipients"("playerId");
CREATE UNIQUE INDEX IF NOT EXISTS "johto_invitation_recipients_id_campaignId_key"
  ON "johto_invitation_recipients"("id", "campaignId");
CREATE INDEX IF NOT EXISTS "johto_invitation_recipients_campaignId_openedAt_idx"
  ON "johto_invitation_recipients"("campaignId", "openedAt");
CREATE INDEX IF NOT EXISTS "johto_invitation_recipients_campaignId_votingSkippedAt_idx"
  ON "johto_invitation_recipients"("campaignId", "votingSkippedAt");
CREATE INDEX IF NOT EXISTS "johto_invitation_recipients_campaignId_voteSubmittedAt_idx"
  ON "johto_invitation_recipients"("campaignId", "voteSubmittedAt");
CREATE INDEX IF NOT EXISTS "johto_invitation_recipients_campaignId_pushSentAt_idx"
  ON "johto_invitation_recipients"("campaignId", "pushSentAt");

CREATE TABLE IF NOT EXISTS "johto_invitation_votes" (
  "id" TEXT PRIMARY KEY,
  "campaignId" TEXT NOT NULL REFERENCES "johto_invitation_campaigns"("id") ON DELETE CASCADE,
  "recipientId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "candidatePlayerId" TEXT,
  "candidateDisplayName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Replace earlier single-column references safely and keep snapshots when a candidate is deleted.
ALTER TABLE "johto_invitation_votes" ALTER COLUMN "candidatePlayerId" DROP NOT NULL;
ALTER TABLE "johto_invitation_votes" DROP CONSTRAINT IF EXISTS "johto_invitation_votes_recipientId_fkey";
ALTER TABLE "johto_invitation_votes" DROP CONSTRAINT IF EXISTS "johto_invitation_votes_recipientId_campaignId_fkey";
ALTER TABLE "johto_invitation_votes" ADD CONSTRAINT "johto_invitation_votes_recipientId_campaignId_fkey"
  FOREIGN KEY ("recipientId", "campaignId")
  REFERENCES "johto_invitation_recipients"("id", "campaignId") ON DELETE CASCADE;
ALTER TABLE "johto_invitation_votes" DROP CONSTRAINT IF EXISTS "johto_invitation_votes_candidatePlayerId_fkey";
ALTER TABLE "johto_invitation_votes" DROP CONSTRAINT IF EXISTS "johto_invitation_votes_candidatePlayerId_history_fkey";
ALTER TABLE "johto_invitation_votes" ADD CONSTRAINT "johto_invitation_votes_candidatePlayerId_history_fkey"
  FOREIGN KEY ("candidatePlayerId") REFERENCES "players"("id") ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "johto_invitation_votes_campaignId_recipientId_questionKey_key"
  ON "johto_invitation_votes"("campaignId", "recipientId", "questionKey");
CREATE INDEX IF NOT EXISTS "johto_invitation_votes_campaignId_questionKey_candidatePlayerId_idx"
  ON "johto_invitation_votes"("campaignId", "questionKey", "candidatePlayerId");
CREATE INDEX IF NOT EXISTS "johto_invitation_votes_recipientId_idx"
  ON "johto_invitation_votes"("recipientId");

ALTER TABLE "johto_invitation_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "johto_invitation_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "johto_invitation_votes" ENABLE ROW LEVEL SECURITY;
