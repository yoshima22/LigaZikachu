-- Marcador pessoal de desempenho do mascote (Forte/Neutro/Ruim/Péssimo)
ALTER TABLE "mascots" ADD COLUMN IF NOT EXISTS "performanceTag" TEXT NOT NULL DEFAULT 'NEUTRO';
