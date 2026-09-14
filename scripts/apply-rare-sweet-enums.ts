/**
 * Aplica no banco os dois valores de enum do Doce Raro.
 *
 * Por que um script e nao `prisma migrate deploy`: o historico deste projeto
 * foi aplicado via `db push`, entao `_prisma_migrations` tem 6 linhas enquanto
 * ~27 migracoes ja estao fisicamente no banco. Rodar `migrate deploy` tentaria
 * recriar tabelas existentes, falharia na primeira e deixaria uma migracao
 * marcada como falha, travando deploys futuros.
 *
 * Os dois comandos abaixo sao idempotentes (ADD VALUE IF NOT EXISTS) e
 * aditivos: nenhuma linha existente muda e o codigo hoje em producao continua
 * valido depois deles. Rode ANTES de subir o codigo novo.
 *
 *   npx tsx scripts/apply-rare-sweet-enums.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TYPE "FoodType" ADD VALUE IF NOT EXISTS 'RARE_SWEET'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "ShopItemType" ADD VALUE IF NOT EXISTS 'MASCOT_RARE_SWEET'`);

  const food = await prisma.$queryRawUnsafe<{ v: string }[]>(
    `SELECT unnest(enum_range(NULL::"FoodType"))::text AS v`,
  );
  const shop = await prisma.$queryRawUnsafe<{ v: string }[]>(
    `SELECT unnest(enum_range(NULL::"ShopItemType"))::text AS v`,
  );
  const okFood = food.some((r) => r.v === "RARE_SWEET");
  const okShop = shop.some((r) => r.v === "MASCOT_RARE_SWEET");
  console.log(`FoodType.RARE_SWEET: ${okFood ? "ok" : "FALTANDO"}`);
  console.log(`ShopItemType.MASCOT_RARE_SWEET: ${okShop ? "ok" : "FALTANDO"}`);
  if (!okFood || !okShop) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
