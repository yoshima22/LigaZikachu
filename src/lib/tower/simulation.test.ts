import assert from "node:assert/strict";
import { test } from "node:test";
import { simulateTower, simulatedAllyStat } from "./simulation";

test("synthetic ally attributes round class and talent phases like live V2", () => {
  assert.equal(simulatedAllyStat(225, 1.1, 1.18), 293);
});

test("same seed and expedition configuration reproduce the entire report", () => {
  const first = simulateTower("repro-42", 2, "INTERMEDIATE", "ONLINE", "SPLIT");
  const second = simulateTower("repro-42", 2, "INTERMEDIATE", "ONLINE", "SPLIT");
  assert.deepEqual(first, second);
});

test("solo models four HP snapshots while a group has two per trainer", () => {
  const solo = simulateTower("formation-4", 1, "PREPARED", "ONLINE", "UNITED");
  const duo = simulateTower("formation-4", 2, "PREPARED", "ONLINE", "UNITED");
  assert.equal(solo.hpMaximum, duo.hpMaximum);
  assert.equal(solo.hpMaximum, 4 * (55 + 70 * 6 + 240 * 4));
});

test("split first boss freezes an encounter sized for all living active trainers", () => {
  const report = simulateTower("validate-1", 3, "PREPARED", "ONLINE", "SPLIT");
  assert.equal(report.bossDefenderCounts[0], 4);
  const withCaptive = simulateTower("validate-1", 3, "PREPARED", "ONLINE", "SPLIT", 0, undefined, true);
  assert.equal(withCaptive.bossDefenderCounts[0], 4);
  assert.equal(withCaptive.bossCaptiveCounts[0], 1);
});

test("a trainer cannot enter and fight the boss in one confirmed window", () => {
  const report = simulateTower("validate-1", 3, "PREPARED", "ONLINE", "UNITED");
  assert.ok(report.bossFightTurns[0] > report.bossArrivalTurns[0]);
});

test("boss pressure for waiting is charged only after a trainer submits WAIT", () => {
  const report = simulateTower("validate-1", 3, "PREPARED", "ONLINE", "SPLIT");
  assert.ok(report.bossWaitTurns.length > 0);
  assert.ok(report.bossWaitTurns.every((turn) => turn > report.bossArrivalTurns[0]));
});

test("strategic split carries a banked advantage through a long reunion", () => {
  const report = simulateTower("validate-0", 3, "PREPARED", "ONLINE", "SPLIT");
  assert.ok(report.bossOverloadEarnedTurns.length > 0);
  assert.ok(report.bossOverloadConsumedTurns.length > 0);
  assert.ok(report.bossOverloadConsumedTurns[0] - report.bossOverloadEarnedTurns[0] >= 8);
  assert.ok(report.bossOverloadConsumedTurns[0] >= report.bossFightTurns[0]);
});

test("solo, duo and trio across build tiers expose complete bounded metrics without duplicate loot", () => {
  for (const partySize of [1, 2, 3] as const) {
    for (const buildTier of ["ZERO", "INTERMEDIATE", "PREPARED"] as const) {
      const report = simulateTower(`matrix-${partySize}-${buildTier}`, partySize, buildTier, "SLOW", "UNITED");
      assert.ok(["WIN", "LOSS"].includes(report.outcome), `navigation stalled: ${JSON.stringify(report)}`);
      assert.ok(report.floorReached >= 1 && report.floorReached <= 7);
      assert.ok(report.turns >= 1 && report.turns <= 1200);
      assert.ok(report.pressurePeak >= 0 && report.pressurePeak <= 12);
      assert.ok(report.hpRemaining >= 0 && report.hpRemaining <= report.hpMaximum);
      assert.ok(report.downedCount >= 0 && report.recoveries >= 0);
      assert.equal(report.duplicateRewardIds, 0);
      assert.ok(report.securedRewards >= 0 && report.lostRewards >= 0);
      if (report.outcome === "WIN") assert.equal(report.floorReached, 7);
    }
  }
});

test("pace affects reward shards, not the same-seed combat path", () => {
  const online = simulateTower("pace-7", 2, "PREPARED", "ONLINE", "UNITED");
  const slow = simulateTower("pace-7", 2, "PREPARED", "SLOW", "UNITED");
  assert.equal(online.floorReached, slow.floorReached);
  assert.equal(online.turns, slow.turns);
  assert.equal(online.hpRemaining, slow.hpRemaining);
  assert.equal(online.relicShards, slow.relicShards * 2);
});

test("an offline prepared trio can complete all seven floors in both paces", () => {
  for (const pace of ["ONLINE", "SLOW"] as const) {
    const report = simulateTower("matrix-0", 3, "PREPARED", pace, "UNITED");
    assert.equal(report.outcome, "WIN");
    assert.equal(report.bossesDefeated, 7);
    assert.equal(report.floorReached, 7);
  }
});

test("the tuned V2 first floor opens a boss path for an unprepared trio", () => {
  const previous = { firstFloorEnemyScale: 1, firstBossEscortReduction: 0, lateFloorEnemyScale: 1 };
  const zeroBefore = simulateTower("validate-2", 3, "ZERO", "ONLINE", "UNITED", 0, previous);
  const zeroNow = simulateTower("validate-2", 3, "ZERO", "ONLINE", "UNITED");
  assert.equal(zeroBefore.bossesDefeated, 0);
  assert.equal(zeroNow.bossesDefeated, 1);
});

test("a small fixed cohort keeps first-boss progress possible on both routes", () => {
  for (const route of ["UNITED", "SPLIT"] as const) {
    const firstBossVictories = Array.from({ length: 20 }, (_, index) =>
      simulateTower(`validate-${index}`, 3, "ZERO", "ONLINE", route))
      .filter((report) => report.bossesDefeated >= 1).length;
    assert.ok(firstBossVictories > 0, `${route} had no attainable first-boss victory`);
  }
});

test("a recovery action never revives someone in the combat turn that downed them", () => {
  const report = simulateTower("matrix-0", 3, "PREPARED", "ONLINE", "SPLIT");
  assert.ok(report.recoveryTimings.length > 0);
  for (const timing of report.recoveryTimings)
    assert.ok(timing.recoveredTurn > timing.downedTurn, JSON.stringify(timing));
});

test("deterministic AFK windows remove rewards from players who abandon", () => {
  const report = simulateTower("afk-1", 3, "PREPARED", "SLOW", "UNITED", 1);
  assert.equal(report.afkRate, 1);
  assert.ok(report.afkAbandoned > 0);
  assert.ok(report.missedWindows >= report.afkAbandoned * 2);
  for (const [memberId, count] of Object.entries(report.dropsByPlayer)) {
    if (report.memberPositions[memberId]?.startsWith("AFK_ABANDONED:")) assert.equal(count, 0);
  }
  assert.deepEqual(report, simulateTower("afk-1", 3, "PREPARED", "SLOW", "UNITED", 1));
});

test("relic shards count only members eligible at each boss victory", () => {
  const report = simulateTower("afk-validation-0", 3, "PREPARED", "ONLINE", "UNITED", 0.05);
  assert.ok(report.bossesDefeated > 0 && report.afkAbandoned > 0);
  assert.equal(report.relicShards, Object.values(report.relicShardsByPlayer).reduce((sum, count) => sum + count, 0));
  assert.ok(report.relicShards < report.bossesDefeated * report.partySize * 2);
});
