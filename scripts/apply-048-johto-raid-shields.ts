/** Aplica a migração 048 da Raid de Johto. */
import { existsSync, readFileSync } from "node:fs"; import { resolve } from "node:path";
for (const f of [".env", ".env.local"]) { const p = resolve(process.cwd(), f); if (!existsSync(p)) continue; for (const l of readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] ??= v; } }
import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient();
(async () => { for (const sql of readFileSync("prisma/migrations-manual/048_johto_raid_shields.sql", "utf8").split(";").map((s) => s.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(sql); console.log("Migração 048 aplicada."); })().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
