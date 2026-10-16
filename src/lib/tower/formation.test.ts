import assert from "node:assert/strict";
import { test } from "node:test";
import { activeTowerMascots, validateTowerFormation } from "./formation";

test("solo keeps four distinct mascot IDs in active-then-reserve order", () => {
  assert.deepEqual(validateTowerFormation("SOLO", ["d", "b", "a", "c"]), {
    ok: true,
    slots: [
      { mascotId: "d", formationSlot: 1 },
      { mascotId: "b", formationSlot: 2 },
      { mascotId: "a", formationSlot: 3 },
      { mascotId: "c", formationSlot: 4 },
    ],
  });
});

test("group takes two mascots and rejects malformed formations", () => {
  assert.deepEqual(validateTowerFormation("GROUP", ["b", "a"]), {
    ok: true,
    slots: [
      { mascotId: "b", formationSlot: 1 },
      { mascotId: "a", formationSlot: 2 },
    ],
  });
  assert.equal(validateTowerFormation("GROUP", ["a", "b", "c"]).ok, false);
  assert.equal(validateTowerFormation("SOLO", ["a", "b"]).ok, false);
  assert.equal(validateTowerFormation("SOLO", ["a", "b", "b", "d"]).ok, false);
  assert.equal(validateTowerFormation("GROUP", ["a", " "]).ok, false);
});

test("active lineup excludes solo reserves but preserves legacy null-slot snapshots", () => {
  const solo = [
    { formationSlot: 4, currentHp: 100 },
    { formationSlot: 2, currentHp: 0 },
    { formationSlot: 1, currentHp: 50 },
    { formationSlot: 3, currentHp: 100 },
  ];
  assert.deepEqual(activeTowerMascots("SOLO", solo), [solo[2]]);
  const legacy = [
    { formationSlot: null, currentHp: 100 },
    { formationSlot: null, currentHp: 50 },
  ];
  assert.deepEqual(activeTowerMascots(null, legacy), legacy);
});
