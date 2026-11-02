import assert from "node:assert/strict";
import test from "node:test";
import { eventEggBonusForStat } from "./event-egg-bonus";

test("shows an event egg bonus only beside its affected final stat", () => {
  assert.equal(eventEggBonusForStat("statAgility", "statAgility", 5), 5);
  assert.equal(eventEggBonusForStat("statForce", "statAgility", 5), null);
  assert.equal(eventEggBonusForStat("statAgility", null, 5), null);
});
