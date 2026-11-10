// Mede "time zerado" por rodada do dia e compara remédios. Uso: npx tsx scripts/rei-do-rio-snowball.ts [jogadores] [semanas]
import { makeSimPlayer, simulateWeek } from "../src/lib/rei-do-rio/simulate";

const n = Number(process.argv[2] ?? 16);
const weeks = Number(process.argv[3] ?? 4);
const presets = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const;
const tiers = ["FRACO", "MEDIO", "FORTE"] as const;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const f1 = (x: number) => x.toFixed(1);

console.log(`\n=== A) Por rodada do dia (09 12 15 18 21): mascotes ativos por equipe e % de equipes SEM mascotes ===`);
const scenarios: Record<string, Record<string, unknown>> = {
  "Padrão atual": {},
  "Pareamento por saúde (peso 2)": { healthPairing: 2 },
  "Pareamento por saúde (peso 5)": { healthPairing: 5 },
  "HP x4": { hpMultiplier: 4 },
  "Limite 5 rodadas": { maxRounds: 5 },
  "HP x4 + limite 5": { hpMultiplier: 4, maxRounds: 5 },
};
for (const [name, cfg] of Object.entries(scenarios)) {
  const runs = Array.from({ length: weeks }, (_, w) => {
    const players = Array.from({ length: n }, (_, i) => makeSimPlayer(w * 100 + i + 1, presets[i % 4], tiers[i % 3], Number(process.argv[4] ?? 0)));
    return simulateWeek(players, { editionId: `sn-${w}`, cfg }).metrics;
  });
  const act = [0, 1, 2, 3, 4].map((k) => f1(avg(runs.map((m) => m.activeBySlot[k]))));
  const emp = [0, 1, 2, 3, 4].map((k) => f1(avg(runs.map((m) => m.emptyPctBySlot[k]))) + "%");
  const fr = runs.map((m) => m.byTier["FRACO"]);
  console.log("   └ times FRACOS  ativos:", [0, 1, 2, 3, 4].map((k) => f1(avg(fr.map((t) => t.active[k])))).join(" "), "| zerados:", [0, 1, 2, 3, 4].map((k) => f1(avg(fr.map((t) => t.emptyPct[k]))) + "%").join(" "));
  console.log(name.padEnd(34), "ativos:", act.join(" "), "| zerados:", emp.join(" "), `| KOs ${f1(avg(runs.map((m) => m.avgKosPerMatch)))} inv ${f1(avg(runs.map((m) => m.inversions)))}`);
}

console.log(`\n=== B) Limiar de troca (todos os slots igual), mesma força/composição, ${weeks * 3} semanas ===`);
const swaps = [0, 30, 50, 70];
const acc: Record<string, { pts: number[]; w: number; n: number }> = {};
for (let w = 0; w < weeks * 3; w++) {
  const players = Array.from({ length: 16 }, (_, i) => makeSimPlayer(w * 100 + i + 1, presets[i % 4], "MEDIO", swaps[i % 4]));
  const sim = simulateWeek(players, { editionId: `sw-${w}` });
  for (const r of sim.standings) {
    const swap = swaps[(Number(r.pid.split(":")[1]) - 1 - w * 100) % 4];
    const e = (acc[`${swap}%`] ??= { pts: [], w: 0, n: 0 });
    e.pts.push(r.score / 100); e.w += r.wins; e.n += r.wins + r.losses + r.draws;
  }
}
for (const [k, e] of Object.entries(acc)) console.log(`troca em ${k.padEnd(4)} pontos médios ${f1(avg(e.pts))}  vitórias ${f1((100 * e.w) / e.n)}%`);
