-- mascot_buffs: varredura de buffs que expiram (type + faixa de expiresAt) e checagem de buff ativo por tipo.
CREATE INDEX IF NOT EXISTS "mascot_buffs_type_expiresAt_idx" ON "mascot_buffs" ("type", "expiresAt");
-- mascot_bond_memories: histórico do refúgio filtra sourceType e ordena por createdAt (~100 ms por consulta).
CREATE INDEX IF NOT EXISTS "mascot_bond_memories_sourceType_createdAt_idx" ON "mascot_bond_memories" ("sourceType", "createdAt");
