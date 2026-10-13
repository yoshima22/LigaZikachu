/** Aplica a migração 046 (Raid de Johto). Idempotente: npx tsx scripts/apply-046-johto-raid-teams.ts */
import { existsSync, readFileSync } from "node:fs"; import { resolve } from "node:path";
for (const f of [".env", ".env.local"]) { const p = resolve(process.cwd(), f); if (!existsSync(p)) continue; for (const l of readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] ??= v; } }
import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient();
(async () => {
  const sql = readFileSync("prisma/migrations-manual/046_johto_raid_teams.sql", "utf8").split(/\r?\n/).filter((l) => !l.trim().startsWith("--")).join("\n");
  const stmts = sql.split(";").map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await prisma.$executeRawUnsafe(s);
  console.log("Migração 046 aplicada:", stmts.length, "statements.");
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
