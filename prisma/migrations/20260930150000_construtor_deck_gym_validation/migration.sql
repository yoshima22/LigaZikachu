ALTER TABLE "construtor_decks"
  ADD COLUMN IF NOT EXISTS "gymBadgeValid" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "gymBadgeValidation" JSONB;
