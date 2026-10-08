/** Verificação dos TMs da semana: npx tsx scripts/test-weekly-tm.ts */
import assert from "node:assert/strict";
import { getWeeklyTmWindow, pickDistinct } from "../src/lib/weekly-tm";

// Segunda 00:00 BRT = 03:00 UTC. 2026-10-05 é segunda.
const w = (iso: string) => getWeeklyTmWindow(new Date(iso)).start.toISOString();
assert.equal(w("2026-10-05T03:00:00Z"), "2026-10-05T03:00:00.000Z");
assert.equal(w("2026-10-05T02:59:59Z"), "2026-09-28T03:00:00.000Z", "domingo 23:59 BRT ainda é a semana anterior");
assert.equal(w("2026-10-08T15:00:00Z"), "2026-10-05T03:00:00.000Z");
assert.equal(w("2026-10-12T02:59:59Z"), "2026-10-05T03:00:00.000Z");
assert.equal(getWeeklyTmWindow(new Date("2026-10-08T15:00:00Z")).next.toISOString(), "2026-10-12T03:00:00.000Z");

for (let i = 0; i < 200; i += 1) {
  const p = pickDistinct(Array.from({ length: 20 }, (_, n) => n), 5);
  assert.equal(new Set(p).size, 5);
}
assert.equal(pickDistinct([1, 2], 5).length, 2);
console.log("ok");
