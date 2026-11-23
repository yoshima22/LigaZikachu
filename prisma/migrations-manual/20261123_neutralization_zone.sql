-- Zona de Neutralização: item que protege do PvP da Arena Z (1 uso por dia BRT).
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'NEUTRALIZATION_ZONE';
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "arenaNeutralizedUntil" TIMESTAMP(3);
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "arenaNeutralizationDay" TEXT;
