/**
 * apply-egg-toggle.ts (execução única)
 *
 * 1) Cria a tabela egg_pokemon_toggle (idempotente).
 * 2) Faz seed: insere TODAS as formas novas (EXTRA_FORM_IDS) como disabled=true,
 *    sem sobrescrever linhas já existentes (ON CONFLICT DO NOTHING).
 *
 * Uso: npx tsx scripts/apply-egg-toggle.ts   (carrega .env.local)
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXTRA_FORM_IDS } from "../src/lib/extra-forms-data";

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

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "egg_pokemon_toggle" (
      "pokemon_id"    INTEGER NOT NULL,
      "disabled"      BOOLEAN NOT NULL DEFAULT true,
      "updated_by_id" TEXT,
      "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "egg_pokemon_toggle_pkey" PRIMARY KEY ("pokemon_id")
    );
  `);
  const values = EXTRA_FORM_IDS.map((id) => `(${id}, true)`).join(",");
  const res = await prisma.$executeRawUnsafe(
    `INSERT INTO "egg_pokemon_toggle" ("pokemon_id","disabled") VALUES ${values}
     ON CONFLICT ("pokemon_id") DO NOTHING;`,
  );
  const count = await prisma.$queryRawUnsafe<{ c: bigint }[]>(`SELECT COUNT(*)::int AS c FROM "egg_pokemon_toggle" WHERE disabled = true;`);
  console.log(`Seed aplicado. Novas inseridas nesta rodada: ${res}. Total desligadas: ${count[0].c}. (IDs no código: ${EXTRA_FORM_IDS.length})`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
