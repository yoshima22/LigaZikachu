import assert from "node:assert/strict";
import test from "node:test";
import { sortMascotRoster } from "./mascot-roster-sort";

const rows = [
  { id: "lv99", level: 99, statForce: 100, statAgility: 100, statCharisma: 100, statInstinct: 100, statVitality: 100 },
  { id: "lv100-lower-total", level: 100, statForce: 90, statAgility: 90, statCharisma: 90, statInstinct: 90, statVitality: 90 },
  { id: "lv100-higher-total", level: 100, statForce: 100, statAgility: 100, statCharisma: 100, statInstinct: 100, statVitality: 100 },
  { id: "highest-force", level: 80, statForce: 200, statAgility: 1, statCharisma: 1, statInstinct: 1, statVitality: 1 },
];

test("sorts level 100 mascots by total stats before lower levels", () => {
  assert.deepEqual(sortMascotRoster(rows, "level").slice(0, 3).map((row) => row.id), ["lv100-higher-total", "lv100-lower-total", "lv99"]);
});

test("sorts an individual stat with total stats then level as tiebreakers", () => {
  assert.equal(sortMascotRoster(rows, "force")[0].id, "highest-force");
  assert.deepEqual(sortMascotRoster(rows, "total").slice(0, 2).map((row) => row.id), ["lv100-higher-total", "lv99"]);
});
