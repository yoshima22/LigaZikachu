CREATE TABLE IF NOT EXISTS "mascot_stat_growth_entries" (
  "id" TEXT NOT NULL,
  "mascotId" TEXT NOT NULL,
  "fromLevel" INTEGER NOT NULL,
  "toLevel" INTEGER NOT NULL,
  "forceGained" INTEGER NOT NULL,
  "agilityGained" INTEGER NOT NULL,
  "charismaGained" INTEGER NOT NULL,
  "instinctGained" INTEGER NOT NULL,
  "vitalityGained" INTEGER NOT NULL,
  "forceAfter" INTEGER NOT NULL,
  "agilityAfter" INTEGER NOT NULL,
  "charismaAfter" INTEGER NOT NULL,
  "instinctAfter" INTEGER NOT NULL,
  "vitalityAfter" INTEGER NOT NULL,
  "pokemonIdBefore" INTEGER NOT NULL,
  "pokemonIdAfter" INTEGER NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "metadata" JSONB,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mascot_stat_growth_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mascot_stat_growth_entries_mascotId_fkey"
    FOREIGN KEY ("mascotId") REFERENCES "mascots"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "mascot_stat_growth_entries_mascotId_recordedAt_idx"
  ON "mascot_stat_growth_entries"("mascotId", "recordedAt");
