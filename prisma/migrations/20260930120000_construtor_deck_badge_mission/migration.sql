ALTER TABLE "construtor_decks"
  ADD COLUMN IF NOT EXISTS "gymBadgeId" TEXT,
  ADD COLUMN IF NOT EXISTS "mascotMissionMascotId" TEXT,
  ADD COLUMN IF NOT EXISTS "mascotMissionPokemonId" INTEGER,
  ADD COLUMN IF NOT EXISTS "mascotMissionMascotName" TEXT,
  ADD COLUMN IF NOT EXISTS "mascotMissionValid" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "mascotMissionValidation" JSONB;
