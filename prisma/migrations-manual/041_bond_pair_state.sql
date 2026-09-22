-- Estado narrativo por dupla (arcos + tags) para o motor de histórias dos Laços.
CREATE TABLE IF NOT EXISTS "mascot_bond_pair_state" (
  "pairKey"   TEXT PRIMARY KEY,
  "arcsJson"  JSONB,
  "tagsJson"  JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
