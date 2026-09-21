-- Preferências de notificação por jogador (categorias/canais) + cooldown de push.
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "notificationSettings" JSONB;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "lastPushAt" TIMESTAMP(3);
