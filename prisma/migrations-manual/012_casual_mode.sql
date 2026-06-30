-- Adiciona campo casualMode ao modelo Player
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "casualMode" BOOLEAN NOT NULL DEFAULT FALSE;
