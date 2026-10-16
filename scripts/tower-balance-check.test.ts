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

test("prepared solo, duo, trio and strategic split remain in the two-cohort target band", () => {
  for (const cohort of ["validate", "holdout"]) {
    for (const partySize of [1, 2, 3] as const) {
      const routes = partySize === 1 ? ["UNITED"] as const : ["UNITED", "STRATEGIC_SPLIT"] as const;
      for (const route of routes) {
        const wins = Array.from({ length: 100 }, (_, index) =>
          simulateTower(`${cohort}-${index}`, partySize, "PREPARED", "ONLINE", route))
          .filter((report) => report.outcome === "WIN").length;
        assert.ok(wins >= 5 && wins <= 15,
          `${cohort}: party ${partySize} / ${route} venceu ${wins}/100, fora de 5–15`);
      }
    }
  }
});
