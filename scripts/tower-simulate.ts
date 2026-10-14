/** Offline Tower balance matrix. Example: npx tsx scripts/tower-simulate.ts --seeds 20 --format csv */
import { simulateTower, type BuildTier, type TowerSimulationReport } from "../src/lib/tower/simulation";
import type { TowerBalance } from "../src/lib/tower/balance-rules";

function argument(name: string, fallback: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const seedCount = Number(argument("seeds", "20"));
const format = argument("format", "json");
const afkRates = argument("afk-rates", "0").split(",").map(Number);
const seedPrefix = argument("seed-prefix", "matrix");
const balance = argument("balance", "current");
const firstBossCaptive = argument("first-boss-captive", "none") === "synthetic";
const summaryOnly = process.argv.includes("--summary-only");
const previousBalance: TowerBalance = { firstFloorEnemyScale: 1, firstBossEscortReduction: 0, lateFloorEnemyScale: 1 };
if (!Number.isInteger(seedCount) || seedCount < 1 || seedCount > 200 || !["csv", "json"].includes(format) ||
    !seedPrefix || !["current", "before"].includes(balance) ||
    !["none", "synthetic"].includes(argument("first-boss-captive", "none")) ||
    !afkRates.length || afkRates.some((rate) => !Number.isFinite(rate) || rate < 0 || rate > 1)) {
  process.stderr.write("Uso: --seeds 1..200 --seed-prefix validate --balance current|before --first-boss-captive none|synthetic --format json|csv [--summary-only] --afk-rates 0,0.05,0.15\n");
  process.exitCode = 1;
} else {
  const reports: TowerSimulationReport[] = [];
  for (let seed = 0; seed < seedCount; seed++)
    for (const partySize of [1, 2, 3] as const)
      for (const buildTier of ["ZERO", "INTERMEDIATE", "PREPARED"] as BuildTier[])
        for (const routePolicy of ["UNITED", "SPLIT"] as const)
          for (const pace of ["ONLINE", "SLOW"] as const)
            for (const afkRate of afkRates)
              reports.push(simulateTower(`${seedPrefix}-${seed}`, partySize, buildTier, pace, routePolicy, afkRate,
                balance === "before" ? previousBalance : undefined, firstBossCaptive));

  if (format === "csv") {
    const columns = Object.keys(reports[0]) as (keyof TowerSimulationReport)[];
    process.stdout.write(columns.join(",") + "\n");
    for (const report of reports) process.stdout.write(columns.map((key) => {
      const value = report[key];
      const text = typeof value === "object" ? JSON.stringify(value) : String(value);
      return `"${text.replaceAll('"', '""')}"`;
    }).join(",") + "\n");
  } else {
    const groups = afkRates.flatMap((afkRate) => ([1, 2, 3] as const).flatMap((partySize) =>
      (["ZERO", "INTERMEDIATE", "PREPARED"] as BuildTier[]).flatMap((buildTier) =>
        (["UNITED", "SPLIT"] as const).map((routePolicy) => {
          const samples = reports.filter((report) => report.partySize === partySize && report.buildTier === buildTier && report.routePolicy === routePolicy && report.pace === "ONLINE" && report.afkRate === afkRate);
          return { afkRate, partySize, buildTier, routePolicy, samples: samples.length,
            boss1: samples.filter((report) => report.bossesDefeated >= 1).length,
            boss2: samples.filter((report) => report.bossesDefeated >= 2).length,
            wins: samples.filter((report) => report.outcome === "WIN").length,
            turnLimits: samples.filter((report) => report.outcome === "TURN_LIMIT").length,
            meanFloor: Number((samples.reduce((sum, report) => sum + report.floorReached, 0) / samples.length).toFixed(2)),
            meanTurns: Number((samples.reduce((sum, report) => sum + report.turns, 0) / samples.length).toFixed(1)),
            recoveries: samples.reduce((sum, report) => sum + report.recoveries, 0),
            abandoned: samples.reduce((sum, report) => sum + report.afkAbandoned, 0),
            meanPreBossPressure: samples.flatMap((report) => report.preBossPressure).length
              ? Number((samples.flatMap((report) => report.preBossPressure).reduce((sum, value) => sum + value, 0) /
                samples.flatMap((report) => report.preBossPressure).length).toFixed(2)) : null,
          };
        }))));
    process.stdout.write(JSON.stringify({ model: "offline-v2-seeded", seedCount, seedPrefix, balance,
      firstBossCaptive, groups, ...(summaryOnly ? {} : { reports }) }, null, 2) + "\n");
  }
}
