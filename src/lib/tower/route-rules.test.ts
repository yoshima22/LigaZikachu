import assert from "node:assert/strict";
import { test } from "node:test";
import { newExpeditionState } from "./expedition-state";
import { generateTowerRoomGraph } from "./rooms";
import { moveMember, shortestKnownPath, TowerRouteError } from "./route-rules";

function splitMap() {
  const source = generateTowerRoomGraph("split-routes");
  const entrance = source.graph.find((room) => room.id === "entrance")!;
  const [leftId, rightId] = entrance.connections;
  const left = source.graph.find((room) => room.id === leftId)!;
  const right = source.graph.find((room) => room.id === rightId)!;
  const boss = source.graph.find((room) => room.id === "boss")!;
  const secret = source.graph.find((room) => ![entrance.id, leftId, rightId, boss.id].includes(room.id))!;
  return {
    leftId,
    rightId,
    state: newExpeditionState({
      ...source,
      graph: [
        { ...entrance, connections: [leftId, rightId] },
        { ...left, connections: ["boss"] },
        { ...right, connections: ["boss"] },
        { ...boss, connections: [] },
        { ...secret, connections: [] },
      ],
    }, ["ana", "bruno"]),
    secretId: secret.id,
  };
}

test("trainers can split without majority routing and return on an opened edge", () => {
  const { state, leftId, rightId } = splitMap();
  const afterAna = moveMember(state, "ana", leftId);
  const split = moveMember(afterAna, "bruno", rightId);
  assert.equal(split.members.ana.roomId, leftId);
  assert.equal(split.members.bruno.roomId, rightId);
  assert.equal(state.members.ana.roomId, "entrance");
  assert.deepEqual(split.rooms[leftId].visitedBy, ["ana"]);
  assert.deepEqual(split.rooms[rightId].visitedBy, ["bruno"]);
  split.rooms[leftId].cleared = true;
  const returned = moveMember(split, "ana", "entrance");
  assert.equal(returned.members.ana.roomId, "entrance");
  assert.equal(returned.members.bruno.roomId, rightId);
});

test("hidden and non-adjacent connections cannot be used as teleports", () => {
  const { state, leftId, secretId } = splitMap();
  assert.throws(() => moveMember(state, "ana", secretId), (error) =>
    error instanceof TowerRouteError && error.code === "ROUTE_CLOSED");
  assert.throws(() => moveMember(state, "ana", "boss"), (error) =>
    error instanceof TowerRouteError && error.code === "ROUTE_CLOSED");
  const inLeft = moveMember(state, "ana", leftId);
  assert.throws(() => moveMember(inLeft, "ana", "boss"), (error) =>
    error instanceof TowerRouteError && error.code === "ROOM_UNCLEARED");
});

test("known shortest path points a distant trainer to the boss", () => {
  const { state, leftId, rightId } = splitMap();
  let current = moveMember(state, "ana", leftId);
  current.rooms[leftId].cleared = true;
  current = moveMember(current, "ana", "boss");
  current = moveMember(current, "bruno", rightId);
  assert.deepEqual(shortestKnownPath(current, rightId, "boss"), [rightId, "entrance", leftId, "boss"]);
  assert.equal(shortestKnownPath(current, rightId, "unknown"), null);
});
