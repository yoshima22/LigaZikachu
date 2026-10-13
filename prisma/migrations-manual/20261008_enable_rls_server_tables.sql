-- Server-only tables verified on 2026-10-08. No client/realtime policies needed.
-- Keep Prisma's privileged backend access; deny direct anon/authenticated access.
ALTER TABLE public.construtor_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construtor_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construtor_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_banner_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_pity_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_pity_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_pulls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mascot_bond_pair_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mascot_social_influences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_code_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_code_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_mascots ENABLE ROW LEVEL SECURITY;
