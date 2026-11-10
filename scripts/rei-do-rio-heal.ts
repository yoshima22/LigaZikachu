// Efeito da cura geral entre lutas sobre os times zerados. Uso: npx tsx scripts/rei-do-rio-heal.ts [jogadores] [semanas] [troca%]
import { makeSimPlayer, simulateWeek } from "../src/lib/rei-do-rio/simulate";

const n = Number(process.argv[2] ?? 16);
const weeks = Number(process.argv[3] ?? 8);
const swap = Number(process.argv[4] ?? 50);
const presets = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const;
const tiers = ["FRACO", "MEDIO", "FORTE"] as const;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const f1 = (x: number) => x.toFixed(1);

const scenarios: Record<string, Record<string, unknown>> = {
  "Padrão atual (sem cura)": {},
  "Cura 10%": { betweenFightHealPct: 10 },
  "Cura 15%": { betweenFightHealPct: 15 },
  "Cura 20%": { betweenFightHealPct: 20 },
  "Cura 30%": { betweenFightHealPct: 30 },
  "Cura 15% + limite 5 rodadas": { betweenFightHealPct: 15, maxRounds: 5 },
  "Cura 15% + HP x4": { betweenFightHealPct: 15, hpMultiplier: 4 },
};
console.log(`${n} jogadores, ${weeks} semanas, troca por vida ${swap}%\n`);
console.log("cenário".padEnd(30), "FRACOS em campo (09 12 15 18 21)", " | zerados 18h/21h (fracos)", "| geral 21h", "| KOs/luta", "| fraco vit%", "| inv");
for (const [name, cfg] of Object.entries(scenarios)) {
  const runs = Array.from({ length: weeks }, (_, w) => {
    const players = Array.from({ length: n }, (_, i) => makeSimPlayer(w * 100 + i + 1, presets[i % 4], tiers[i % 3], swap));
    return simulateWeek(players, { editionId: `h-${w}`, cfg }).metrics;
  });
  const fr = runs.map((m) => m.byTier["FRACO"]);
  const act = [0, 1, 2, 3, 4].map((k) => f1(avg(fr.map((t) => t.active[k])))).join(" ");
  console.log(
    name.padEnd(30), act.padEnd(32),
    "|", `${f1(avg(fr.map((t) => t.emptyPct[3])))}% / ${f1(avg(fr.map((t) => t.emptyPct[4])))}%`.padEnd(24),
    "|", `${f1(avg(runs.map((m) => m.emptyPctBySlot[4])))}%`.padEnd(9),
    "|", f1(avg(runs.map((m) => m.avgKosPerMatch))).padEnd(8),
    "|", f1(avg(runs.map((m) => m.weakWinPct))).padEnd(10),
    "|", f1(avg(runs.map((m) => m.inversions))),
  );
}
