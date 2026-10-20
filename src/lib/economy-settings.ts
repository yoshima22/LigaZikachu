import type { EconomySettings, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Lê a configuração de economia (linha singleton) e só a cria se ainda não
 * existir. Antes, cada visita ao bazar/loja e cada compra fazia
 * `upsert(..., update: {})` — que é uma ESCRITA e trava a linha singleton, então
 * todo mundo disputava a mesma linha justamente no pico (reset do bazar).
 */
export async function getEconomySettings(db: Db = prisma): Promise<EconomySettings> {
  const existing = await db.economySettings.findUnique({ where: { id: "singleton" } });
  return existing ?? db.economySettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}
