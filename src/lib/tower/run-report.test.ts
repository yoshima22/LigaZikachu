import assert from "node:assert/strict";
import { test } from "node:test";
import type { LeagueMascot } from "@/lib/league-combat";
import { addCombatToRunReport, recordRecoveryInReport, recordRoomClearedInReport } from "./run-report";

const ally: LeagueMascot = { id: "ally", ownerId: "ana", pokemonId: 25, types: ["electric"], name: "Pikachu", level: 70,
  force: 200, agility: 200, instinct: 200, vitality: 200, charisma: 200, hp: 100, combatRole: "ATTACKER", slot: 1 };
const enemy: LeagueMascot = { ...ally, id: "enemy", ownerId: "TORRE", name: "Defensor", hp: 80 };

test("V2 combat contributes damage, KO and boss totals without mutating the previous report", () => {
  const log = [{ actorId: "ally", actorOwnerId: "ana", actorName: "Pikachu", targetId: "enemy", targetOwnerId: "TORRE", action: "ATTACK", damage: 90 }];
  const first = addCombatToRunReport(undefined, [ally], [enemy], log, false, true);
  const second = addCombatToRunReport(first, [ally], [enemy], log, true, true);
  assert.equal(first.mascots.ally.damageDealt, 90);
  assert.equal(first.mascots.ally.kos, 1);
  assert.equal(second.mascots.ally.damageDealt, 180);
  assert.equal(second.mascots.ally.kos, 2);
  assert.equal(second.roomsCleared, 2);
  assert.equal(second.bossesDefeated, 1);
});

test("reviving a fallen trainer appears in the final report", () => {
  const report = recordRecoveryInReport(undefined);
  assert.equal(report.alliesRecovered, 1);
  assert.equal(recordRecoveryInReport(report).alliesRecovered, 2);
  assert.equal(report.alliesRecovered, 1);
});

test("clearing a noncombat room contributes to the final room count", () => {
  const report = recordRoomClearedInReport(undefined);
  assert.equal(report.roomsCleared, 1);
  assert.equal(recordRoomClearedInReport(report).roomsCleared, 2);
  assert.equal(report.roomsCleared, 1);
});

test("damage received accounts for health restored between attacks", () => {
  const log = [
    { actorId: "enemy", actorOwnerId: "TORRE", actorName: "Defensor", targetId: "ally", targetOwnerId: "ana", action: "ATTACK", damage: 80 },
    { actorId: "ally", actorOwnerId: "ana", actorName: "Pikachu", targetId: "ally", targetOwnerId: "ana", action: "HEAL", damage: 50 },
    { actorId: "enemy", actorOwnerId: "TORRE", actorName: "Defensor", targetId: "ally", targetOwnerId: "ana", action: "ATTACK", damage: 80 },
  ];
  const report = addCombatToRunReport(undefined, [ally], [enemy], log, false, false);
  assert.equal(report.mascots.ally.damageReceived, 150);
  assert.equal(report.mascots.ally.healing, 50);
});
