-- Desfaz 20261020_lockdown_anon_public.sql, voltando exatamente ao estado de
-- 2026-10-20 (privilégios padrão do Supabase: ALL para anon/authenticated).
BEGIN;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

ALTER TABLE public.direct_message_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mascot_occurrences DISABLE ROW LEVEL SECURITY;

COMMIT;
