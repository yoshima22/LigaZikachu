ALTER TABLE "mascots"
  ADD COLUMN "speciesNameOverride" TEXT,
  ADD COLUMN "primaryTypeOverride" TEXT,
  ADD COLUMN "secondaryTypeOverride" TEXT,
  ADD COLUMN "staticSpriteUrlOverride" TEXT,
  ADD COLUMN "animatedSpriteUrlOverride" TEXT,
  ADD COLUMN "generationOverride" INTEGER;

CREATE TABLE "pokemon_species_definitions" (
  "id" TEXT NOT NULL,
  "pokemonId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "primaryType" TEXT NOT NULL,
  "secondaryType" TEXT,
  "staticSpriteUrl" TEXT,
  "animatedSpriteUrl" TEXT,
  "custom" BOOLEAN NOT NULL DEFAULT false,
  "eggEligible" BOOLEAN NOT NULL DEFAULT true,
  "rarity" TEXT NOT NULL DEFAULT 'COMMON',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pokemon_species_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pokemon_species_definitions_pokemonId_key" ON "pokemon_species_definitions"("pokemonId");
CREATE INDEX "pokemon_species_definitions_name_idx" ON "pokemon_species_definitions"("name");
CREATE INDEX "pokemon_species_definitions_generation_eggEligible_idx" ON "pokemon_species_definitions"("generation", "eggEligible");
