ALTER TABLE "liga_cash_orders"
  ADD COLUMN IF NOT EXISTS "giftRecipientPlayerId" TEXT,
  ADD COLUMN IF NOT EXISTS "giftTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "giftMessage" TEXT;
