CREATE TABLE IF NOT EXISTS "egg_pity_counters" (
  "playerId" TEXT NOT NULL,
  "eggKey" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "egg_pity_counters_pkey" PRIMARY KEY ("playerId", "eggKey"),
  CONSTRAINT "egg_pity_counters_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
