-- Migration 004: Campos para cooldown pós-retirada e rastreio de ataque PvP visto
-- Rodar no Supabase SQL Editor

-- 1. arena_teams: marca quando o time foi retirado COM recompensas
--    Usado para bloquear o mesmo mascote de entrar em nova equipe por 10 min
ALTER TABLE "arena_teams"
  ADD COLUMN IF NOT EXISTS "retiredAt" TIMESTAMP WITH TIME ZONE;

-- 2. arena_battles: marca se o defensor já visualizou o ataque PvP
--    Usado para bloquear PvE/saída até que o defensor "veja" o combate
ALTER TABLE "arena_battles"
  ADD COLUMN IF NOT EXISTS "seenByDefender" BOOLEAN NOT NULL DEFAULT false;

-- Marca batalhas antigas como já vistas (não queremos bloquear usuários existentes)
UPDATE "arena_battles" SET "seenByDefender" = true WHERE "type" = 'PVP';
