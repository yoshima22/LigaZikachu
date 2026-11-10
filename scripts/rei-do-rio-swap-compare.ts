// Compara políticas de troca por vida (mesma força/composição). Uso: npx tsx scripts/rei-do-rio-swap-compare.ts [semanas]
import { makeSimPlayer, simulateWeek } from "../src/lib/rei-do-rio/simulate";
import { suggestedSwapPct } from "../src/lib/rei-do-rio/team";

const weeks = Number(process.argv[2] ?? 12);
const presets = ["BALANCED", "OFFENSIVE", "ENDURANCE", "CONTROL"] as const;
const tiers = ["FRACO", "MEDIO", "FORTE"] as const;
const policies: Record<string, (role: string) => number> = {
  "Até cair (0%)": () => 0,
  "Todos 30%": () => 30,
  "Todos 50%": () => 50,
  "Suportes 30%, resto até cair": (r) => (suggestedSwapPct(r) > 0 ? 30 : 0),
  "Suportes 50%, resto até cair": (r) => suggestedSwapPct(r),
  "Suportes 30%, resto 30%": () => 30,
};
const names = Object.keys(policies);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
for (const tier of tiers) {
  const acc: Record<string, { pts: number[]; w: number; n: number }> = {};
  for (let w = 0; w < weeks; w++) {
    const ps = Array.from({ length: 12 }, (_, i) => {
      const p = makeSimPlayer(w * 100 + i + 1, presets[i % 4], tier, 0);
      const pol = policies[names[i % names.length]];
      for (const s of p.formation.slots) s.swapBelowPct = pol(s.role);
      p.tag = `${p.tag.split("/")[0]}/${tier}/${names[i % names.length]}`;
      return p;
    });
    const sim = simulateWeek(ps, { editionId: `c-${w}` });
    for (const r of sim.standings) {
      const tag = ps.find((p) => p.pid === r.pid)!.tag.split("/")[2];
      const e = (acc[tag] ??= { pts: [], w: 0, n: 0 });
      e.pts.push(r.score / 100); e.w += r.wins; e.n += r.wins + r.losses + r.draws;
    }
  }
  console.log(`\nFaixa ${tier}`);
  for (const [k, e] of Object.entries(acc)) console.log("  ", k.padEnd(32), "pontos", avg(e.pts).toFixed(0).padStart(5), " vitórias", ((100 * e.w) / e.n).toFixed(1) + "%");
}
