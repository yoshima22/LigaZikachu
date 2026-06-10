-- Migration 005: cooldown individual de re-entrada na arena por mascote
ALTER TABLE mascots
  ADD COLUMN IF NOT EXISTS "arenaEntryCooldownUntil" TIMESTAMPTZ;
