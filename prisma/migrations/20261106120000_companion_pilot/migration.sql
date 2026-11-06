CREATE TABLE "companion_authorizations" (
  "id" TEXT NOT NULL, "deviceCodeHash" TEXT NOT NULL, "userCodeHash" TEXT NOT NULL,
  "userId" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "companion_authorizations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companion_authorizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "companion_authorizations_deviceCodeHash_key" ON "companion_authorizations"("deviceCodeHash");
CREATE UNIQUE INDEX "companion_authorizations_userCodeHash_key" ON "companion_authorizations"("userCodeHash");
CREATE INDEX "companion_authorizations_expiresAt_idx" ON "companion_authorizations"("expiresAt");
CREATE TABLE "companion_devices" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "refreshHash" TEXT NOT NULL,
  "refreshExpiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "companion_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companion_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "companion_devices_refreshHash_key" ON "companion_devices"("refreshHash");
CREATE INDEX "companion_devices_userId_idx" ON "companion_devices"("userId");
ALTER TABLE "companion_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "companion_devices" ENABLE ROW LEVEL SECURITY;
