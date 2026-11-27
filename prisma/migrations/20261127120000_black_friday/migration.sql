ALTER TABLE liga_cash_orders
  ADD COLUMN IF NOT EXISTS "eventKey" TEXT,
  ADD COLUMN IF NOT EXISTS "eventBonusLc" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "eventSavedCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS black_friday_tickets (
  id TEXT PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL UNIQUE,
  "startNumber" INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS black_friday_tickets_player_idx ON black_friday_tickets ("playerId");

CREATE TABLE IF NOT EXISTS black_friday_usages (
  id TEXT PRIMARY KEY,
  "playerId" TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  currency TEXT NOT NULL,
  "savedAmount" INTEGER NOT NULL,
  "bonusLc" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS black_friday_usages_kind_idx ON black_friday_usages (kind, "createdAt");
CREATE INDEX IF NOT EXISTS black_friday_usages_player_idx ON black_friday_usages ("playerId");

CREATE TABLE IF NOT EXISTS black_friday_draws (
  id TEXT PRIMARY KEY,
  "winningNumber" INTEGER NOT NULL,
  "winnerPlayerId" TEXT NOT NULL,
  "totalTickets" INTEGER NOT NULL,
  "prizeLc" INTEGER NOT NULL,
  "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 20% em toda a ZikaShop durante o evento (promoção global; o admin pode desligar em /shop/admin).
INSERT INTO shop_promotions (id, name, scope, "discountPct", "startsAt", "endsAt", active, "createdAt", "updatedAt")
VALUES ('black-friday-2026', 'Black Friday do Miauvadão', 'GLOBAL'::"ShopPromotionScope", 20,
  '2026-11-27T00:00:00-03:00', '2026-12-01T00:00:00-03:00', true, now(), now())
ON CONFLICT (id) DO NOTHING;
