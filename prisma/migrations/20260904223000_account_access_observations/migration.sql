CREATE TABLE "account_access_observations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "networkHash" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "userAgentHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hits" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "account_access_observations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_access_observations_userId_networkHash_deviceHash_key"
ON "account_access_observations"("userId", "networkHash", "deviceHash");
CREATE INDEX "account_access_observations_networkHash_lastSeenAt_idx"
ON "account_access_observations"("networkHash", "lastSeenAt");
CREATE INDEX "account_access_observations_deviceHash_lastSeenAt_idx"
ON "account_access_observations"("deviceHash", "lastSeenAt");
CREATE INDEX "account_access_observations_userId_lastSeenAt_idx"
ON "account_access_observations"("userId", "lastSeenAt");

ALTER TABLE "account_access_observations"
ADD CONSTRAINT "account_access_observations_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
