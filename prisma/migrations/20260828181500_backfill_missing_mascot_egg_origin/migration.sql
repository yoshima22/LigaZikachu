-- Preserva uma auditoria compacta dos registros alterados antes do backfill.
-- O registro único evita centenas de linhas extras, mas mantém os IDs afetados.
INSERT INTO "audit_logs" (
  "id", "entityType", "entityId", "action", "before", "after", "metadata", "createdAt"
)
SELECT
  'egg-origin-backfill-20260828',
  'MASCOT_EGG_ORIGIN',
  'global',
  'BACKFILL_MISSING_TO_RARE',
  jsonb_build_object(
    'count', COUNT(*),
    'mascotIds', COALESCE(jsonb_agg("id" ORDER BY "id"), '[]'::jsonb)
  ),
  jsonb_build_object('hatchedFromEggType', 'RARE'),
  jsonb_build_object(
    'reason', 'Mascotes antigos sem origem confirmada passam a usar Ovo Raro em vez do fallback visual de Laboratório.',
    'effectiveDate', '2026-08-28'
  ),
  CURRENT_TIMESTAMP
FROM "mascots"
WHERE "hatchedFromEggType" IS NULL
ON CONFLICT ("id") DO NOTHING;

UPDATE "mascots"
SET "hatchedFromEggType" = 'RARE'
WHERE "hatchedFromEggType" IS NULL;

-- Novos mascotes criados sem origem explícita recebem o mesmo fallback seguro.
ALTER TABLE "mascots"
  ALTER COLUMN "hatchedFromEggType" SET DEFAULT 'RARE';
