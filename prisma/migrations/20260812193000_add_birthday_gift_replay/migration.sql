ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "birthdayGiftLastKit" TEXT,
  ADD COLUMN IF NOT EXISTS "birthdayGiftReplayKit" TEXT;
