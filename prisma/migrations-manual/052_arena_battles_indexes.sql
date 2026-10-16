-- Índices para aliviar o gargalo da arena_battles (full scans por falta de índice
-- nas colunas de time). Aplicados em produção com CREATE INDEX CONCURRENTLY via
-- conexão direta (DIRECT_URL). Aqui ficam idempotentes para referência/replay.
-- NOTA: CONCURRENTLY não pode rodar dentro de transação nem pelo pooler (pgbouncer);
-- rode pela conexão direta, um comando por vez.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "arena_battles_attackTeamId_type_createdAt_idx" ON "arena_battles" ("attackTeamId", "type", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "arena_battles_defenseTeamId_idx" ON "arena_battles" ("defenseTeamId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "arena_battles_status_type_idx" ON "arena_battles" ("status", "type");
