import assert from "node:assert/strict";
import { test } from "node:test";
import { newExpeditionState } from "./expedition-state";
import type { RoomFrontResult } from "./room-resolver";
import { generateTowerRoomGraph } from "./rooms";
import { applyPressureToExpedition, bossOverloadValue, consumeBossOverloadCharge, earnBossOverloadCharge, updateOverload, overloadFromResults, pressureDelta, transitionFloor } from "./pressure-rules";

test("one united trio pays one base pressure, split fronts add capped pressure", () => {
  assert.equal(pressureDelta({ activeFronts: 1, mistakes: 0, waits: 0, shield: 0 }).applied, 1);
  assert.equal(pressureDelta({ activeFronts: 3, mistakes: 0, waits: 0, shield: 0 }).applied, 3);
  assert.equal(pressureDelta({ activeFronts: 3, mistakes: 0, waits: 0, shield: 0, splitPenalty: 1 }).applied, 1);
  const protectedTurn = pressureDelta({ activeFronts: 3, mistakes: 1, waits: 0, shield: 2 });
  assert.equal(protectedTurn.gross, 4);
  assert.equal(protectedTurn.applied, 2);
  assert.equal(protectedTurn.remainingShield, 0);
});

test("two successful independent fronts give bounded temporary overload", () => {
  const front = (roomId: string, success: boolean) => ({ roomId, success }) as RoomFrontResult;
  assert.equal(overloadFromResults([front("a", true)]), 0);
  assert.equal(overloadFromResults([front("a", true), front("a", true)]), 0);
  assert.equal(overloadFromResults([front("a", true), front("b", false)]), 0);
  assert.equal(overloadFromResults([front("a", true), front("b", true)]), 0.08);
  assert.equal(overloadFromResults([front("a", true), front("b", true), front("c", true), front("d", true)]), 0.16);
});

test("next floor moderately heals living mascots and relieves pressure without reviving downed trainers", () => {
  const state = newExpeditionState(generateTowerRoomGraph("floor-transition"), ["ana", "bruno"]);
  state.pressure = 10;
  state.lastRecoveryFloor = 1;
  state.members.bruno.status = "DOWNED";
  state.members.ana.roomId = "boss";
  const result = transitionFloor(state, 2, "floor-transition", [
    { mascotId: "a1", ownerUserId: "ana", currentHp: 20, maxHp: 100 },
    { mascotId: "a2", ownerUserId: "ana", currentHp: 99, maxHp: 100 },
    { mascotId: "b1", ownerUserId: "bruno", currentHp: 0, maxHp: 100 },
  ]);
  assert.equal(result.state.pressure, 6);
  assert.equal(result.state.members.ana.roomId, "entrance");
  assert.equal(result.state.members.bruno.roomId, "entrance");
  assert.equal(result.state.members.bruno.status, "DOWNED");
  assert.equal(result.state.lastRecoveryFloor, 1);
  assert.deepEqual(result.healingByMascotId, { a1: 38, a2: 100 });
  assert.equal(result.state.rooms.boss.cleared, false);
});

test("V2 transition options apply without changing the legacy defaults", () => {
  const state = newExpeditionState(generateTowerRoomGraph("transition-profile"), ["ana"]);
  state.pressure = 10;
  const mascot = [{ mascotId: "a1", ownerUserId: "ana", currentHp: 20, maxHp: 100 }];
  const legacy = transitionFloor(state, 2, "transition-profile", mascot);
  const configured = transitionFloor(state, 2, "transition-profile", mascot,
    { firstFloorEnemyScale: 1, firstBossEscortReduction: 0, lateFloorEnemyScale: 1,
      floorHealingFraction: 0.24, floorPressureRelief: 6 });
  assert.equal(legacy.state.pressure, 6);
  assert.equal(configured.state.pressure, 4);
  assert.equal(legacy.healingByMascotId.a1, 38);
  assert.equal(configured.healingByMascotId.a1, 44);
});

test("pressure saturates at its cap and explains the actual change", () => {
  const state = newExpeditionState(generateTowerRoomGraph("pressure-cap"), ["ana"]);
  state.pressure = 11.5;
  state.pressureShield = 1;
  const change = pressureDelta({ activeFronts: 2, mistakes: 1, waits: 0, shield: 1 });
  const next = applyPressureToExpedition(state, change);
  assert.equal(next.pressure, 12);
  assert.equal(next.pressureShield, 0);
  assert.equal(next.lastPressureChange?.applied, 0.5);
  assert.ok(next.lastPressureChange?.reasons.some((reason) => reason.includes("limite")));
});

test("overload weakens following turns, is capped, then expires without success", () => {
  const state = newExpeditionState(generateTowerRoomGraph("overload"), ["ana"]);
  const first = updateOverload(state, 3, 0.08);
  assert.deepEqual(first.overload, { value: 0.08, expiresAfterTurn: 5 });
  const boosted = updateOverload(first, 4, 0.16);
  assert.deepEqual(boosted.overload, { value: 0.16, expiresAfterTurn: 6 });
  assert.equal(updateOverload(boosted, 6, 0).overload?.value, 0.16);
  assert.equal(updateOverload(boosted, 7, 0).overload, null);
});

test("distinct successful group fronts bank one bounded boss advantage per floor", () => {
  const state = newExpeditionState(generateTowerRoomGraph("boss-bank"), ["a", "b", "c"]);
  assert.equal(bossOverloadValue(earnBossOverloadCharge(state, ["room-a"])), 0);
  assert.equal(bossOverloadValue(earnBossOverloadCharge(state, ["room-a", "room-a"])), 0);
  const earned = earnBossOverloadCharge(state, ["room-a", "room-b"]);
  assert.equal(bossOverloadValue(earned), 0.08);
  assert.equal(bossOverloadValue(updateOverload(earned, 20, 0)), 0.08);
  assert.equal(bossOverloadValue(earnBossOverloadCharge(state, ["room-a", "room-b", "room-c"])), 0.16);
  assert.equal(bossOverloadValue(earnBossOverloadCharge(earned, ["room-a", "room-b", "room-c"])), 0.08);
  const spent = consumeBossOverloadCharge(earned);
  assert.equal(bossOverloadValue(spent), 0);
  assert.equal(bossOverloadValue(earnBossOverloadCharge(spent, ["room-a", "room-b"])), 0);
  const next = transitionFloor(spent, 2, "boss-bank", []).state;
  assert.equal(bossOverloadValue(earnBossOverloadCharge(next, ["room-a", "room-b"])), 0.08);
  const solo = newExpeditionState(generateTowerRoomGraph("boss-bank-solo"), ["a"]);
  assert.equal(bossOverloadValue(earnBossOverloadCharge(solo, ["room-a", "room-b"])), 0);
});
