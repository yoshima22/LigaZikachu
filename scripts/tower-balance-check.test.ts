import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { simulateTower } from "../src/lib/tower/simulation";

test("balance CLI reports a reproducible comparison without dumping every run", () => {
  const output = execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/tower-simulate.ts",
    "--seeds", "1", "--seed-prefix", "check", "--balance", "before", "--summary-only", "--format", "json"],
  { cwd: process.cwd(), encoding: "utf8" });
  const parsed = JSON.parse(output);
  assert.equal(parsed.seedPrefix, "check");
  assert.equal(parsed.balance, "before");
  assert.equal(parsed.reports, undefined);
  assert.equal(parsed.groups.length, 27);
  assert.equal(parsed.balanceVersion, 2);
  assert.ok(parsed.groups.every((group: { samples: number; boss1: number; bossProgress: number[]; seedCohort: string }) =>
    group.samples === 1 && group.boss1 >= 0 && group.bossProgress.length === 7 && group.seedCohort === "check"));
});

test("prepared solo, duo, trio and strategic split stay near 10% across two cohorts", () => {
  for (const partySize of [1, 2, 3] as const) {
    const routes = partySize === 1 ? ["UNITED"] as const : ["UNITED", "STRATEGIC_SPLIT"] as const;
    for (const route of routes) {
      const cohortWins = ["validate", "holdout"].map((cohort) => Array.from({ length: 100 }, (_, index) =>
        simulateTower(`${cohort}-${index}`, partySize, "PREPARED", "ONLINE", route))
        .filter((report) => report.outcome === "WIN").length);
      const total = cohortWins.reduce((sum, count) => sum + count, 0);
      assert.ok(total >= 10 && total <= 30,
        `party ${partySize} / ${route} venceu ${total}/200, fora de 5–15%`);
      assert.ok(cohortWins.every((count) => count >= 5 && count <= 15),
        `party ${partySize} / ${route} teve coorte extrema: ${cohortWins.join("/")}`);
    }
  }
});
