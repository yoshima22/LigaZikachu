-- Código de convite único (6 dígitos) por jogador + quem convidou cada jogador.

ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "inviteCode" TEXT;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "invitedByPlayerId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "players_inviteCode_key" ON "players" ("inviteCode");
CREATE INDEX IF NOT EXISTS "players_invitedByPlayerId_idx" ON "players" ("invitedByPlayerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'players_invitedByPlayerId_fkey'
  ) THEN
    ALTER TABLE "players"
      ADD CONSTRAINT "players_invitedByPlayerId_fkey"
      FOREIGN KEY ("invitedByPlayerId") REFERENCES "players"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
