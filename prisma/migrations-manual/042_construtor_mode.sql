-- Modo Construtor (Semana 6): 3 decks por jogador + escolha de deck pelo adversário.
CREATE TABLE IF NOT EXISTS "construtor_decks" (
  "id"               TEXT PRIMARY KEY,
  "tournamentWeekId" TEXT NOT NULL,
  "playerId"         TEXT NOT NULL,
  "slot"             INTEGER NOT NULL,
  "name"             TEXT NOT NULL,
  "deckList"         TEXT NOT NULL,
  "archetype"        TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "construtor_decks_week_player_slot" ON "construtor_decks" ("tournamentWeekId", "playerId", "slot");
CREATE INDEX IF NOT EXISTS "construtor_decks_week_player" ON "construtor_decks" ("tournamentWeekId", "playerId");

CREATE TABLE IF NOT EXISTS "construtor_picks" (
  "id"             TEXT PRIMARY KEY,
  "matchId"        TEXT NOT NULL,
  "targetPlayerId" TEXT NOT NULL,
  "pickerPlayerId" TEXT NOT NULL,
  "deckId"         TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "construtor_picks_match_target" ON "construtor_picks" ("matchId", "targetPlayerId");
CREATE INDEX IF NOT EXISTS "construtor_picks_target" ON "construtor_picks" ("targetPlayerId");
