/**
 * sync-official-mega-toggles.ts (execução única, idempotente)
 * As megas oficiais existiam antes do painel e seguem ativas no jogo (pedras na
 * loja, mascotes e times do Draft), mas estavam "desligadas" no painel. Marca
 * como ligadas (disabled=false) para o painel refletir o jogo. Não remove nada.
 * Uso: npx tsx scripts/sync-official-mega-toggles.ts [--apply]   (sem --apply só mostra)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
for (const f of [".env", ".env.local"]) {
  const p = resolve(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const l of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] ??= v;
  }
}
import { PrismaClient } from "@prisma/client";
import { MEGA_STONES_OFFICIAL } from "../src/lib/mega-evolution";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

(async () => {
  const ids = MEGA_STONES_OFFICIAL.map((s) => s.megaPokemonId);
  const rows = await prisma.eggPokemonToggle.findMany({ where: { pokemonId: { in: ids }, disabled: true } });
  console.log(`Megas oficiais desligadas no painel: ${rows.length}`);
  if (!apply) { console.log("Dry-run. Use --apply para ligar."); return; }
  const backup = process.argv.find((a) => a.startsWith("--backup="))?.slice(9);
  if (backup) writeFileSync(backup, JSON.stringify(rows, null, 2));
  const res = await prisma.eggPokemonToggle.updateMany({ where: { pokemonId: { in: rows.map((r) => r.pokemonId) }, disabled: true }, data: { disabled: false } });
  console.log(`Ligadas: ${res.count}`);
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
