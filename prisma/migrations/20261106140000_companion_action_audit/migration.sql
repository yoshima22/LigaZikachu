CREATE TABLE "companion_action_audit" (
  "deviceId" TEXT NOT NULL REFERENCES "companion_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "eventId" BIGINT NOT NULL REFERENCES "companion_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actionId" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("deviceId", "eventId", "actionId")
);
ALTER TABLE "companion_action_audit" ENABLE ROW LEVEL SECURITY;

