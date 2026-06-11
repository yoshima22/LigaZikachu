-- Adiciona coluna passLabel na tabela supporter_passes
-- Necessário para suporte a múltiplos tipos de passe (Gold, Diamante, etc.)
ALTER TABLE "supporter_passes"
  ADD COLUMN IF NOT EXISTS "passLabel" TEXT NOT NULL DEFAULT 'Passe Apoiador';
