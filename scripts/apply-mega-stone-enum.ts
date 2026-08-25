/**
 * apply-mega-stone-enum.ts (execução única)
 * 1) Adiciona os valores de enum MEGA_STONE_CUSTOM_* (idempotente).
 * 2) Cria as ShopItem das pedras custom com active=false (todas as formas mega
 *    custom entram desligadas; o admin liga cada uma no painel).
 * Uso: npx tsx scripts/apply-mega-stone-enum.ts   (carrega .env.local)
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MEGA_STONES, getMegaStoneDescription, buildMegaStoneMetadata } from "../src/lib/mega-evolution";
import { CUSTOM_MEGA_POKEMON_IDS } from "../src/lib/extra-mega-stones";

for (const f of [".env", ".env.local"]) {
  const p = resolve(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] ??= v;
  }
}

const prisma = new PrismaClient();
const customSet = new Set(CUSTOM_MEGA_POKEMON_IDS);

async function main() {
  // 1) enum values (cada ADD VALUE roda em autocommit)
  const sql = readFileSync("prisma/migrations-manual/034_mega_stone_custom_enum.sql", "utf8");
  const stmts = sql.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.startsWith("ALTER TYPE"));
  for (const stmt of stmts) await prisma.$executeRawUnsafe(stmt);
  console.log(`Enum: ${stmts.length} valores garantidos.`);

  // 2) ShopItem das pedras custom (active=false), sem sobrescrever se já existir
  let created = 0;
  for (const stone of MEGA_STONES) {
    if (!customSet.has(stone.megaPokemonId)) continue;
    const existing = await prisma.shopItem.findFirst({ where: { type: stone.type }, select: { id: true } });
    if (existing) continue;
    await prisma.shopItem.create({
      data: {
        type: stone.type,
        name: stone.stoneName,
        description: getMegaStoneDescription(stone),
        imageUrl: `/sprites/pokemon/${stone.megaPokemonId}.png`,
        rarity: "LEGENDARY",
        price: stone.price,
        active: false,
        sortOrder: 1600 + stone.megaPokemonId,
        metadata: buildMegaStoneMetadata(stone) as any,
      },
    });
    created++;
  }
  const total = await prisma.shopItem.count({ where: { type: { in: MEGA_STONES.filter((s) => customSet.has(s.megaPokemonId)).map((s) => s.type) } } });
  console.log(`ShopItem custom criadas nesta rodada: ${created}. Total de pedras custom: ${total} (esperado ${CUSTOM_MEGA_POKEMON_IDS.length}).`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
