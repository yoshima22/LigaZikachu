/** REPOSICAO dos pontos de status perdidos em level ups multi-nivel (bug do
 * arredondamento). Recomputa o deficit por mascote (mesma logica da auditoria) e
 * repoe os pontos distribuindo pelos PESOS DE CRESCIMENTO (afinidade da
 * personalidade + softWeight sobre os stats atuais), de forma DETERMINISTICA
 * (sem RNG). So repoe perdas (deficit>0); nunca tira de quem ganhou a mais.
 *
 * Simulacao por padrao. Aplique com: npx tsx scripts/refund-multilevel-stat-loss.ts --apply
 */
import { existsSync, readFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient } from "@prisma/client";
import { EVOLUTION_MAP, getMascotStatusGrowthMultiplier, getPokemonName } from "../src/lib/mascot-data";
import { PERSONALITY_AFFINITY } from "../src/lib/personality-design";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const LEVEL_STAT_GAIN_MULTIPLIER = 0.55;
const GROWTH_WEIGHT_EXPONENT = 0.85;

type StatKey = "statForce" | "statAgility" | "statCharisma" | "statInstinct" | "statVitality";
const STAT_KEYS: StatKey[] = ["statForce","statAgility","statCharisma","statInstinct","statVitality"];
const AFF_TO_STAT: Record<string, StatKey> = { force:"statForce", agility:"statAgility", instinct:"statInstinct", vitality:"statVitality", charisma:"statCharisma" };

const softWeight = (s: number) => Math.pow(Math.max(0, s), GROWTH_WEIGHT_EXPONENT);
const rawPerLevel = (p: string) =>
  (p === "COMPETITIVE" ? 2 : 1) + 1 + (p === "LOYAL" ? 2 : 1) + 1 + (p === "DRAMATIC" ? 0 : 1);
const pointsFor = (raw: number, g: number) => (raw > 0 ? Math.max(1, Math.round(raw * LEVEL_STAT_GAIN_MULTIPLIER * g)) : 0);

function speciesWalk(fromLevel: number, toLevel: number, before: number, after: number): number[] {
  const out: number[] = []; let sp = before; const allow = after !== before;
  for (let L = fromLevel; L < toLevel; L++) {
    const nl = L + 1;
    if (allow && sp !== after) { const evo = EVOLUTION_MAP.get(sp); if (evo && nl >= evo.level) { const o = evo.toOptions; sp = o ? (o.includes(after) ? after : o[0]) : evo.to; } }
    out.push(sp);
  }
  return out;
}

// Distribuicao deterministica por pesos (versao sem RNG de levelStatBonuses):
// softWeight + vies de afinidade; largest-remainder para as sobras.
function distributeByWeights(total: number, stats: Record<StatKey, number>, personality: string): Record<StatKey, number> {
  const weights: Record<StatKey, number> = {
    statForce: softWeight(stats.statForce), statAgility: softWeight(stats.statAgility),
    statCharisma: softWeight(stats.statCharisma), statInstinct: softWeight(stats.statInstinct),
    statVitality: softWeight(stats.statVitality),
  };
  const aff = PERSONALITY_AFFINITY[personality];
  if (aff?.veryUseful) weights[AFF_TO_STAT[aff.veryUseful]] *= 1.10;
  if (aff?.useful) weights[AFF_TO_STAT[aff.useful]] *= 1.08;
  if (personality === "DRAMATIC") weights.statVitality *= 0.85;

  const wt = STAT_KEYS.reduce((s, k) => s + Math.max(1, weights[k]), 0);
  const exact = STAT_KEYS.map((k) => { const v = (Math.max(1, weights[k]) / wt) * total; return { k, floor: Math.floor(v), rem: v - Math.floor(v) }; });
  const dist = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>;
  exact.forEach(({ k, floor }) => { dist[k] += floor; });
  let left = total - STAT_KEYS.reduce((s, k) => s + dist[k], 0);
  exact.sort((a, b) => b.rem - a.rem).forEach(({ k }) => { if (left <= 0) return; dist[k]++; left--; });
  return dist;
}

(async () => {
  const entries = await prisma.mascotStatGrowthEntry.findMany({
    orderBy: { recordedAt: "asc" },
    include: { mascot: { select: { id: true, personality: true, nickname: true, pokemonId: true, player: { select: { displayName: true } } } } },
  });

  const deficitByMascot = new Map<string, { deficit: number; events: number; mascot: (typeof entries)[number]["mascot"] }>();
  for (const e of entries) {
    const N = e.toLevel - e.fromLevel; if (N < 2) continue;
    const raw = rawPerLevel(e.mascot.personality);
    const oldPts = pointsFor(raw * N, getMascotStatusGrowthMultiplier(e.pokemonIdBefore));
    let newPts = 0; for (const sp of speciesWalk(e.fromLevel, e.toLevel, e.pokemonIdBefore, e.pokemonIdAfter)) newPts += pointsFor(raw, getMascotStatusGrowthMultiplier(sp));
    const d = newPts - oldPts; if (d <= 0) continue;
    const cur = deficitByMascot.get(e.mascotId) ?? { deficit: 0, events: 0, mascot: e.mascot };
    cur.deficit += d; cur.events += 1; deficitByMascot.set(e.mascotId, cur);
  }

  const targets = [...deficitByMascot.entries()].filter(([, v]) => v.deficit > 0);
  console.log(`═══ REPOSICAO ${APPLY ? "(APLICANDO)" : "(SIMULACAO — use --apply)"} ═══`);
  console.log(`Mascotes: ${targets.length} · Total de pontos a repor: ${targets.reduce((s, [, v]) => s + v.deficit, 0)}`);
  console.log("──────────────────────────────────────────────────────────────");

  let applied = 0, skipped = 0;
  for (const [mascotId, info] of targets.sort((a, b) => b[1].deficit - a[1].deficit)) {
    const m = await prisma.mascot.findUnique({ where: { id: mascotId }, select: { statForce: true, statAgility: true, statCharisma: true, statInstinct: true, statVitality: true, level: true, pokemonId: true, personality: true } });
    if (!m) continue;
    // Idempotencia: desconta o que ja foi reposto por passagens anteriores.
    const prior = await prisma.mascotStatGrowthEntry.findMany({ where: { mascotId, source: "REFUND_MULTILEVEL_BUG" }, select: { forceGained: true, agilityGained: true, charismaGained: true, instinctGained: true, vitalityGained: true } });
    const alreadyRefunded = prior.reduce((s, p) => s + p.forceGained + p.agilityGained + p.charismaGained + p.instinctGained + p.vitalityGained, 0);
    const remainder = info.deficit - alreadyRefunded;
    const name = info.mascot.nickname ?? getPokemonName(info.mascot.pokemonId);
    if (remainder <= 0) { skipped++; console.log(`  =0pt   ${name} (${info.mascot.player?.displayName ?? "?"})  já reposto (${alreadyRefunded}/${info.deficit})`); continue; }
    const stats: Record<StatKey, number> = { statForce: m.statForce, statAgility: m.statAgility, statCharisma: m.statCharisma, statInstinct: m.statInstinct, statVitality: m.statVitality };
    const add = distributeByWeights(remainder, stats, m.personality);
    const parts = STAT_KEYS.filter(k => add[k] > 0).map(k => `${k.replace("stat","")}+${add[k]}`).join(" ");
    console.log(`  +${remainder}pt  ${name} (${info.mascot.player?.displayName ?? "?"})  →  ${parts}  [${info.events} ev]${alreadyRefunded ? ` (+${alreadyRefunded} antes)` : ""}`);

    if (APPLY) {
      await prisma.$transaction(async (tx) => {
        await tx.mascot.update({ where: { id: mascotId }, data: {
          statForce: { increment: add.statForce }, statAgility: { increment: add.statAgility },
          statCharisma: { increment: add.statCharisma }, statInstinct: { increment: add.statInstinct },
          statVitality: { increment: add.statVitality },
        } });
        await tx.mascotStatGrowthEntry.create({ data: {
          mascotId, fromLevel: m.level, toLevel: m.level,
          forceGained: add.statForce, agilityGained: add.statAgility, charismaGained: add.statCharisma, instinctGained: add.statInstinct, vitalityGained: add.statVitality,
          forceAfter: stats.statForce + add.statForce, agilityAfter: stats.statAgility + add.statAgility, charismaAfter: stats.statCharisma + add.statCharisma, instinctAfter: stats.statInstinct + add.statInstinct, vitalityAfter: stats.statVitality + add.statVitality,
          pokemonIdBefore: m.pokemonId, pokemonIdAfter: m.pokemonId,
          source: "REFUND_MULTILEVEL_BUG",
          metadata: { reason: "reposicao de pontos perdidos no bug de arredondamento multi-nivel", totalRefunded: remainder, cumulativeDeficit: info.deficit, events: info.events },
        } });
      });
      applied += remainder;
    }
  }
  console.log("──────────────────────────────────────────────────────────────");
  console.log(APPLY ? `>>> APLICADO: ${applied} pontos repostos em ${targets.length} mascotes.` : ">>> SIMULACAO. Reveja e rode com --apply para aplicar.");
})().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
