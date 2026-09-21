ALTER TYPE "GachaObjectiveSource" ADD VALUE IF NOT EXISTS 'BAZAR_LEILAO_VENCIDO';
ALTER TYPE "GachaObjectiveSource" ADD VALUE IF NOT EXISTS 'ALBUM_PACOTES_COMPRADOS';

CREATE TABLE IF NOT EXISTS "gacha_banner_missions" (
  "id" TEXT NOT NULL,
  "bannerId" TEXT NOT NULL,
  "missionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gacha_banner_missions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "gacha_banner_missions_bannerId_missionId_key" ON "gacha_banner_missions"("bannerId", "missionId");
CREATE INDEX IF NOT EXISTS "gacha_banner_missions_missionId_idx" ON "gacha_banner_missions"("missionId");
ALTER TABLE "gacha_banner_missions" DROP CONSTRAINT IF EXISTS "gacha_banner_missions_bannerId_fkey";
ALTER TABLE "gacha_banner_missions" ADD CONSTRAINT "gacha_banner_missions_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "gacha_banners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gacha_banner_missions" DROP CONSTRAINT IF EXISTS "gacha_banner_missions_missionId_fkey";
ALTER TABLE "gacha_banner_missions" ADD CONSTRAINT "gacha_banner_missions_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "gacha_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "gacha_banner_missions" ("id", "bannerId", "missionId")
SELECT md5("bannerId" || ':' || "id"), "bannerId", "id"
FROM "gacha_missions"
WHERE "bannerId" IS NOT NULL
ON CONFLICT ("bannerId", "missionId") DO NOTHING;
