-- Habilidades passivas: TM de habilidade oculta (um tipo de item; a habilidade vai em ShopItem.metadata).
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "hiddenAbilityUnlocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "abilityChoice" TEXT;
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'ABILITY_TM';
