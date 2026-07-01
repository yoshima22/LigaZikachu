-- Leilão do Bazar
ALTER TYPE "BazarListingType" ADD VALUE IF NOT EXISTS 'AUCTION';

ALTER TABLE "bazar_listings" ADD COLUMN IF NOT EXISTS "minBidCoins"        INTEGER;
ALTER TABLE "bazar_listings" ADD COLUMN IF NOT EXISTS "currentBidCoins"    INTEGER;
ALTER TABLE "bazar_listings" ADD COLUMN IF NOT EXISTS "currentBidPlayerId" TEXT;
ALTER TABLE "bazar_listings" ADD COLUMN IF NOT EXISTS "auctionEndsAt"      TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "bazar_auction_bids" (
  "id"        TEXT         NOT NULL,
  "listingId" TEXT         NOT NULL,
  "playerId"  TEXT         NOT NULL,
  "amount"    INTEGER      NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bazar_auction_bids_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "bazar_auction_bids_listingId_fkey"  FOREIGN KEY ("listingId") REFERENCES "bazar_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bazar_auction_bids_playerId_fkey"   FOREIGN KEY ("playerId")  REFERENCES "players"("id")        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "bazar_auction_bids_listingId_createdAt_idx" ON "bazar_auction_bids"("listingId", "createdAt");
