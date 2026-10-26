/**
 * Compensa os pontos que mascotes Mega de linhagem lendária/pseudo/paradoxo deixaram de ganhar
 * por nível depois da Mega Evolução (o multiplicador de crescimento era perdido ao trocar de pokemonId).
 * Base: MascotStatGrowthEntry com pokemonIdBefore = id da Mega (registro existe desde 2026-08-28).
 * Dry-run por padrão; idempotente (marca um MascotEvent). Uso: npx tsx scripts/fix-mega-growth-compensation.ts [--apply]
 */
import { existsSync, readFileSync } from "node:fs"; import { resolve } from "node:path";
for (const f of [".env", ".env.local"]) { const p = resolve(process.cwd(), f); if (!existsSync(p)) continue; for (const l of readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] ??= v; } }
import { PrismaClient } from "@prisma/client";
import { getMascotStatusGrowthMultiplier } from "../src/lib/mascot-data";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const MARK = "Compensação de crescimento pós-Mega";
const raw = (p: string) => (p === "COMPETITIVE" ? 2 : 1) + 1 + (p === "LOYAL" ? 2 : 1) + 1 + (p === "DRAMATIC" ? 0 : 1);
const KEYS = ["force", "agility", "charisma", "instinct", "vitality"] as const;

(async () => {
  const megas = await prisma.mascot.findMany({
    where: { megaEvolvedAt: { not: null }, megaEvolvedFromPokemonId: { not: null } },
    select: { id: true, nickname: true, pokemonId: true, megaEvolvedFromPokemonId: true, personality: true, player: { select: { displayName: true } } },
  });
  let total = 0, count = 0;
  for (const m of megas) {
    const mult = getMascotStatusGrowthMultiplier(m.megaEvolvedFromPokemonId);
    if (mult <= 1) continue;
    const r = raw(m.personality);
    const diff = Math.max(1, Math.round(r * 0.55 * mult)) - Math.max(1, Math.round(r * 0.55));
    if (diff <= 0) continue;
    const entries = await prisma.mascotStatGrowthEntry.findMany({ where: { mascotId: m.id, pokemonIdBefore: m.pokemonId } });
    const levels = entries.reduce((a, e) => a + (e.toLevel - e.fromLevel), 0);
    const lost = levels * diff;
    if (lost <= 0) continue;
    const done = await prisma.mascotEvent.findFirst({ where: { mascotId: m.id, description: { startsWith: MARK } }, select: { id: true } });
    if (done) { console.log("já compensado:", m.player.displayName, m.id); continue; }
    // distribui proporcionalmente ao que o mascote realmente ganhou (respeita personalidade/afinidade)
    const gains = KEYS.map((k) => entries.reduce((a, e) => a + (e[`${k}Gained` as const] as number), 0));
    const sum = gains.reduce((a, b) => a + b, 0) || 1;
    const exact = gains.map((g) => (g / sum) * lost);
    const add = exact.map(Math.floor);
    let rest = lost - add.reduce((a, b) => a + b, 0);
    exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest-- > 0) add[i]++; });
    console.log(`${m.player.displayName} · ${m.nickname ?? m.pokemonId} · ${levels} níveis x ${diff} = +${lost} pts [${add.join("/")}]`);
    total += lost; count++;
    if (!APPLY) continue;
    await prisma.$transaction([
      prisma.mascot.update({ where: { id: m.id }, data: { statForce: { increment: add[0] }, statAgility: { increment: add[1] }, statCharisma: { increment: add[2] }, statInstinct: { increment: add[3] }, statVitality: { increment: add[4] } } }),
      prisma.mascotEvent.create({ data: { mascotId: m.id, emoji: "🔧", description: `${MARK}: +${lost} pontos de atributo (${levels} níveis após a Mega Evolução sem o bônus de crescimento).` } }),
    ]);
  }
  console.log(`${APPLY ? "APLICADO" : "DRY-RUN"}: ${count} mascotes, +${total} pontos.`);
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
