-- Amigo Oculto: 3 opções de pacote por presenteador + recebedor único por edição. Idempotente.
ALTER TABLE "ss_participants" ADD COLUMN IF NOT EXISTS "giftOptionsJson" JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS "ss_participants_editionId_recipientId_key" ON "ss_participants"("editionId","recipientId");
