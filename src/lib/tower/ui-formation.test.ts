import assert from "node:assert/strict";
import { test } from "node:test";
import { describeTowerFormation, towerReserveVisible } from "./ui-formation";

test("solo projects four ordered mascots as two actives and two reserves", () => {
  const mascots = [4, 2, 1, 3].map((slot) => ({ id: `m${slot}`, formationSlot: slot }));
  const view = describeTowerFormation("SOLO", mascots);
  assert.deepEqual(view.active.map((mascot) => mascot.id), ["m1", "m2"]);
  assert.deepEqual(view.reserve.map((mascot) => mascot.id), ["m3", "m4"]);
  assert.equal(view.required, 4);
});

test("group and legacy show two actives and never a reserve stage", () => {
  const mascots = [{ id: "b", formationSlot: 2 }, { id: "a", formationSlot: 1 }];
  assert.deepEqual(describeTowerFormation("GROUP", mascots).active.map((mascot) => mascot.id), ["a", "b"]);
  assert.deepEqual(describeTowerFormation(null, mascots).reserve, []);
  assert.equal(describeTowerFormation("GROUP", mascots).required, 2);
});

test("replay reserves remain hidden until the actual deployment event", () => {
  const events = [{ effect: undefined }, { effect: "Reservas da Torre entraram no mesmo combate após a queda dos dois ativos." }, { effect: undefined }];
  assert.equal(towerReserveVisible(events, -1), false);
  assert.equal(towerReserveVisible(events, 0), false);
  assert.equal(towerReserveVisible(events, 1), true);
  assert.equal(towerReserveVisible(events, 2), true);
  assert.equal(towerReserveVisible([{ effect: "Outro efeito" }], 9), false);
});
