-- Prioridade das habilidades da equipe (ids de mascotes), independente do slot.
ALTER TABLE "arena_teams" ADD COLUMN IF NOT EXISTS "abilityOrder" JSONB;
