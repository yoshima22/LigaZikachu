ALTER TABLE "redeem_code_rewards" ALTER COLUMN "itemId" DROP NOT NULL;
ALTER TABLE "redeem_code_rewards"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'ITEM',
  ADD COLUMN IF NOT EXISTS "itemType" TEXT,
  ADD COLUMN IF NOT EXISTS "eggType" "EggType";
ALTER TABLE "redeem_code_redemptions" ADD COLUMN IF NOT EXISTS "rewardsJson" JSONB;
