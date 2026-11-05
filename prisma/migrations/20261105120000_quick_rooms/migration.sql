-- Salas rápidas públicas (sem conta). A tabela guarda só metadados; chat e mídia não passam pelo banco.
CREATE TABLE IF NOT EXISTS "quick_rooms" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "topicSecret" TEXT NOT NULL,
  "passwordHash" TEXT,
  "maxParticipants" INTEGER NOT NULL DEFAULT 6,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quick_rooms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quick_rooms_code_key" ON "quick_rooms" ("code");
CREATE INDEX IF NOT EXISTS "quick_rooms_lastActiveAt_idx" ON "quick_rooms" ("lastActiveAt");
ALTER TABLE "quick_rooms" ENABLE ROW LEVEL SECURITY;
