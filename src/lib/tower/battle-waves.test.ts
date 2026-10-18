import assert from "node:assert/strict";
import test from "node:test";
import type { LeagueMascot } from "../league-combat";
import { resolveTowerBattle, selectTowerBattleWaves, towerEncounterLevel } from "./battle-waves";
import { addCombatToRunReport } from "./run-report";

function fighter(id: string, ownerId: string, stats: Partial<LeagueMascot> = {}): LeagueMascot {
  return { id, ownerId, pokemonId: 25, types: ["NORMAL"], name: id, level: 20,
    force: 30, agility: 30, instinct: 20, vitality: 20, charisma: 20,
    hp: 100, combatRole: "ATTACKER", slot: 1, ...stats };
}

test("one solo battle resolves two waves and reports all four mascots once", () => {
  const active = [fighter("a1", "owner", { hp: 8, force: 2, agility: 1 }), fighter("a2", "owner", { hp: 8, force: 2, agility: 1, slot: 2 })];
  const reserves = [fighter("r1", "owner", { hp: 300, force: 120, agility: 50 }), fighter("r2", "owner", { hp: 300, force: 120, agility: 50, slot: 2 })];
  const enemies = [fighter("enemy", "TORRE", { hp: 700, force: 50 })];
  const result = resolveTowerBattle({ active, reserves, enemies, random: () => 0.5 });
  assert.equal(result.battle.reserveEntered, true);
  assert.deepEqual(result.battle.lineupA.map((entry) => entry.id), ["a1", "a2"]);
  assert.deepEqual(result.battle.reserveLineupA?.map((entry) => entry.id), ["r1", "r2"]);
  assert.deepEqual(Object.keys(result.hpByMascotId).sort(), ["a1", "a2", "r1", "r2"]);
  assert.ok(result.enemyHpById.enemy < enemies[0].hp);
  const report = addCombatToRunReport(undefined, [...active, ...reserves], enemies, result.battle.log, false, result.battle.winner === "A");
  assert.deepEqual(Object.keys(report.mascots).sort(), ["a1", "a2", "r1", "r2"]);
});

test("group and legacy fights have no reserve stage", () => {
  const active = [fighter("a1", "owner"), fighter("a2", "owner", { slot: 2 })];
  const enemy = [fighter("enemy", "TORRE")];
  const result = resolveTowerBattle({ active, reserves: [], enemies: enemy, random: () => 0.5 });
  assert.equal(result.battle.reserveEntered, undefined);
  assert.equal(result.battle.reserveLineupA, undefined);
  assert.deepEqual(Object.keys(result.hpByMascotId).sort(), ["a1", "a2"]);
});

test("V2 solo, group and legacy select only their own present formation", () => {
  const entries = [
    { fighter: fighter("a1", "host", { hp: 0 }), formationSlot: 1 },
    { fighter: fighter("a2", "host"), formationSlot: 2 },
    { fighter: fighter("r1", "host"), formationSlot: 3 },
    { fighter: fighter("r2", "host"), formationSlot: 4 },
  ];
  const solo = selectTowerBattleWaves("SOLO", 2, entries);
  assert.deepEqual(solo.active.map((entry) => entry.id), ["a1", "a2"]);
  assert.deepEqual(solo.reserves.map((entry) => entry.id), ["r1", "r2"]);
  const group = selectTowerBattleWaves("GROUP", 2, entries.slice(0, 2));
  assert.deepEqual(group.active.map((entry) => entry.id), ["a2"]);
  assert.deepEqual(group.reserves, []);
  const legacy = selectTowerBattleWaves(null, null, entries.slice(0, 2).map((entry) => ({ ...entry, formationSlot: null })));
  assert.deepEqual(legacy.active.map((entry) => entry.id), ["a2"]);
  assert.deepEqual(legacy.reserves, []);
});

test("solo enemy level follows only living active mascots, never low-level reserves", () => {
  const waves = selectTowerBattleWaves("SOLO", 2, [
    { fighter: fighter("a1", "owner", { level: 70 }), formationSlot: 1 },
    { fighter: fighter("a2", "owner", { level: 70 }), formationSlot: 2 },
    { fighter: fighter("r1", "owner", { level: 1 }), formationSlot: 3 },
    { fighter: fighter("r2", "owner", { level: 1 }), formationSlot: 4 },
  ]);
  assert.equal(towerEncounterLevel(waves.active), 70);
  assert.equal(towerEncounterLevel([fighter("a1", "owner", { level: 50 }), fighter("a2", "owner", { level: 70 })]), 60);
});

test("Guardian interception changes authoritative HP between Tower rooms", () => {
  const active = [fighter("guard", "owner", { name: "Guardião", hp: 240, combatRole: "GUARDIAN", vitality: 95, charisma: 95 }),
    fighter("ally", "owner", { hp: 240, force: 60, slot: 2 })];
  const enemies = [fighter("enemy", "TORRE", { hp: 900, force: 95, agility: 90 })];
  const resolved = resolveTowerBattle({ active, reserves: [], enemies, random: () => 0.5 });
  assert.ok(resolved.battle.log.some((entry) => entry.effect?.includes("Guardião Guardião absorveu")));
  assert.ok(resolved.battle.log.some((entry) => entry.guardianIntercept?.mascotId === "guard"));
  assert.ok(resolved.battle.finalHpById);
  assert.equal(resolved.hpByMascotId.guard, resolved.battle.finalHpById.guard);
  assert.equal(resolved.enemyHpById.enemy, resolved.battle.finalHpById.enemy);
});

test("a Tower defeat at the round cap preserves survivors for the next player decision", () => {
  const active = [fighter("stalled", "owner", { hp: 1000, force: 1, agility: 1, instinct: 1, vitality: 300 })];
  const enemies = [fighter("wall", "TORRE", { hp: 3000, force: 1, agility: 1, instinct: 1, vitality: 300 })];
  const result = resolveTowerBattle({ active, reserves: [], enemies, random: () => 0.5, requireEnemyKnockout: true });
  assert.equal(result.battle.winner, "B");
  assert.equal(result.battle.rounds, 150);
  assert.equal(result.hpByMascotId.stalled, 850);
  assert.equal(result.battle.finalHpById?.stalled, 850);
  assert.equal(result.battle.teamASurvivors, 1);
});

test("V2 cannot clear a Tower room by HP lead while defenders survive; legacy keeps its result", () => {
  const active = [fighter("bulky", "owner", { hp: 10000, force: 1, agility: 1, instinct: 1, vitality: 300 })];
  const enemies = [fighter("wall", "TORRE", { hp: 3000, force: 1, agility: 1, instinct: 1, vitality: 300 })];
  const input = { active, reserves: [], enemies, random: () => 0.5 };
  const legacy = resolveTowerBattle(input);
  const v2 = resolveTowerBattle({ ...input, requireEnemyKnockout: true });
  assert.equal(legacy.battle.winner, "A");
  assert.equal(v2.battle.winner, "B");
  assert.ok(v2.enemyHpById.wall > 0);
  assert.ok(v2.hpByMascotId.bulky > 0);
});

test("undeployed solo reserves remain intact when the round cap ends the encounter", () => {
  const active = [fighter("a1", "owner", { hp: 1000, force: 1, agility: 1, instinct: 1, vitality: 300 }),
    fighter("a2", "owner", { hp: 1000, force: 1, agility: 1, instinct: 1, vitality: 300 })];
  const reserves = [fighter("r1", "owner", { hp: 500 }), fighter("r2", "owner", { hp: 500 })];
  const enemies = [fighter("wall", "TORRE", { hp: 3000, force: 1, agility: 1, instinct: 1, vitality: 300 })];
  const result = resolveTowerBattle({ active, reserves, enemies, random: () => 0.5, requireEnemyKnockout: true });
  assert.equal(result.battle.rounds, 180);
  assert.equal(result.battle.reserveEntered, false);
  assert.equal(result.hpByMascotId.r1, 500);
  assert.equal(result.hpByMascotId.r2, 500);
  assert.ok(result.battle.log.every((entry) => entry.targetId !== "r1" && entry.targetId !== "r2"));
});
