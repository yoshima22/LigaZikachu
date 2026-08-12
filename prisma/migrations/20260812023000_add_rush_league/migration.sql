CREATE TABLE "rush_leagues" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "weekKey" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "weekEnd" TIMESTAMP(3) NOT NULL,
  "registrationEnds" TIMESTAMP(3) NOT NULL,
  "status" "WeeklyLeagueStatus" NOT NULL DEFAULT 'REGISTRATION',
  "division" TEXT NOT NULL DEFAULT 'LIMITED',
  "teamSize" INTEGER NOT NULL DEFAULT 3,
  "maxLevel" INTEGER,
  "requiredType" TEXT,
  "uniqueSpecies" BOOLEAN NOT NULL DEFAULT false,
  "ruleJson" JSONB NOT NULL DEFAULT '{}',
  "rewardsJson" JSONB NOT NULL DEFAULT '[]',
  "championPlayerId" TEXT,
  "rewardsGrantedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rush_leagues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rush_league_participants" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "wins" INTEGER NOT NULL DEFAULT 0,
  "losses" INTEGER NOT NULL DEFAULT 0,
  "draws" INTEGER NOT NULL DEFAULT 0,
  "survivorsScore" INTEGER NOT NULL DEFAULT 0,
  "damageDealt" INTEGER NOT NULL DEFAULT 0,
  "damageTaken" INTEGER NOT NULL DEFAULT 0,
  "finalRank" INTEGER,
  "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rush_league_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rush_league_daily_teams" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "battleDate" TEXT NOT NULL,
  "battleSlot" INTEGER NOT NULL,
  "mascotIdsJson" JSONB NOT NULL,
  "rolesJson" JSONB,
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rush_league_daily_teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rush_league_matches" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "battleDate" TEXT NOT NULL,
  "battleSlot" INTEGER NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "playerAId" TEXT NOT NULL,
  "playerBId" TEXT,
  "winnerId" TEXT,
  "loserId" TEXT,
  "isDraw" BOOLEAN NOT NULL DEFAULT false,
  "playerASurvivors" INTEGER NOT NULL DEFAULT 0,
  "playerBSurvivors" INTEGER NOT NULL DEFAULT 0,
  "playerADamageDealt" INTEGER NOT NULL DEFAULT 0,
  "playerBDamageDealt" INTEGER NOT NULL DEFAULT 0,
  "replayJson" JSONB,
  "resultJson" JSONB,
  "status" "WeeklyMatchStatus" NOT NULL DEFAULT 'SCHEDULED',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rush_league_matches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rush_leagues_weekKey_key" ON "rush_leagues"("weekKey");
CREATE INDEX "rush_leagues_status_weekStart_idx" ON "rush_leagues"("status", "weekStart");
CREATE UNIQUE INDEX "rush_league_participants_leagueId_playerId_key" ON "rush_league_participants"("leagueId", "playerId");
CREATE INDEX "rush_league_participants_leagueId_points_wins_idx" ON "rush_league_participants"("leagueId", "points", "wins");
CREATE INDEX "rush_league_participants_playerId_idx" ON "rush_league_participants"("playerId");
CREATE UNIQUE INDEX "rush_league_daily_teams_leagueId_playerId_battleDate_battleSlot_key" ON "rush_league_daily_teams"("leagueId", "playerId", "battleDate", "battleSlot");
CREATE INDEX "rush_league_daily_teams_leagueId_battleDate_idx" ON "rush_league_daily_teams"("leagueId", "battleDate");
CREATE INDEX "rush_league_daily_teams_playerId_idx" ON "rush_league_daily_teams"("playerId");
CREATE UNIQUE INDEX "rush_league_matches_leagueId_battleDate_battleSlot_playerAId_key" ON "rush_league_matches"("leagueId", "battleDate", "battleSlot", "playerAId");
CREATE INDEX "rush_league_matches_leagueId_battleDate_idx" ON "rush_league_matches"("leagueId", "battleDate");
CREATE INDEX "rush_league_matches_playerAId_idx" ON "rush_league_matches"("playerAId");
CREATE INDEX "rush_league_matches_playerBId_idx" ON "rush_league_matches"("playerBId");
ALTER TABLE "rush_league_participants" ADD CONSTRAINT "rush_league_participants_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "rush_leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rush_league_daily_teams" ADD CONSTRAINT "rush_league_daily_teams_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "rush_leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rush_league_matches" ADD CONSTRAINT "rush_league_matches_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "rush_leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
