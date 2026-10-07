/** Cria os ShopItem dos TMs de habilidade oculta (desligados). Idempotente: não mexe em active/preço existentes. */
import { existsSync, readFileSync } from "node:fs";
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
import { ensureAbilityTmShopItems } from "../src/lib/ability-tm-shop";
import { prisma } from "../src/lib/prisma";

(async () => {
  console.log(await ensureAbilityTmShopItems(false));
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
