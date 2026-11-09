// Simulação de balanceamento do Rei do Rio (em memória, sem banco). Uso: npx tsx scripts/rei-do-rio-sim.ts [jogadores] [semanas]
import { makeSimPlayer, simulateWeek } from "../src/lib/rei-do-rio/simulate";

const n = Number(process.argv[2] ?? 12);
const weeks = Number(process.argv[3] ?? 1);
const presets = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const;
const tiers = ["FRACO", "MEDIO", "FORTE"] as const;
for (let w = 0; w < weeks; w++) {
  const players = Array.from({ length: n }, (_, i) => makeSimPlayer(w * 100 + i + 1, presets[i % 4], tiers[i % 3], i % 2 ? "PRESERVE" : "KEEP"));
  const sim = simulateWeek(players, { editionId: `sim-${w}` });
  const m = sim.metrics;
  console.log(`\n== Semana ${w + 1}: ${n} jogadores | ${m.ms}ms | campeão: ${m.champion} | erros: ${m.errors.length}`);
  console.log(`KOs/combate ${m.avgKosPerMatch.toFixed(2)} | slots esgotados/dia ${m.exhaustedSlotsPerDay.toFixed(1)} | trocas ${m.substitutions} | trocas de liderança ${m.leadershipChanges} | modificadores aplicados ${m.modifierApplications} | spread ${m.spreadStrongWeak.toFixed(0)} pts`);
  console.log("Vitórias por composição:", Object.entries(m.winsByTag).map(([k, v]) => `${k} ${(100 * v.w / v.n).toFixed(0)}%`).join(" | "));
  console.log("Pontos por postura:", Object.entries(m.pointsByRole).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 100).toFixed(0)}`).join(" | "));
}
