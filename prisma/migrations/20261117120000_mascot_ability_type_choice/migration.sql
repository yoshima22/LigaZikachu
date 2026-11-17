-- Tipo escolhido pelo jogador para habilidades como Multitype/RKS System (Arceus, Silvally).
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "abilityTypeChoice" TEXT;
