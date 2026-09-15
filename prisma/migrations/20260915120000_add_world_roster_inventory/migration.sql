ALTER TABLE "world_player_states"
  ADD COLUMN "chestJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "backpackCapacity" INTEGER NOT NULL DEFAULT 12,
  ADD COLUMN "gymCooldownJson" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "starterPokemonId" INTEGER;

CREATE TABLE "world_mascots" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "mainMascotId" TEXT,
  "pokemonId" INTEGER NOT NULL,
  "nickname" TEXT,
  "level" INTEGER NOT NULL DEFAULT 1,
  "exp" INTEGER NOT NULL DEFAULT 0,
  "personality" "MascotPersonality" NOT NULL,
  "statForce" INTEGER NOT NULL DEFAULT 10,
  "statAgility" INTEGER NOT NULL DEFAULT 10,
  "statCharisma" INTEGER NOT NULL DEFAULT 10,
  "statInstinct" INTEGER NOT NULL DEFAULT 10,
  "statVitality" INTEGER NOT NULL DEFAULT 10,
  "currentHp" INTEGER NOT NULL,
  "poisoned" BOOLEAN NOT NULL DEFAULT false,
  "origin" TEXT NOT NULL,
  "isInParty" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "world_mascots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "world_mascots_playerId_isInParty_idx" ON "world_mascots"("playerId", "isInParty");
CREATE INDEX "world_mascots_playerId_pokemonId_idx" ON "world_mascots"("playerId", "pokemonId");
ALTER TABLE "world_mascots" ADD CONSTRAINT "world_mascots_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
