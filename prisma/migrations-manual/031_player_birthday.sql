-- Data de aniversário do jogador (imutável após preenchida) + controle do
-- presente anual de aniversário (roleta).

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "birthdayGiftYear" INTEGER;
