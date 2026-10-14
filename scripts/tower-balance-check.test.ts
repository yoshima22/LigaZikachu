import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("balance CLI reports a reproducible comparison without dumping every run", () => {
  const output = execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/tower-simulate.ts",
    "--seeds", "1", "--seed-prefix", "check", "--balance", "before", "--summary-only", "--format", "json"],
  { cwd: process.cwd(), encoding: "utf8" });
  const parsed = JSON.parse(output);
  assert.equal(parsed.seedPrefix, "check");
  assert.equal(parsed.balance, "before");
  assert.equal(parsed.reports, undefined);
  assert.equal(parsed.groups.length, 18);
  assert.ok(parsed.groups.every((group: { samples: number; boss1: number }) => group.samples === 1 && group.boss1 >= 0));
});
