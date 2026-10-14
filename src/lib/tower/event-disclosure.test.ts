import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTowerEntryStatus, buildTowerEventDisclosure } from "./event-disclosure";

test("ticket requirement, count and consumption are explicit before Ready", () => {
  const view = buildTowerEventDisclosure({ requireTicket: true }, { ticketCount: 2, reviveKitCount: 1 });
  assert.equal(view.ticket.required, true);
  assert.equal(view.ticket.count, 2);
  assert.equal(view.ticket.consumedAt, "RUN_START");
  assert.match(view.ticket.explanation, /cada jogador.*1.*inici/i);
  assert.equal(view.recovery.kitCount, 1);
  assert.match(view.recovery.roomCooldown, /2 andares/i);
});

test("disabled ticket requirement is never described as mandatory", () => {
  const view = buildTowerEventDisclosure({ requireTicket: false }, { ticketCount: 0, reviveKitCount: 0 });
  assert.equal(view.ticket.required, false);
  assert.equal(view.ticket.consumedAt, "NEVER");
  assert.doesNotMatch(view.ticket.explanation, /obrigat[oó]rio|precisa|gasta 1/i);
});

test("unconfigured chests are prospective, not live drops with invented percentages", () => {
  const view = buildTowerEventDisclosure({ requireTicket: true }, { ticketCount: 0, reviveKitCount: 0 });
  assert.equal(view.chests.length, 2);
  assert.deepEqual(view.chests.map((chest) => [chest.name, chest.source, chest.active, chest.results]), [
    ["Doces", "Liga Semanal", false, []], ["Travessuras", "Liga Rush", false, []],
  ]);
  assert.doesNotMatch(JSON.stringify(view), /\d+%/);
  assert.match(view.floorLoot.rule, /chefe/i);
  assert.match(view.floorLoot.failure, /perd/i);
});

test("entry status identifies who lacks a required ticket without blocking disabled mode", () => {
  const members = [{ userId: "a", count: 1 }, { userId: "b", count: 0 }];
  assert.deepEqual(buildTowerEntryStatus(true, members), { required: true, missingUserIds: ["b"], canStart: false });
  assert.deepEqual(buildTowerEntryStatus(false, members), { required: false, missingUserIds: [], canStart: true });
});
