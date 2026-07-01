-- Sala de Treinamento: flag na equipe da arena
ALTER TABLE "arena_teams" ADD COLUMN IF NOT EXISTS "isTraining" BOOLEAN NOT NULL DEFAULT FALSE;
