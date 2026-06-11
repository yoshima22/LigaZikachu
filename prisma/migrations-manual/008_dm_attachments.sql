-- Migration 008: colunas de anexo nas DMs
ALTER TABLE "direct_messages"
  ADD COLUMN IF NOT EXISTS "attachmentType" TEXT,
  ADD COLUMN IF NOT EXISTS "attachmentData" JSONB;
