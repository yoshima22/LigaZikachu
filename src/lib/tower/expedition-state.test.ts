import assert from "node:assert/strict";
import { test } from "node:test";
import { generateTowerRoomGraph } from "./rooms";
import { isExpeditionV2, newExpeditionState } from "./expedition-state";

test("new expedition places one to three active trainers at the entrance", () => {
  const graph = generateTowerRoomGraph("task-1");
  for (const ids of [["ana"], ["ana", "bruno"], ["ana", "bruno", "caio"]]) {
    const state = newExpeditionState(graph, ids);
    assert.equal(state.version, 2);
    assert.equal(state.globalTurn, 1);
    assert.deepEqual(Object.keys(state.members), ids);
    for (const id of ids) {
      assert.equal(state.members[id].roomId, "entrance");
      assert.equal(state.members[id].status, "ACTIVE");
      assert.equal(state.members[id].consecutiveMisses, 0);
    }
    assert.equal(state.rooms.entrance.cleared, true);
    assert.deepEqual(state.rooms.entrance.visitedBy, ids);
    assert.equal(state.rooms.boss.cleared, false);
    assert.ok(isExpeditionV2(state));
  }
});

test("room records do not share mutable objects with the source graph", () => {
  const graph = generateTowerRoomGraph("independent-rooms");
  const state = newExpeditionState(graph, ["ana", "bruno"]);
  state.rooms.entrance.visitedBy.push("caio");
  state.graph.find((room) => room.id === "entrance")!.cleared = false;
  assert.deepEqual(graph.visited, ["entrance"]);
  assert.equal(graph.graph.find((room) => room.id === "entrance")!.cleared, true);
  assert.deepEqual(state.rooms.boss.visitedBy, []);
});

test("V1 and incomplete V2 payloads are not treated as V2 expeditions", () => {
  const legacy = generateTowerRoomGraph("legacy");
  assert.equal(isExpeditionV2(legacy), false);
  assert.equal(isExpeditionV2({ ...legacy, version: 2 }), false);
  assert.equal(isExpeditionV2({ ...legacy, version: 2, members: {}, rooms: {} }), false);
  assert.equal(isExpeditionV2(null), false);
});

test("new expedition rejects a missing, duplicate or oversized party", () => {
  const graph = generateTowerRoomGraph("validation");
  assert.throws(() => newExpeditionState(graph, []));
  assert.throws(() => newExpeditionState(graph, ["ana", "ana"]));
  assert.throws(() => newExpeditionState(graph, ["a", "b", "c", "d"]));
});
