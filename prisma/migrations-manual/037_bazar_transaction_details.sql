-- Registra os itens/ZC que cada lado passou numa transação do Bazar (para o
-- histórico mostrar as duas pontas, especialmente em negociações diretas).
ALTER TABLE "bazar_transactions" ADD COLUMN IF NOT EXISTS "detailsJson" JSONB;
