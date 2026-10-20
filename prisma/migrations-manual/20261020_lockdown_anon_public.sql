-- Fecha o acesso direto da chave pública (anon/authenticated) ao schema public.
-- Verificado em 2026-10-20:
--  - o app usa Prisma como `postgres` (rolbypassrls = true, dono das 200 tabelas):
--    nada do servidor muda;
--  - nenhum código usa PostgREST (`supabase.from(...)`/rpc) — a chave anon só
--    abre canais de Realtime Broadcast, que não dependem de tabela;
--  - Storage vive no schema `storage` e não é afetado.
-- Antes: anon tinha SELECT/INSERT/UPDATE/DELETE em todas as tabelas via
-- GET/POST /rest/v1/<tabela>, e 2 tabelas estavam até sem RLS.
-- Reversão: 20261020_lockdown_anon_public.rollback.sql
BEGIN;

ALTER TABLE public.direct_message_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mascot_occurrences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Tabelas novas criadas pelo Prisma (dono postgres) nascem sem esse acesso.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

COMMIT;
