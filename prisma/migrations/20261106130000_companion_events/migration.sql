ALTER TABLE "companion_devices" ADD COLUMN "weeklyTickerEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "companion_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "deviceId" TEXT NOT NULL REFERENCES "companion_devices"("id") ON DELETE CASCADE,
  "dedupeKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "actions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("deviceId", "dedupeKey")
);
CREATE INDEX "companion_events_deviceId_id_idx" ON "companion_events" ("deviceId", "id");
