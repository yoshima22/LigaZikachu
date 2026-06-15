-- Otimiza a tela de mascotes, que sempre busca os eventos mais recentes por mascote.
-- Rode no SQL Editor do Supabase. CONCURRENTLY evita travar escrita por muito tempo.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "mascot_events_mascot_created_desc_idx"
ON "mascot_events" ("mascotId", "createdAt" DESC);
