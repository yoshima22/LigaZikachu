-- Ordem manual dos favoritos + postura de combate preferida por mascote.

ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "favoriteOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "preferredCombatRole" TEXT;
