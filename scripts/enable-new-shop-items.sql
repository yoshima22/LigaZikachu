-- ============================================================
-- enable-new-shop-items.sql
-- Execute no Supabase Dashboard → SQL Editor
-- ============================================================
-- 1. Habilita os 6 novos itens da loja
-- 2. Corrige descrições para o funcionamento real
-- 3. Remove todos esses itens do inventário de todos os jogadores
--    (inclusive equipados)
-- 4. Remove os MascotBuff criados por esses itens
-- ============================================================

BEGIN;

-- ── 1. Habilitar itens + corrigir descrições ─────────────────

UPDATE shop_items SET
  active = true,
  description = CASE type
    WHEN 'LUCKY_EGG'       THEN '+20% EXP na próxima expedição de treinamento. Recarrega em 24h por mascote.'
    WHEN 'WEAKNESS_POLICY' THEN 'Protege o Pokémon de ataques oportunistas enquanto ferido. Consumido ao bloquear um ataque.'
    WHEN 'PICNIC_BASKET'   THEN 'Toda a equipe equipada recebe +50% EXP e +5 felicidade por interação durante 2 horas.'
    WHEN 'VACATION_TICKET' THEN 'Envia o Pokémon de férias por 7 dias. Volta revigorado com +30 felicidade e +500 EXP.'
    WHEN 'XP_SHARE'        THEN 'Equipe em um Pokémon. Quando outra expedição de treinamento terminar, ele recebe metade do EXP. Permanente até remover. Limite: 1 por jogador.'
    WHEN 'RAINBOW_FEATHER' THEN 'Reseta todos os atributos do Pokémon e o coloca de volta no nível 1. Irreversível.'
    ELSE description
  END
WHERE type IN ('LUCKY_EGG', 'WEAKNESS_POLICY', 'PICNIC_BASKET', 'VACATION_TICKET', 'XP_SHARE', 'RAINBOW_FEATHER');

-- ── 2. Remover do inventário de todos os jogadores ───────────

DELETE FROM player_inventory
WHERE item_id IN (
  SELECT id FROM shop_items
  WHERE type IN ('LUCKY_EGG', 'WEAKNESS_POLICY', 'PICNIC_BASKET', 'VACATION_TICKET', 'XP_SHARE', 'RAINBOW_FEATHER')
);

-- ── 3. Remover MascotBuff desses itens de todos os mascotes ──

DELETE FROM mascot_buffs
WHERE type IN ('LUCKY_EGG', 'WEAKNESS_POLICY', 'PICNIC_BASKET', 'XP_SHARE');
-- Nota: VACATION_TICKET cria MascotExpedition (não buff), RAINBOW_FEATHER não cria buff.

COMMIT;

-- ── Verificação ────────────────────────────────────────────────
-- Execute após o COMMIT para confirmar:
SELECT type, name, active, description
FROM shop_items
WHERE type IN ('LUCKY_EGG', 'WEAKNESS_POLICY', 'PICNIC_BASKET', 'VACATION_TICKET', 'XP_SHARE', 'RAINBOW_FEATHER')
ORDER BY sort_order;
