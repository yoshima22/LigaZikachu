-- Liga/desliga de espécies (formas alternativas + Unown) nas pools de ovo.
-- Linha presente com disabled=true => espécie fora do drop.
CREATE TABLE IF NOT EXISTS "egg_pokemon_toggle" (
  "pokemon_id"    INTEGER NOT NULL,
  "disabled"      BOOLEAN NOT NULL DEFAULT true,
  "updated_by_id" TEXT,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "egg_pokemon_toggle_pkey" PRIMARY KEY ("pokemon_id")
);
