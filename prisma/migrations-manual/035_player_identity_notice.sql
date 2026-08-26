-- Identidade/anti-impersonação: limite de troca de nome + aviso com confirmação.
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "nameChangeCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "lastAckedNoticeVersion" INTEGER NOT NULL DEFAULT 0;
