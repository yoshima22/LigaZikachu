-- Configuracao padrao de retroatividade por tipo de passe VIP.
ALTER TABLE "pass_schedule_config"
  ADD COLUMN IF NOT EXISTS "allowRetroactiveClaims" BOOLEAN NOT NULL DEFAULT false;
