// Integração do Rei do Rio com o motor Arena (habilidades). Precisa do stub de server-only fora do Next:
//   NODE_PATH=<pasta com server-only/index.js> npx tsx scripts/rei-do-rio-arena-check.ts [jogadores] [semanas]
import assert from "node:assert/strict";
import { arenaFight } from "../src/lib/rei-do-rio/fight-arena";
import { officialFight } from "../src/lib/rei-do-rio/engine";
import { makeSimPlayer, simulateWeek } from "../src/lib/rei-do-rio/simulate";
import { toLeagueMascot } from "../src/lib/league-combat";
import { autoBuild } from "../src/lib/rei-do-rio/auto-build";
import { makeBotRoster } from "../src/lib/rei-do-rio/simulate";
import { abilityOf, evaluateLineupAbilities } from "../src/lib/rei-do-rio/team";
import type { AbilityLineup } from "../src/lib/abilities/combat";

const n = Number(process.argv[2] ?? 16);
const weeks = Number(process.argv[3] ?? 4);

// 1) Uma luta: habilidades, HP inicial, limite de rodadas e mesma estrutura de resultado.
function side(key: string, owner: string) {
  const roster = makeBotRoster(key, "MEDIO", 18);
  const b = autoBuild(roster, "BALANCED", "KEEP");
  if (!b.ok) throw new Error("x");
  const snaps = b.formation.slots.map((s) => roster.find((r) => r.id === s.mascotIds[0])!);
  const mascots = snaps.map((m, i) => toLeagueMascot({ ...m, playerId: owner, diseasedAt: null }, i + 1, b.formation.slots[i].role));
  const slugs = snaps.map((m) => abilityOf(b.formation, m));
  const st = evaluateLineupAbilities(slugs);
  const lineup: AbilityLineup = {};
  mascots.forEach((m, i) => { if (slugs[i] && st[i] && st[i]!.factor > 0) lineup[m.id] = { slug: slugs[i]!, factor: st[i]!.factor }; });
  return { mascots, lineup };
}
const A = side("a", "A"), B = side("b", "B");
const hp = new Map([...A.mascots, ...B.mascots].map((m) => [m.id, m.hp]));
const half = new Map(hp); half.set(A.mascots[0].id, Math.round(A.mascots[0].hp * 0.4));
const r = arenaFight(A.mascots, B.mascots, half, "seed-1", { maxRounds: 5, abilities: { A: A.lineup, B: B.lineup } });
assert.ok(["A", "B", "DRAW"].includes(r.winner));
assert.ok(r.rounds <= 5, `limite de 5 rodadas respeitado (${r.rounds})`);
assert.ok(r.log.some((e) => e.action === "ABILITY"), "habilidades geram eventos no log");
assert.ok((r.finalHp[A.mascots[0].id] ?? 0) <= Math.round(A.mascots[0].hp * 0.4), "HP inicial persistente respeitado");
const again = arenaFight(A.mascots, B.mascots, half, "seed-1", { maxRounds: 5, abilities: { A: A.lineup, B: B.lineup } });
assert.deepEqual(again.finalHp, r.finalHp, "mesma semente = mesmo resultado");
const league = officialFight(A.mascots, B.mascots, half, "seed-1", { maxRounds: 5 });
assert.ok(Object.keys(league.finalHp).length === Object.keys(r.finalHp).length, "mesma estrutura de HP final");
console.log(`luta: vencedor ${r.winner}, ${r.rounds} rodadas, ${r.log.filter((e) => e.action === "ABILITY").length} eventos de habilidade`);

// 2) Semana inteira com Arena + habilidades: sem erros, soma consistente; balanceamento x motor da liga.
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const presets = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const, tiers = ["FRACO", "MEDIO", "FORTE"] as const;
console.log(`\n${n} jogadores, ${weeks} semanas | motor | KOs/luta | esgotados/jog/dia | fracos 21h | zerados 21h | inversões | forte% fraco% | ms/semana`);
for (const [label, fight, abilities] of [["liga (sem habilidades)", officialFight, false], ["arena sem habilidades", arenaFight, false], ["ARENA + HABILIDADES", arenaFight, true]] as const) {
  const runs = Array.from({ length: weeks }, (_, w) => {
    const players = Array.from({ length: n }, (_, i) => makeSimPlayer(w * 100 + i + 1, presets[i % 4], tiers[i % 3], 50));
    const sim = simulateWeek(players, { editionId: `chk-${w}`, fight, cfg: { abilities } });
    assert.deepEqual(sim.metrics.errors, [], `erros: ${sim.metrics.errors}`);
    assert.equal(sim.metrics.rounds, 20);
    return sim.metrics;
  });
  const fr = runs.map((m) => m.byTier["FRACO"]);
  console.log(label.padEnd(24), avg(runs.map((m) => m.avgKosPerMatch)).toFixed(2), avg(runs.map((m) => m.exhaustedSlotsPerDay)).toFixed(2), avg(fr.map((t) => t.active[4])).toFixed(1), `${avg(runs.map((m) => m.emptyPctBySlot[4])).toFixed(1)}%`, avg(runs.map((m) => m.inversions)).toFixed(1), `${avg(runs.map((m) => m.strongWinPct)).toFixed(0)}% ${avg(runs.map((m) => m.weakWinPct)).toFixed(0)}%`, avg(runs.map((m) => m.ms)).toFixed(0));
}
console.log("OK");
