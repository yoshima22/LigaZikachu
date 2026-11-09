// Compara alternativas de balanceamento (em memória). Uso: npx tsx scripts/rei-do-rio-scenarios.ts [jogadores] [sementes]
import { makeSimPlayer, simulateWeek } from "../src/lib/rei-do-rio/simulate";

const n = Number(process.argv[2] ?? 16);
const seeds = Number(process.argv[3] ?? 4);
const presets = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const;
const tiers = ["FRACO", "MEDIO", "FORTE"] as const;

const scenarios: Record<string, Record<string, unknown>> = {
  "Base (atual)": {},
  "Limite 6 rodadas": { maxRounds: 6 },
  "HP x2 + limite 6": { hpMultiplier: 2, maxRounds: 6 },
  "HP x3 + limite 6": { hpMultiplier: 3, maxRounds: 6 },
  "HP x3 + limite 8": { hpMultiplier: 3, maxRounds: 8 },
  "HP x4 + limite 8": { hpMultiplier: 4, maxRounds: 8 },
  "HP x3 + limite 8 + Vit. 30": { hpMultiplier: 3, maxRounds: 8, budget: { win: 30 } },
  "HP x3 + limite 8 + Vit. 30 + 25pp": { hpMultiplier: 3, maxRounds: 8, budget: { win: 30 }, swapHpGapPct: 25 },
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(`${n} jogadores, ${seeds} semanas por cenário\n`);
console.log("cenário".padEnd(34), "KOs/lut", "esgot/jog/dia", "corr pos×vit", "invers.", "forte%", "fraco%", "lider×");
for (const [name, cfg] of Object.entries(scenarios)) {
  const ms = Array.from({ length: seeds }, (_, w) => {
    const players = Array.from({ length: n }, (_, i) => makeSimPlayer(w * 100 + i + 1, presets[i % 4], tiers[i % 3], i % 2 ? "PRESERVE" : "KEEP"));
    return simulateWeek(players, { editionId: `sc-${w}`, cfg }).metrics;
  });
  const f = (k: (m: (typeof ms)[number]) => number, d = 2) => avg(ms.map(k)).toFixed(d).padEnd(9);
  console.log(name.padEnd(34), f((m) => m.avgKosPerMatch), f((m) => m.exhaustedSlotsPerDay).padEnd(13), f((m) => m.rankWinCorr).padEnd(12), f((m) => m.inversions, 0), f((m) => m.strongWinPct, 0), f((m) => m.weakWinPct, 0), f((m) => m.leadershipChanges, 1));
}
