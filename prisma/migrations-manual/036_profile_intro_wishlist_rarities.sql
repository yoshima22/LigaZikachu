-- Preferência de desligar animação de intro dos perfis + raridades de ovo por item da wishlist.
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "disableProfileIntro" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "player_pokemon_wishlist" ADD COLUMN IF NOT EXISTS "eggRarities" TEXT[] NOT NULL DEFAULT '{}';
