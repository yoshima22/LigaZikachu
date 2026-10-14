import assert from "node:assert/strict";
import { test } from "node:test";
import { newExpeditionState } from "./expedition-state";
import { generateTowerRoomGraph } from "./rooms";
import { canUseRecoveryRoom, mergeRecoveredHp, releaseCapturedMascot, reviveMember, terminalMascotDisposition, TowerRecoveryError } from "./recovery-rules";

test("recovered HP replaces stale run snapshots before boss sizing and combat", () => {
  const before = [{ mascotId: "fallen", currentHp: 0 }, { mascotId: "ready", currentHp: 40 }];
  const after = mergeRecoveredHp(before, { fallen: 51 });
  assert.deepEqual(after, [{ mascotId: "fallen", currentHp: 51 }, { mascotId: "ready", currentHp: 40 }]);
  assert.equal(before[0].currentHp, 0);
});

function fallenParty() {
  const source = generateTowerRoomGraph("recovery");
  const state = newExpeditionState(source, ["ana", "bruno"]);
  state.globalTurn = 4;
  state.members.bruno.status = "DOWNED";
  const recovery = state.graph.find((room) => room.kind === "RECOVERY")!;
  return { state, recoveryId: recovery.id, vitals: [
    { mascotId: "b1", ownerUserId: "bruno", currentHp: 0, maxHp: 101 },
    { mascotId: "b2", ownerUserId: "bruno", currentHp: 0, maxHp: 80 },
  ] };
}

test("recovery room used on floor 2 is blocked on 3 and ready on 4", () => {
  assert.equal(canUseRecoveryRoom(2, null), true);
  assert.equal(canUseRecoveryRoom(2, 2), false);
  assert.equal(canUseRecoveryRoom(3, 2), false);
  assert.equal(canUseRecoveryRoom(4, 2), true);
});

test("item revival requires the rescuer in the fallen trainer's room", () => {
  const { state, vitals } = fallenParty();
  state.members.bruno.roomId = "boss";
  assert.throws(() => reviveMember(state, "bruno", { kind: "ITEM", actorId: "ana" }, 2, vitals),
    (error) => error instanceof TowerRecoveryError && error.code === "TOO_FAR");
  state.members.ana.roomId = "boss";
  const result = reviveMember(state, "bruno", { kind: "ITEM", actorId: "ana" }, 2, vitals);
  assert.equal(result.state.members.bruno.status, "ACTIVE");
  assert.equal(result.state.members.bruno.availableFromTurn, 5);
  assert.deepEqual(result.hpByMascotId, { b1: 51, b2: 40 });
  assert.equal(result.state.lastRecoveryFloor, null);
});

test("recovery room reaches a distant fallen trainer and persists floor cooldown", () => {
  const { state, recoveryId, vitals } = fallenParty();
  state.members.bruno.roomId = "boss";
  state.members.ana.roomId = recoveryId;
  const result = reviveMember(state, "bruno", { kind: "ROOM", actorId: "ana" }, 2, vitals);
  assert.equal(result.state.members.bruno.roomId, "boss");
  assert.equal(result.state.lastRecoveryFloor, 2);
  assert.deepEqual(result.hpByMascotId, { b1: 51, b2: 40 });
  assert.throws(() => reviveMember(result.state, "bruno", { kind: "ROOM", actorId: "ana" }, 3, vitals));
});

test("captured mascot release preserves ownership and executes restoration once", async () => {
  const captive = { mascotId: "lost-1", ownerUserId: "owner-a", recovered: false, resting: false };
  const store = {
    async markRecoveredIfCaptive(mascotId: string, encounterId: string, actorId: string) {
      assert.equal(mascotId, captive.mascotId);
      assert.equal(encounterId, "run-7:room-2");
      assert.equal(actorId, "ana");
      if (captive.recovered) return false;
      captive.recovered = true;
      return true;
    },
    async restoreMascotToOwner(mascotId: string) {
      assert.equal(mascotId, captive.mascotId);
      captive.resting = true;
    },
  };
  assert.equal(await releaseCapturedMascot(store, "lost-1", "run-7:room-2", "ana"), true);
  assert.equal(await releaseCapturedMascot(store, "lost-1", "run-7:room-2", "ana"), false);
  assert.deepEqual(captive, { mascotId: "lost-1", ownerUserId: "owner-a", recovered: true, resting: true });
});

test("only defeated non-AFK mascots from a lost run become captives", () => {
  assert.deepEqual(terminalMascotDisposition("AFK_ABANDONED", false, 80), { state: "RECOVERED", currentHp: 80 });
  assert.deepEqual(terminalMascotDisposition("AFK_ABANDONED", false, 0), { state: "RECOVERED", currentHp: 1 });
  assert.deepEqual(terminalMascotDisposition("DOWNED", false, 0), { state: "LOST_IN_TOWER", currentHp: 0 });
  assert.deepEqual(terminalMascotDisposition("ACTIVE", false, 23), { state: "RECOVERED", currentHp: 23 });
  assert.deepEqual(terminalMascotDisposition("DOWNED", true, 0), { state: "RECOVERED", currentHp: 1 });
});
