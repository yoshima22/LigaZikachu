import assert from "node:assert/strict";
import { test } from "node:test";
import { activeTowerMascots, switchSoloFormation, validateTowerFormation } from "./formation";

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

test("the last surviving solo reserve can take an active slot without reviving anyone", () => {
  const mascots = [
    { mascotId: "a", currentHp: 0, formationSlot: 1 },
    { mascotId: "b", currentHp: 0, formationSlot: 2 },
    { mascotId: "c", currentHp: 71, formationSlot: 3 },
    { mascotId: "d", currentHp: 0, formationSlot: 4 },
  ];
  assert.deepEqual(switchSoloFormation(mascots, ["c", "a", "b", "d"]), [
    { mascotId: "c", formationSlot: 1 },
    { mascotId: "a", formationSlot: 2 },
    { mascotId: "b", formationSlot: 3 },
    { mascotId: "d", formationSlot: 4 },
  ]);
  assert.throws(() => switchSoloFormation(mascots, ["a", "c", "b", "d"]), /ativo|vivo/i);
});
