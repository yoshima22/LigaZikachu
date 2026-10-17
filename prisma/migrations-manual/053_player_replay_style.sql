-- Preferência de estilo de replay por jogador: "classic" (padrão) | "modern".
-- Aditiva e idempotente.
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "replayStyle" text NOT NULL DEFAULT 'classic';
