-- As demais tabelas do schema public já têm RLS ligado (sem policies = acesso negado a anon/authenticated).
-- O app conecta como postgres (BYPASSRLS), então nada muda para ele.
ALTER TABLE IF EXISTS "egg_pity_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "mascot_stance_unlocks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "mascot_training_journeys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "mascot_training_milestones" ENABLE ROW LEVEL SECURITY;
