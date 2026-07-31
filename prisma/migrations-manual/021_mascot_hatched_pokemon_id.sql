ALTER TABLE "Mascot"
  ADD COLUMN IF NOT EXISTS "hatchedPokemonId" INTEGER;

COMMENT ON COLUMN "Mascot"."hatchedPokemonId" IS
  'Especie exata que nasceu do ovo; permanece igual depois de evolucoes.';
