ALTER TABLE "world_player_states" ADD COLUMN "defeatedTrainerIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "world_battle_sessions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "trainerName" TEXT NOT NULL,
    "winner" TEXT NOT NULL,
    "rounds" INTEGER NOT NULL,
    "rewardJson" JSONB,
    "resultJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "world_battle_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "world_battle_sessions_playerId_createdAt_idx" ON "world_battle_sessions"("playerId", "createdAt");
CREATE INDEX "world_battle_sessions_trainerId_createdAt_idx" ON "world_battle_sessions"("trainerId", "createdAt");
ALTER TABLE "world_battle_sessions" ADD CONSTRAINT "world_battle_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
