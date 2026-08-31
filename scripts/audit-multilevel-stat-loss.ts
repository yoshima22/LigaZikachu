/** AUDITORIA (somente leitura) — pontos de status perdidos em level ups
 * multi-nivel pelo bug do arredondamento (somava N niveis e arredondava so no
 * fim). Recomputa, por evento registrado em MascotStatGrowthEntry, o total
 * CORRETO (por nivel) vs o total ANTIGO (formula buggada) e reporta o deficit.
 *
 * O total de pontos por evento e deterministico (a distribuicao por atributo tem
 * RNG, mas a SOMA nao), entao o deficit abaixo e exato para a janela rastreada.
 *
 * Nao escreve nada. Rode: npx tsx scripts/audit-multilevel-stat-loss.ts
 */
import { existsSync, readFileSync } from "fs"; import { resolve } from "path";
for (const f of [".env",".env.local"]){const p=resolve(process.cwd(),f);if(!existsSync(p))continue;for(const l of readFileSync(p,"utf8").split(/\r?\n/)){const m=l.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);if(!m)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]??=v;}}
import { PrismaClient } from "@prisma/client";
import { EVOLUTION_MAP, getMascotStatusGrowthMultiplier, getPokemonName } from "../src/lib/mascot-data";

const prisma = new PrismaClient();
const LEVEL_STAT_GAIN_MULTIPLIER = 0.55;

// rawPoints por UM nivel, conforme levelStatBonuses (sem termo constante).
function rawPerLevel(personality: string): number {
  return (
    (personality === "COMPETITIVE" ? 2 : 1) +
    1 +
    (personality === "LOYAL" ? 2 : 1) +
    1 +
    (personality === "DRAMATIC" ? 0 : 1)
  );
}
function pointsFor(raw: number, growthMult: number): number {
  return raw > 0 ? Math.max(1, Math.round(raw * LEVEL_STAT_GAIN_MULTIPLIER * growthMult)) : 0;
}

// Caminha as evolucoes nivel a nivel, igual ao motor novo, para saber a especie
// (e o multiplicador de crescimento) usada no bonus de cada nivel.
function speciesWalk(fromLevel: number, toLevel: number, before: number, after: number): number[] {
  const perLevel: number[] = [];
  let species = before;
  const allowEvo = after !== before; // se nao mudou, nao força evolucao (pode estar travada)
  for (let L = fromLevel; L < toLevel; L++) {
    const newLevel = L + 1;
    if (allowEvo && species !== after) {
      const evo = EVOLUTION_MAP.get(species);
      if (evo && newLevel >= evo.level) {
        const opts = evo.toOptions;
        species = opts ? (opts.includes(after) ? after : opts[0]) : evo.to;
      }
    }
    perLevel.push(species);
  }
  return perLevel;
}

(async () => {
  const entries = await prisma.mascotStatGrowthEntry.findMany({
    orderBy: { recordedAt: "asc" },
    include: { mascot: { select: { id: true, playerId: true, personality: true, nickname: true, pokemonId: true, player: { select: { displayName: true } } } } },
  });

  type Agg = { mascotId: string; name: string; owner: string; events: number; deficit: number; withEvo: number; uncertain: number };
  const perMascot = new Map<string, Agg>();
  let totalEntries = 0, multiEntries = 0, totalDeficit = 0, affectedEvents = 0, evoEvents = 0, negativeEvents = 0;
  let firstAt: Date | null = null, lastAt: Date | null = null;

  for (const e of entries) {
    totalEntries++;
    if (!firstAt || e.recordedAt < firstAt) firstAt = e.recordedAt;
    if (!lastAt || e.recordedAt > lastAt) lastAt = e.recordedAt;
    const N = e.toLevel - e.fromLevel;
    if (N < 2) continue; // N=1 nunca perde ponto
    multiEntries++;

    const raw = rawPerLevel(e.mascot.personality);
    // ANTIGO (buggado): usa a especie original para todo o salto, arredonda no fim.
    const oldPoints = pointsFor(raw * N, getMascotStatusGrowthMultiplier(e.pokemonIdBefore));
    // NOVO (correto): soma nivel a nivel, recalculando especie no meio do salto.
    const perLevelSpecies = speciesWalk(e.fromLevel, e.toLevel, e.pokemonIdBefore, e.pokemonIdAfter);
    let newPoints = 0;
    for (const sp of perLevelSpecies) newPoints += pointsFor(raw, getMascotStatusGrowthMultiplier(sp));

    const deficit = newPoints - oldPoints;
    const hadEvo = e.pokemonIdAfter !== e.pokemonIdBefore;
    if (hadEvo) evoEvents++;
    if (deficit < 0) negativeEvents++;

    if (deficit === 0) continue;
    affectedEvents++;

    const key = e.mascotId;
    if (!perMascot.has(key)) perMascot.set(key, {
      mascotId: key,
      name: e.mascot.nickname ?? getPokemonName(e.mascot.pokemonId),
      owner: e.mascot.player?.displayName ?? "?",
      events: 0, deficit: 0, withEvo: 0, uncertain: 0,
    });
    const agg = perMascot.get(key)!;
    agg.events++;
    agg.deficit += Math.max(0, deficit); // so soma perdas (deficit>0)
    if (hadEvo) agg.withEvo++;
    // Salto com evolucao de multiplas etapas + toOptions = reconstrucao incerta.
    if (hadEvo && perLevelSpecies[perLevelSpecies.length - 1] !== e.pokemonIdAfter) agg.uncertain++;
    totalDeficit += Math.max(0, deficit);
  }

  const rows = [...perMascot.values()].filter(a => a.deficit > 0).sort((a, b) => b.deficit - a.deficit);

  console.log("═══════════════ AUDITORIA — pontos de status perdidos (multi-nivel) ═══════════════");
  console.log(`Janela rastreada: ${firstAt?.toISOString() ?? "-"} → ${lastAt?.toISOString() ?? "-"}`);
  console.log(`Entradas de crescimento: ${totalEntries} · multi-nivel (N≥2): ${multiEntries}`);
  console.log(`Eventos com perda (deficit>0): ${affectedEvents} · com evolucao no salto: ${evoEvents} · deficit negativo (ganho a mais): ${negativeEvents}`);
  console.log(`Mascotes afetados: ${rows.length} · TOTAL de pontos a repor: ${totalDeficit}`);
  console.log("──────────────────────────────────────────────────────────────────────────────────");
  for (const r of rows) {
    console.log(`  ${String(r.deficit).padStart(3)} pt  ${r.name} (${r.owner})  · ${r.events} evento(s)${r.withEvo ? `, ${r.withEvo} c/ evolucao` : ""}${r.uncertain ? `  [${r.uncertain} incerto]` : ""}  · id=${r.mascotId}`);
  }
  if (rows.length === 0) console.log("  Nenhum mascote com perda detectada na janela rastreada.");
  console.log("──────────────────────────────────────────────────────────────────────────────────");
  console.log("Obs: eventos de multi-nivel ANTERIORES ao inicio do rastreamento nao sao audit-");
  console.log("aveis (sem registro). O total por atributo tem RNG, mas o total de PONTOS e exato.");
})().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
