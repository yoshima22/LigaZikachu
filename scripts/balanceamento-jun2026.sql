-- ============================================================
-- LIGA ZIKACHU — Balanceamento Jun/2026
-- Rodar no Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- PASSO 1: AUDITORIA — Log de jogadores com os itens removidos
-- (Rode primeiro para ter o log antes de deletar)
-- ============================================================
SELECT
  p."displayName"                         AS jogador,
  si.type                                 AS item,
  si.name                                 AS nome_item,
  pi.quantity                             AS quantidade,
  pi.equipped                             AS equipado
FROM player_inventory pi
JOIN players p  ON p.id  = pi."playerId"
JOIN shop_items si ON si.id = pi."itemId"
WHERE si.type IN (
  'LUCKY_EGG','WEAKNESS_POLICY','PICNIC_BASKET',
  'VACATION_TICKET','XP_SHARE','RAINBOW_FEATHER'
)
ORDER BY si.type, p."displayName";


-- ============================================================
-- PASSO 2: REMOVER itens dos jogadores
-- (Desequipa e deleta do inventário)
-- ============================================================

-- Remover MascotBuff ativos desses itens
DELETE FROM mascot_buffs
WHERE type IN ('LUCKY_EGG','WEAKNESS_POLICY','PICNIC_BASKET','XP_SHARE');

-- Remover do inventário
DELETE FROM player_inventory
WHERE "itemId" IN (
  SELECT id FROM shop_items
  WHERE type IN (
    'LUCKY_EGG','WEAKNESS_POLICY','PICNIC_BASKET',
    'VACATION_TICKET','XP_SHARE','RAINBOW_FEATHER'
  )
);


-- ============================================================
-- PASSO 3: ATUALIZAR PREÇOS E DESCRIÇÕES dos itens existentes
-- ============================================================

-- Ovos de gerações — tornar inativos (substituídos por Comum/Raro/Especial com escolha de geração)
UPDATE shop_items SET active = false
WHERE type IN (
  'EGG_GEN1','EGG_GEN2','EGG_GEN3','EGG_GEN4','EGG_GEN5',
  'EGG_GEN6','EGG_GEN7','EGG_GEN8','EGG_GEN9','EGG_GEN6PLUS'
);

-- Ovo Comum
UPDATE shop_items SET
  price = 600,
  description = 'Choca rapidamente e traz Pokémon comuns, bases e alguns achados melhores. Escolha a geração antes de incubar. É a principal forma de expandir sua coleção.'
WHERE type = 'EGG_COMMON';

-- Ovo Raro
UPDATE shop_items SET
  price = 3400,
  description = 'Contém Pokémon mais desejados, favoritos, iniciais e linhas fortes. Escolha a geração antes de incubar. Mais difícil de conseguir que o Ovo Comum, mas com resultados melhores.'
WHERE type = 'EGG_RARE';

-- Ovo Especial
UPDATE shop_items SET
  price = 6750,
  description = 'Um ovo premium com chance maior de Pokémon muito cobiçados, raros, fósseis, pseudo-lendários e espécies especiais. Escolha a geração antes de incubar.'
WHERE type = 'EGG_SPECIAL';

-- Comida de Mascote
UPDATE shop_items SET
  price = 20,
  description = 'Alimenta o mascote e melhora sua rotina de cuidado. Ideal para manter a fome controlada e evitar penalidades em treino e expedições.'
WHERE type = 'MASCOT_FOOD';

-- Doce de Mascote
UPDATE shop_items SET
  price = 100,
  description = 'Aumenta felicidade e concede um pequeno ganho de EXP. Use quando quiser recuperar o ânimo do mascote.'
WHERE type = 'MASCOT_SWEET';

-- Vitamina Chocante (MASCOT_BUFF_EXP)
UPDATE shop_items SET
  price = 750,
  description = 'Dobra o EXP ganho em partidas da Arena e interações por 2 horas. Use antes de combates, treinos ou sessões de cuidado. Não acumula com outro buff de EXP.'
WHERE type = 'MASCOT_BUFF_EXP';

-- Proteína Zika (MASCOT_BUFF_STAT)
UPDATE shop_items SET
  price = 4500,
  description = 'Aumenta permanentemente todos os status do mascote em +2. Cada Pokémon pode usar no máximo 3 Proteínas Zika.'
WHERE type = 'MASCOT_BUFF_STAT';

-- Bala de Mel (MASCOT_BUFF_HAPPY)
UPDATE shop_items SET
  price = 300,
  description = 'Leva a felicidade do mascote para 100 e muda o humor para Feliz por 3 horas. Excelente para preparar o mascote antes de treino ou expedição.'
WHERE type = 'MASCOT_BUFF_HAPPY';

-- Amuleto da Sorte (MASCOT_BUFF_LUCK)
UPDATE shop_items SET
  price = 1200,
  description = 'Aumenta a chance de recompensas raras em expedições por 6 horas. O bônus respeita os limites máximos de drop.'
WHERE type = 'MASCOT_BUFF_LUCK';

-- Água Fresca (MASCOT_BUFF_MOOD)
UPDATE shop_items SET
  price = 150,
  description = 'Remove imediatamente humores negativos como Bravo, Cansado ou Carente. O mascote volta para o estado Neutro.'
WHERE type = 'MASCOT_BUFF_MOOD';

-- Ovo da Sorte (LUCKY_EGG)
UPDATE shop_items SET
  active = true,
  price = 1600,
  description = 'Aumenta em 20% o EXP ganho no próximo treinamento do mascote. Recarrega em 24h por mascote.'
WHERE type = 'LUCKY_EGG';

-- Política de Fraqueza (WEAKNESS_POLICY)
UPDATE shop_items SET
  active = true,
  price = 600,
  description = 'Item de proteção situacional. Ajuda o mascote a lidar melhor com desvantagens em conflitos, Arena ou eventos.'
WHERE type = 'WEAKNESS_POLICY';

-- Cesta de Piquenique Chocante (PICNIC_BASKET)
UPDATE shop_items SET
  active = true,
  price = 3500,
  description = 'Os 6 Pokémon favoritos da sua equipe ganham +40% EXP e +5 felicidade em interações durante 2 horas. Não inclui combate ou expedição.'
WHERE type = 'PICNIC_BASKET';

-- Ticket de Férias do Prof. Carvalho (VACATION_TICKET)
UPDATE shop_items SET
  active = true,
  price = 2000,
  name  = 'Ticket de Férias do Prof. Carvalho',
  description = 'Envia o Pokémon de férias por 7 dias com o Professor Carvalho. Ao retornar: felicidade máxima, empanturrado, +2.000 EXP e 30% de chance de trazer um Ovo Comum. Não pode ser cancelado após ativado.'
WHERE type = 'VACATION_TICKET';

-- Compartilhador de XP (XP_SHARE)
UPDATE shop_items SET
  active = true,
  price = 8000,
  description = 'Equipe em um Pokémon. Quando outra expedição de treinamento terminar, ele recebe metade do EXP. Permanente até remover. Limite: 1 por jogador.'
WHERE type = 'XP_SHARE';

-- Pena Arco-Íris (RAINBOW_FEATHER)
UPDATE shop_items SET
  active = true,
  price = 10000,
  description = 'Item raro de reajuste profundo. Reseta todos os atributos do Pokémon e o coloca de volta no nível 1. Irreversível.'
WHERE type = 'RAINBOW_FEATHER';


-- ============================================================
-- PASSO 4: CRIAR itens novos que ainda não existem
-- (Apenas se não existirem — usa DO $$ para verificar)
-- ============================================================

-- Ovo de Laboratório
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE type = 'EGG_LAB') THEN
    INSERT INTO shop_items (
      id, type, name, description, rarity, price, active,
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(),
      'EGG_LAB',
      'Ovo de Laboratório',
      'Gera 3 opções de Pokémon com qualidade equivalente a um Ovo Raro. Você escolhe apenas 1 para ficar. Escolha a geração antes de incubar.',
      'EPIC',
      12000,
      true,
      now(), now()
    );
    RAISE NOTICE 'Ovo de Laboratório criado.';
  ELSE
    UPDATE shop_items SET
      price = 12000,
      active = true,
      description = 'Gera 3 opções de Pokémon com qualidade equivalente a um Ovo Raro. Você escolhe apenas 1 para ficar. Escolha a geração antes de incubar.'
    WHERE type = 'EGG_LAB';
    RAISE NOTICE 'Ovo de Laboratório já existe — preço/descrição atualizado.';
  END IF;
END $$;

-- Ovo de Evento
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM shop_items WHERE type = 'EGG_EVENT') THEN
    INSERT INTO shop_items (
      id, type, name, description, rarity, price, active,
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(),
      'EGG_EVENT',
      'Ovo de Evento',
      'Ovo especial de evento. Não é vendido no ZikaShop. Pode trazer apenas Pokémon incomuns ou melhores e possui chance de gerar mascotes com bônus de status.',
      'LEGENDARY',
      0,
      false, -- não aparece na loja; distribuído por admin/evento
      now(), now()
    );
    RAISE NOTICE 'Ovo de Evento criado.';
  ELSE
    RAISE NOTICE 'Ovo de Evento já existe.';
  END IF;
END $$;


-- ============================================================
-- PASSO 5: VERIFICAÇÃO FINAL
-- ============================================================
SELECT type, name, price, active, LEFT(description, 60) AS desc_preview
FROM shop_items
WHERE type IN (
  'EGG_COMMON','EGG_RARE','EGG_SPECIAL','EGG_LAB','EGG_EVENT',
  'MASCOT_FOOD','MASCOT_SWEET',
  'MASCOT_BUFF_EXP','MASCOT_BUFF_STAT','MASCOT_BUFF_HAPPY','MASCOT_BUFF_LUCK','MASCOT_BUFF_MOOD',
  'LUCKY_EGG','WEAKNESS_POLICY','PICNIC_BASKET','VACATION_TICKET','XP_SHARE','RAINBOW_FEATHER'
)
ORDER BY type;
