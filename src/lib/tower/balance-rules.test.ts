import assert from "node:assert/strict";
import { test } from "node:test";
import { TOWER_BALANCE, TOWER_BALANCE_GROUP_V2, TOWER_BALANCE_SOLO_V2, towerAddCaptive, towerBalanceFor, towerBossDefenderCount, towerEnemyBaseStat } from "./balance-rules";

test("enemy stat tuning applies only to its intended floor band", () => {
  const experiment = { firstFloorEnemyScale: 0.95, firstBossEscortReduction: 0, lateFloorEnemyScale: 1.08 };
  const baseline = towerEnemyBaseStat(70, 37, 1, 1, { firstFloorEnemyScale: 1, firstBossEscortReduction: 0, lateFloorEnemyScale: 1 });
  assert.ok(towerEnemyBaseStat(70, 37, 1, 1, experiment) < baseline);
  assert.equal(towerEnemyBaseStat(70, 37, 1, 2, experiment), baseline);
  assert.ok(towerEnemyBaseStat(70, 37, 1, 5, experiment) > baseline);
  assert.equal(towerEnemyBaseStat(70, 37, 1, 4, experiment), baseline);
});

test("first boss escort count can be tuned without changing later bosses", () => {
  const balance = { firstFloorEnemyScale: 1, lateFloorEnemyScale: 1, firstBossEscortReduction: 1 };
  assert.equal(towerBossDefenderCount(6, 1, balance), 5);
  assert.equal(towerBossDefenderCount(6, 2, balance), 6);
  assert.equal(towerBossDefenderCount(2, 1, balance), 2);
});

test("a captive replaces an escort at the first boss instead of canceling its cap", () => {
  const enemies = ["boss", "escort-1", "escort-2", "escort-3"];
  assert.deepEqual(towerAddCaptive(enemies, "captive", "BOSS", 1, 6,
    { firstFloorEnemyScale: 0.95, firstBossEscortReduction: 2, lateFloorEnemyScale: 1.04 }),
    ["boss", "escort-1", "escort-2", "captive"]);
  assert.deepEqual(towerAddCaptive(enemies, "captive", "BOSS", 2, 6,
    { firstFloorEnemyScale: 0.95, firstBossEscortReduction: 2, lateFloorEnemyScale: 1.04 }),
    [...enemies, "captive"]);
  assert.deepEqual(towerAddCaptive(enemies, "captive", "COMBAT", 1, 6,
    { firstFloorEnemyScale: 0.95, firstBossEscortReduction: 2, lateFloorEnemyScale: 1.04 }),
    [...enemies, "captive"]);
  assert.deepEqual(towerAddCaptive(["boss", "escort"], "captive", "BOSS", 1, 2,
    { firstFloorEnemyScale: 0.95, firstBossEscortReduction: 2, lateFloorEnemyScale: 1.04 }),
    ["boss", "captive"]);
});

test("live V2 balance eases only the first floor", () => {
  assert.equal(TOWER_BALANCE.firstFloorEnemyScale, 0.95);
  assert.equal(TOWER_BALANCE.firstBossEscortReduction, 2);
  assert.equal(TOWER_BALANCE.lateFloorEnemyScale, 1);
  assert.equal(towerBossDefenderCount(6, 1), 4);
  assert.equal(towerBossDefenderCount(6, 2), 6);
});

test("solo and group V2 have distinct curves while null profile stays legacy", () => {
  assert.deepEqual(towerBalanceFor(null, null), TOWER_BALANCE);
  assert.deepEqual(towerBalanceFor("SOLO", 2), TOWER_BALANCE_SOLO_V2);
  assert.deepEqual(towerBalanceFor("GROUP", 2), TOWER_BALANCE_GROUP_V2);
  assert.notDeepEqual(TOWER_BALANCE_SOLO_V2, TOWER_BALANCE_GROUP_V2);
  assert.equal(towerEnemyBaseStat(70, 4, 1, 5, TOWER_BALANCE, 2),
    towerEnemyBaseStat(70, 4, 1, 5, TOWER_BALANCE, 3));
  assert.ok(towerEnemyBaseStat(70, 4, 1, 5, TOWER_BALANCE_GROUP_V2, 2) <
    towerEnemyBaseStat(70, 4, 1, 5, TOWER_BALANCE_GROUP_V2, 3));
});

test("late-floor group size tuning does not change the middle floors or legacy runs", () => {
  const baseline = { firstFloorEnemyScale: 1, firstBossEscortReduction: 0, lateFloorEnemyScale: 1, groupSizeSlope: 0.2 };
  const lateAdjusted = { ...baseline, lateFloorGroupSizeSlope: 0.4 };
  assert.equal(towerEnemyBaseStat(70, 4, 1, 4, lateAdjusted, 2),
    towerEnemyBaseStat(70, 4, 1, 4, baseline, 2));
  assert.equal(towerEnemyBaseStat(70, 4, 1, 5, lateAdjusted, 2), 61);
  assert.equal(towerEnemyBaseStat(70, 4, 1, 5, lateAdjusted, 3), 92);
  assert.equal(towerEnemyBaseStat(70, 4, 1, 5, TOWER_BALANCE, 2),
    towerEnemyBaseStat(70, 4, 1, 5, TOWER_BALANCE, 3));
});

test("V2 middle floors scale a duo separately without making a trio easier", () => {
  assert.equal(towerEnemyBaseStat(70, 4, 1, 3, TOWER_BALANCE_GROUP_V2, 2), 61);
  assert.equal(towerEnemyBaseStat(70, 4, 1, 3, TOWER_BALANCE_GROUP_V2, 3), 85);
  assert.equal(towerEnemyBaseStat(70, 4, 1, 1, TOWER_BALANCE_GROUP_V2, 2), 61);
  assert.equal(towerEnemyBaseStat(70, 4, 1, 5, TOWER_BALANCE_GROUP_V2, 3), 82);
});
