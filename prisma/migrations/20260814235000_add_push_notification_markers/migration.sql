CREATE TABLE "push_notification_markers" (
  "id" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_notification_markers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "push_notification_markers_eventKey_key" ON "push_notification_markers"("eventKey");
CREATE INDEX "push_notification_markers_createdAt_idx" ON "push_notification_markers"("createdAt");
