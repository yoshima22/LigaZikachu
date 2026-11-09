// Compara alternativas de balanceamento (em memória). Uso: npx tsx scripts/rei-do-rio-scenarios.ts [jogadores] [sementes]
import { makeSimPlayer, simulateWeek } from "../src/lib/rei-do-rio/simulate";

const n = Number(process.argv[2] ?? 16);
const seeds = Number(process.argv[3] ?? 4);
const presets = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const;
const tiers = ["FRACO", "MEDIO", "FORTE"] as const;

const scenarios: Record<string, Record<string, unknown>> = {
  "Padrão novo (HP x3, 6 rod., vit. 30, sequência)": {},
  "Antigo (HP x1, 150 rod., vit. 15)": { hpMultiplier: 1, maxRounds: 150, budget: { win: 15 } },
  "Padrão novo sem Pressão/Calor": { pressure: { enabled: false }, current: { enabled: false } },
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
