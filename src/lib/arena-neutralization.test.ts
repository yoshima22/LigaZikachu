import assert from "node:assert/strict";
import test from "node:test";
import { brtDayKey, isNeutralized } from "./arena-neutralization";

test("o dia vira à meia-noite de Brasília (03:00 UTC)", () => {
  assert.equal(brtDayKey(new Date("2026-11-24T02:59:59Z")), "2026-11-23");
  assert.equal(brtDayKey(new Date("2026-11-24T03:00:00Z")), "2026-11-24");
});

test("a proteção vale só até o fim do prazo", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  assert.equal(isNeutralized(new Date(now + 1000), now), true);
  assert.equal(isNeutralized(new Date(now), now), false);
  assert.equal(isNeutralized(null, now), false);
});
