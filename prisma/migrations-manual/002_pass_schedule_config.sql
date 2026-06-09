-- Tabela de configuração do calendário do Passe Apoiador
CREATE TABLE IF NOT EXISTS "pass_schedule_config" (
  "id"        TEXT NOT NULL DEFAULT 'singleton',
  "schedule"  JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedBy" TEXT,
  CONSTRAINT "pass_schedule_config_pkey" PRIMARY KEY ("id")
);
