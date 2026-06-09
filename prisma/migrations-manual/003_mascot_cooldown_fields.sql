-- Migration 003: Campos de cooldown independentes para brincar e carinho
-- Roda no Supabase SQL Editor
-- Antes: PLAY e PET compartilhavam lastInteractedAt, causando bloqueio cruzado
-- Depois: cada ação tem seu próprio timestamp persistido no banco

ALTER TABLE "Mascot"
  ADD COLUMN IF NOT EXISTS "lastPlayedAt" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "lastPettedAt"  TIMESTAMP WITH TIME ZONE;

-- Popula lastPlayedAt com o valor atual de lastInteractedAt (melhor estimativa)
UPDATE "Mascot"
SET "lastPlayedAt" = "lastInteractedAt"
WHERE "lastInteractedAt" IS NOT NULL;
