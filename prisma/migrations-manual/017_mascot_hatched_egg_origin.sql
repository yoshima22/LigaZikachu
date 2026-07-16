-- Preserva o tipo e a origem do ovo depois que ele e consumido ao chocar.
-- Mascotes existentes permanecem NULL porque o ovo historico ja foi removido.
ALTER TABLE "mascots"
  ADD COLUMN IF NOT EXISTS "hatchedFromEggType" "EggType",
  ADD COLUMN IF NOT EXISTS "hatchedFromEggOrigin" TEXT;
