-- DELETE FROM users varre player_activity_logs (FK actorUserId, ON DELETE SET NULL) sem índice: ~6 s por usuário apagado.
CREATE INDEX IF NOT EXISTS "player_activity_logs_actorUserId_idx" ON "player_activity_logs" ("actorUserId");
