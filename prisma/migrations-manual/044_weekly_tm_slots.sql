-- TMs da Semana no Miauvadão (5 slots fixos, reset semanal).
ALTER TABLE "miauvadao_config" ADD COLUMN IF NOT EXISTS "weeklyTmWeekStart" TIMESTAMP(3);
ALTER TABLE "miauvadao_config" ADD COLUMN IF NOT EXISTS "weeklyTmSlots" JSONB NOT NULL DEFAULT '[]';
