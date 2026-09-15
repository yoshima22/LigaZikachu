-- Doce Raro como item concedivel pelo admin (envio em massa e perfil do jogador).
-- Aditivo: nenhuma linha existente muda.
ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'MASCOT_RARE_SWEET';
