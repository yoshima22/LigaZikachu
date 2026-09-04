ALTER TABLE "pass_schedule_config"
  ADD COLUMN IF NOT EXISTS "storeActivationAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "storeActivationRetroactive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "storeActivatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "pass_schedule_config_storeActivationAt_idx"
  ON "pass_schedule_config" ("storeActivationAt");
