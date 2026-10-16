import assert from "node:assert/strict";
import test from "node:test";
import { newExpeditionState } from "./expedition-state";
import { generateTowerRoomGraph } from "./rooms";
import { recoverSoloMascots, TowerRecoveryError } from "./recovery-rules";
import { switchSoloFormation } from "./formation";

function soloState() {
  const state = newExpeditionState(generateTowerRoomGraph("solo-recovery"), ["ana"]);
  state.globalTurn = 5;
  const recovery = state.graph.find((room) => room.kind === "RECOVERY")!;
  return { state, recoveryId: recovery.id, vitals: [
    { mascotId: "a1", ownerUserId: "ana", currentHp: 100, maxHp: 100 },
    { mascotId: "a2", ownerUserId: "ana", currentHp: 0, maxHp: 101 },
    { mascotId: "r1", ownerUserId: "ana", currentHp: 0, maxHp: 80 },
    { mascotId: "r2", ownerUserId: "ana", currentHp: 30, maxHp: 80 },
  ] };
}

test("solo room restores only fallen mascots at half HP once per two floors", () => {
  const { state, recoveryId, vitals } = soloState();
  state.members.ana.roomId = recoveryId;
  const first = recoverSoloMascots(state, "ana", "ROOM", 2, vitals);
  assert.deepEqual(first.hpByMascotId, { a2: 51, r1: 40 });
  assert.equal(first.state.lastRecoveryFloor, 2);
  assert.throws(() => recoverSoloMascots(first.state, "ana", "ROOM", 3, vitals), TowerRecoveryError);
  assert.equal(recoverSoloMascots(first.state, "ana", "ROOM", 4, vitals).state.lastRecoveryFloor, 4);
});

test("solo item recovery is available only while the trainer is still standing", () => {
  const { state, vitals } = soloState();
  assert.deepEqual(recoverSoloMascots(state, "ana", "ITEM", 2, vitals).hpByMascotId, { a2: 51, r1: 40 });
  assert.throws(() => recoverSoloMascots(state, "ana", "ITEM", 2, vitals.map((entry) => ({ ...entry, currentHp: 0 }))), TowerRecoveryError);
  state.members.ana.status = "DOWNED";
  assert.throws(() => recoverSoloMascots(state, "ana", "ITEM", 2, vitals), TowerRecoveryError);
});

test("switch is an exact permutation with two living active slots and no HP change", () => {
  const current = [
    { mascotId: "a1", currentHp: 0, formationSlot: 1 },
    { mascotId: "a2", currentHp: 100, formationSlot: 2 },
    { mascotId: "r1", currentHp: 80, formationSlot: 3 },
    { mascotId: "r2", currentHp: 0, formationSlot: 4 },
  ];
  const switched = switchSoloFormation(current, ["a2", "r1", "a1", "r2"]);
  assert.deepEqual(switched, [
    { mascotId: "a2", formationSlot: 1 }, { mascotId: "r1", formationSlot: 2 },
    { mascotId: "a1", formationSlot: 3 }, { mascotId: "r2", formationSlot: 4 },
  ]);
  assert.deepEqual(current.map((entry) => entry.currentHp), [0, 100, 80, 0]);
  assert.throws(() => switchSoloFormation(current, ["a2", "a2", "a1", "r2"]));
  assert.throws(() => switchSoloFormation(current, ["a1", "a2", "r1", "r2"]));
});
