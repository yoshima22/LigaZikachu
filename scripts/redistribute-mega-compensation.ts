/**
 * Redistribui a compensação pós-Mega (fix-mega-growth-compensation.ts): em vez de proporcional ao ganho total
 * (que empilhava pontos no mesmo atributo), cada nível perdido vira +1 num atributo que NÃO subiu naquela subida.
 * Reconstrói a distribuição antiga (mesmo algoritmo, só entradas anteriores ao evento) e aplica a diferença.
 * Dry-run por padrão; idempotente. Uso: npx tsx scripts/redistribute-mega-compensation.ts [--apply]
 */
import { existsSync, readFileSync } from "node:fs"; import { resolve } from "node:path";
for (const f of [".env", ".env.local"]) { const p = resolve(process.cwd(), f); if (!existsSync(p)) continue; for (const l of readFileSync(p, "utf8").split(/\r?\n/)) { const m = l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] ??= v; } }
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const OLD = "Compensação de crescimento pós-Mega";
const NEW = "Redistribuição da compensação pós-Mega";
const KEYS = ["force", "agility", "charisma", "instinct", "vitality"] as const;
const COL = { force: "statForce", agility: "statAgility", charisma: "statCharisma", instinct: "statInstinct", vitality: "statVitality" } as const;
type Entry = { fromLevel: number; toLevel: number } & Record<`${typeof KEYS[number]}Gained`, number>;

function oldDist(entries: Entry[], lost: number): number[] {
  const gains = KEYS.map((k) => entries.reduce((a, e) => a + e[`${k}Gained`], 0));
  const sum = gains.reduce((a, b) => a + b, 0) || 1;
  const exact = gains.map((g) => (g / sum) * lost);
  const add = exact.map(Math.floor);
  let rest = lost - add.reduce((a, b) => a + b, 0);
  exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest-- > 0) add[i]++; });
  return add;
}

function newDist(entries: Entry[], cur: number[]): { add: number[]; clean: number; fallback: number } {
  const add = [0, 0, 0, 0, 0]; let clean = 0, fallback = 0;
  for (const e of entries) {
    const gain = KEYS.map((k) => e[`${k}Gained`]);
    for (let l = 0; l < e.toLevel - e.fromLevel; l++) {
      const min = Math.min(...gain);
      const pool = gain.map((g, i) => [g, i] as const).filter(([g]) => g === min).map(([, i]) => i);
      if (min === 0) clean++; else fallback++;
      // entre os candidatos: o que menos recebeu compensação até agora; empate → menor atributo atual
      pool.sort((a, b) => add[a] - add[b] || (cur[a] + add[a]) - (cur[b] + add[b]));
      add[pool[0]]++;
    }
  }
  return { add, clean, fallback };
}

(async () => {
  const evs = await prisma.mascotEvent.findMany({ where: { description: { startsWith: OLD } }, select: { createdAt: true, description: true, mascot: { select: { id: true, nickname: true, pokemonId: true, statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true, player: { select: { displayName: true } } } } } });
  let n = 0;
  for (const ev of evs) {
    const m = ev.mascot;
    const lost = Number(ev.description.match(/\+(\d+) pontos/)![1]);
    const done = await prisma.mascotEvent.findFirst({ where: { mascotId: m.id, description: { startsWith: NEW } }, select: { id: true } });
    if (done) { console.log("já redistribuído:", m.player.displayName, m.id); continue; }
    const entries = await prisma.mascotStatGrowthEntry.findMany({ where: { mascotId: m.id, pokemonIdBefore: m.pokemonId, recordedAt: { lt: ev.createdAt } }, orderBy: { recordedAt: "asc" } });
    const old = oldDist(entries, lost);
    const cur = [m.statForce, m.statAgility, m.statCharisma, m.statInstinct, m.statVitality];
    const nw = newDist(entries, cur);
    const total = nw.add.reduce((a, b) => a + b, 0);
    if (total !== lost) { console.log(`PULADO ${m.player.displayName} ${m.id}: níveis=${total} ≠ pontos=${lost}`); continue; }
    const delta = nw.add.map((v, i) => v - old[i]);
    console.log(`${m.player.displayName} · ${m.nickname ?? m.pokemonId} · ${lost} pts | antes [${old}] → depois [${nw.add}] | limpos ${nw.clean}, sem atributo parado ${nw.fallback} | ajuste [${delta}]`);
    n++;
    if (!APPLY) continue;
    await prisma.$transaction([
      prisma.mascot.update({ where: { id: m.id }, data: { statForce: { increment: delta[0] }, statAgility: { increment: delta[1] }, statCharisma: { increment: delta[2] }, statInstinct: { increment: delta[3] }, statVitality: { increment: delta[4] } } }),
      prisma.mascotEvent.create({ data: { mascotId: m.id, emoji: "🔧", description: `${NEW}: os ${lost} pontos agora estão em atributos que não subiram em cada nível (ajuste ${KEYS.map((k, i) => `${k} ${delta[i] >= 0 ? "+" : ""}${delta[i]}`).join(", ")}).` } }),
    ]);
  }
  console.log(`${APPLY ? "APLICADO" : "DRY-RUN"}: ${n} mascotes.`);
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
