import assert from "node:assert/strict";
import test from "node:test";
import { runLeagueCombat, type LeagueMascot } from "./league-combat";

function mascot(id: string, side: string, stats: Partial<LeagueMascot> = {}): LeagueMascot {
  return {
    id, ownerId: side, pokemonId: 25, types: ["NORMAL"], name: id,
    level: 20, force: 30, agility: 30, instinct: 20, vitality: 20,
    charisma: 20, hp: 100, combatRole: "ATTACKER", slot: 1, ...stats,
  };
}

function withFixedRandom<T>(fn: () => T): T {
  const previous = Math.random;
  Math.random = () => 0.5;
  try { return fn(); } finally { Math.random = previous; }
}

test("two reserves enter once after both actives fall without healing the enemy", () => {
  const active = [mascot("active-1", "A", { hp: 8, force: 2, agility: 1 }), mascot("active-2", "A", { hp: 8, force: 2, agility: 1, slot: 2 })];
  const reserve = [mascot("reserve-1", "A", { hp: 300, force: 120, agility: 50 }), mascot("reserve-2", "A", { hp: 300, force: 120, agility: 50, slot: 2 })];
  const enemy = [mascot("enemy", "B", { hp: 700, force: 50, agility: 30 })];
  const result = withFixedRandom(() => runLeagueCombat(active, enemy, null, [], [], { reserveTeamA: reserve }));
  const deployed = result.log.filter((entry) => entry.effect?.includes("Reservas da Torre entraram"));
  assert.equal(result.reserveEntered, true);
  assert.equal(deployed.length, 1);
  assert.deepEqual(result.lineupA.map((entry) => entry.id), ["active-1", "active-2"]);
  assert.deepEqual(result.reserveLineupA?.map((entry) => entry.id), ["reserve-1", "reserve-2"]);
  const deploymentIndex = result.log.indexOf(deployed[0]);
  assert.ok(result.log.slice(0, deploymentIndex).some((entry) => entry.actorId === "enemy"));
  assert.ok(result.log.slice(deploymentIndex + 1).some((entry) => entry.actorId === "reserve-1" || entry.actorId === "reserve-2"));
  assert.ok(result.log.slice(0, deploymentIndex).some((entry) => entry.actorId.startsWith("active-") && entry.targetId === "enemy" && entry.damage > 0));
});

test("zero-HP reserves cannot enter and cannot decide a capped fight by unused HP", () => {
  const active = [mascot("a1", "A", { hp: 5, agility: 1 }), mascot("a2", "A", { hp: 5, agility: 1 })];
  const reserve = [mascot("r1", "A", { hp: 999 }), mascot("r2", "A", { hp: 999 })];
  const enemy = [mascot("enemy", "B", { hp: 500, force: 90 })];
  const zero = withFixedRandom(() => runLeagueCombat(active, enemy, null, [], [], {
    reserveTeamA: reserve,
    startingHp: new Map([["r1", 0], ["r2", 0]]),
  }));
  assert.equal(zero.reserveEntered, false);
  assert.equal(zero.winner, "B");
  const capped = withFixedRandom(() => runLeagueCombat(active, enemy, null, [], [], {
    reserveTeamA: reserve,
    maxRounds: 1,
  }));
  assert.notEqual(capped.winner, "A");
});

test("without a bench the same seed keeps the legacy result and log", () => {
  const active = [mascot("a", "A")];
  const enemy = [mascot("b", "B")];
  const first = withFixedRandom(() => runLeagueCombat(active, enemy));
  const second = withFixedRandom(() => runLeagueCombat(active, enemy, null, [], [], {}));
  assert.deepEqual(second, first);
  assert.equal(second.reserveEntered, undefined);
});
