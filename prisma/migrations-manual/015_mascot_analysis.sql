-- Análise de IV/potencial de mascotes (Laboratório)
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "analyzedAt"   TIMESTAMP(3);
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "ivScore"      INTEGER;
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "ivRating"     TEXT;
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "analysisJson" JSONB;
