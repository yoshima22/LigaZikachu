import assert from "node:assert/strict";
import { test } from "node:test";
import { newExpeditionState } from "./expedition-state";
import { moveMember } from "./route-rules";
import { generateTowerRoomGraph } from "./rooms";
import { canStartBoss, groupActiveMembersByRoom, resolveRoomFront } from "./room-resolver";

function fronts() {
  const source = generateTowerRoomGraph("separate-fronts");
  const entrance = source.graph.find((room) => room.id === "entrance")!;
  const [firstId, secondId] = entrance.connections;
  const state = newExpeditionState({
    ...source,
    graph: source.graph.map((room) =>
      room.id === firstId || room.id === secondId ? { ...room, kind: "COMBAT" as const } : room),
  }, ["ana", "bruno", "caio"]);
  return {
    firstId,
    secondId,
    state: moveMember(moveMember(state, "ana", firstId), "bruno", secondId),
  };
}

test("ordinary room combat includes only active trainers physically present", () => {
  const { state, firstId, secondId } = fronts();
  const groups = groupActiveMembersByRoom(state);
  assert.deepEqual(groups.get(firstId), ["ana"]);
  assert.deepEqual(groups.get(secondId), ["bruno"]);
  let participants: string[] = [];
  const result = resolveRoomFront(state, firstId, [{ memberId: "ana", action: "FIGHT" }], ({ memberIds }) => {
    participants = memberIds;
    return { won: true, hpByMascotId: { "ana-mascot": 12 }, events: ["Ana venceu"], kos: ["enemy-1"], replay: { winner: "A", log: [] } };
  });
  assert.deepEqual(participants, ["ana"]);
  assert.equal(result.state.rooms[firstId].cleared, true);
  assert.equal(result.state.rooms[secondId].cleared, false);
  assert.deepEqual(result.hpByMascotId, { "ana-mascot": 12 });
  assert.deepEqual(result.kos, ["enemy-1"]);
  assert.deepEqual(result.state.rooms[firstId].replay, { winner: "A", log: [] });
});

test("resolving two fronts in sequence keeps each room's replay and HP separate", () => {
  const { state, firstId, secondId } = fronts();
  const first = resolveRoomFront(state, firstId, [{ memberId: "ana", action: "FIGHT" }], () =>
    ({ won: true, hpByMascotId: { "ana-mascot": 8 }, events: [], kos: [], replay: { winner: "A", log: ["first"] } }));
  const second = resolveRoomFront(first.state, secondId, [{ memberId: "bruno", action: "FIGHT" }], () =>
    ({ won: false, hpByMascotId: { "bruno-mascot": 0 }, events: [], kos: [], replay: { winner: "B", log: ["second"] } }));
  assert.deepEqual(first.hpByMascotId, { "ana-mascot": 8 });
  assert.deepEqual(second.hpByMascotId, { "bruno-mascot": 0 });
  assert.deepEqual(second.state.rooms[firstId].replay, { winner: "A", log: ["first"] });
  assert.deepEqual(second.state.rooms[secondId].replay, { winner: "B", log: ["second"] });
  assert.equal(second.state.rooms[firstId].cleared, true);
  assert.equal(second.state.rooms[secondId].cleared, false);
});

test("boss waits for living distant trainers but ignores downed or AFK members", () => {
  const { state, firstId } = fronts();
  state.members.ana.roomId = "boss";
  assert.deepEqual(canStartBoss(state, "boss"), { allowed: false, missingMemberIds: ["bruno", "caio"] });
  state.members.bruno.status = "DOWNED";
  state.members.caio.status = "AFK_ABANDONED";
  assert.deepEqual(canStartBoss(state, "boss"), { allowed: true, missingMemberIds: [] });
  let called = false;
  const result = resolveRoomFront(state, "boss", [{ memberId: "ana", action: "FIGHT" }], () => {
    called = true;
    return { won: true, hpByMascotId: {}, events: [], kos: [] };
  });
  assert.equal(called, true);
  assert.equal(result.state.rooms.boss.cleared, true);
  assert.equal(state.rooms[firstId].cleared, false);
});

test("boss adapter is not called while an active ally is distant", () => {
  const { state } = fronts();
  state.members.ana.roomId = "boss";
  const result = resolveRoomFront(state, "boss", [{ memberId: "ana", action: "FIGHT" }], () => {
    throw new Error("must not fight");
  });
  assert.equal(result.state.rooms.boss.cleared, false);
  assert.deepEqual(result.blockedBy, ["bruno", "caio"]);
});

test("boss stays locked while another occupied room has an unresolved encounter", () => {
  const { state, firstId } = fronts();
  for (const member of Object.values(state.members)) member.roomId = "boss";
  state.rooms[firstId].encounter = { preparationTurns: 1, enemies: [{ pokemonId: 92, name: "Gastly", level: 5 }] };
  assert.equal(canStartBoss(state, "boss").allowed, false);
  state.rooms[firstId].cleared = true;
  assert.equal(canStartBoss(state, "boss").allowed, true);
});

test("a wrong puzzle choice opens the route but records a mistake only for that front", () => {
  const { state, firstId, secondId } = fronts();
  const room = state.graph.find((entry) => entry.id === firstId)!;
  room.kind = "PUZZLE";
  room.puzzle = { id: "test", prompt: "Escolha", options: [{ id: "right", label: "Correta" }, { id: "wrong", label: "Errada" }], answer: "right", discovery: "Pista" };
  const result = resolveRoomFront(state, firstId, [{ memberId: "ana", puzzleChoice: "wrong" }], () => {
    throw new Error("puzzle must not call combat");
  });
  assert.equal(result.state.rooms[firstId].cleared, true);
  assert.equal(result.state.rooms[secondId].cleared, false);
  assert.equal(result.mistakes, 1);
  assert.equal(result.interaction, null);
});

test("rest and rescue interactions clear only the occupied room", () => {
  const { state, firstId, secondId } = fronts();
  state.graph.find((entry) => entry.id === firstId)!.kind = "REST";
  state.graph.find((entry) => entry.id === secondId)!.kind = "RESCUE";
  const rest = resolveRoomFront(state, firstId, [{ memberId: "ana", action: "INTERACT" }], () => {
    throw new Error("rest must not call combat");
  });
  assert.equal(rest.interaction, "REST");
  assert.equal(rest.state.rooms[firstId].cleared, true);
  assert.equal(rest.state.rooms[secondId].cleared, false);
  const rescue = resolveRoomFront(rest.state, secondId, [{ memberId: "bruno", action: "RESOLVE_ROOM" }], () => {
    throw new Error("rescue must not call combat");
  });
  assert.equal(rescue.interaction, "RESCUE");
  assert.equal(rescue.state.rooms[secondId].cleared, true);
});
