import assert from "node:assert/strict";
import { test } from "node:test";
import { newExpeditionState } from "./expedition-state";
import { generateTowerRoomGraph } from "./rooms";
import { advanceV2Turn, canResolveV2Turn, validateV2Submission } from "./turn-v2-rules";

function state() {
  return newExpeditionState(generateTowerRoomGraph("global-turn"), ["ana", "bruno", "caio"]);
}

function submission(memberId: string, globalTurn = 1, roomId = "entrance") {
  return { memberId, globalTurn, roomId, actions: { action: "SKIP" } };
}

test("turn waits for every active confirmation before deadline", () => {
  const current = state();
  const partial = { ana: submission("ana") };
  assert.equal(canResolveV2Turn(current, partial, false), false);
  assert.equal(canResolveV2Turn(current, partial, true), true);
  assert.equal(canResolveV2Turn(current, { ...partial, bruno: submission("bruno"), caio: submission("caio") }, false), true);
});

test("submission rejects stale turn, wrong room, downed member and duplicate confirmation", () => {
  const current = state();
  assert.deepEqual(validateV2Submission(current, submission("ana", 0)), { ok: false, code: "STALE_TURN" });
  assert.deepEqual(validateV2Submission(current, submission("ana", 1, "boss")), { ok: false, code: "WRONG_ROOM" });
  current.members.bruno.status = "DOWNED";
  assert.deepEqual(validateV2Submission(current, submission("bruno")), { ok: false, code: "INACTIVE_MEMBER" });
  current.members.ana.confirmedTurn = 1;
  assert.deepEqual(validateV2Submission(current, submission("ana")), { ok: false, code: "ALREADY_CONFIRMED" });
});

test("first missed window applies defense, second removes AFK member without blocking others", () => {
  const first = advanceV2Turn(state(), { ana: submission("ana"), caio: submission("caio") }, 1, true)!;
  assert.equal(first.state.members.bruno.status, "ACTIVE");
  assert.equal(first.state.members.bruno.consecutiveMisses, 1);
  assert.deepEqual(first.defensiveMemberIds, ["bruno"]);
  assert.deepEqual(first.abandonedMemberIds, []);
  const second = advanceV2Turn(first.state, { ana: submission("ana", 2), caio: submission("caio", 2) }, 2, true)!;
  assert.equal(second.state.members.bruno.status, "AFK_ABANDONED");
  assert.deepEqual(second.abandonedMemberIds, ["bruno"]);
  assert.equal(canResolveV2Turn(second.state, { ana: submission("ana", 3), caio: submission("caio", 3) }, false), true);
});

test("confirmation between absences resets the consecutive miss count", () => {
  const first = advanceV2Turn(state(), { ana: submission("ana"), caio: submission("caio") }, 1, true)!;
  const confirmed = advanceV2Turn(first.state, {
    ana: submission("ana", 2), bruno: submission("bruno", 2), caio: submission("caio", 2),
  }, 2, false)!;
  assert.equal(confirmed.state.members.bruno.consecutiveMisses, 0);
  const missedAgain = advanceV2Turn(confirmed.state, { ana: submission("ana", 3), caio: submission("caio", 3) }, 3, true)!;
  assert.equal(missedAgain.state.members.bruno.status, "ACTIVE");
  assert.equal(missedAgain.state.members.bruno.consecutiveMisses, 1);
});

test("two serialized attempts for the same global turn apply effects once", async () => {
  let persisted = state();
  let chain = Promise.resolve();
  const attempt = () => {
    const run = chain.then(() => {
      const result = advanceV2Turn(persisted, { ana: submission("ana"), bruno: submission("bruno"), caio: submission("caio") }, 1, false);
      if (result) persisted = result.state;
      return result;
    });
    chain = run.then(() => undefined);
    return run;
  };
  const [first, second] = await Promise.all([attempt(), attempt()]);
  assert.ok(first);
  assert.equal(second, null);
  assert.equal(persisted.globalTurn, 2);
});

test("confirmed routes move each trainer independently during one global turn", () => {
  const current = state();
  const entrance = current.graph.find((room) => room.id === "entrance")!;
  const [leftId, rightId] = entrance.connections;
  const result = advanceV2Turn(current, {
    ana: { ...submission("ana"), actions: { routeId: leftId } },
    bruno: { ...submission("bruno"), actions: { routeId: rightId } },
    caio: submission("caio"),
  }, 1, false)!;
  assert.equal(result.state.members.ana.roomId, leftId);
  assert.equal(result.state.members.bruno.roomId, rightId);
  assert.equal(result.state.members.caio.roomId, "entrance");
  assert.equal(result.state.globalTurn, 2);
});

test("boss arrival cannot invalidate another trainer's confirmed return", () => {
  const current = state();
  const approach = current.graph.find((room) => room.connections.includes("boss"))!;
  current.members.ana.roomId = approach.id;
  current.members.bruno.roomId = "boss";
  current.members.caio.status = "DOWNED";
  current.rooms[approach.id].cleared = true;
  current.openedEdges.push([approach.id, "boss"].sort().join("::"));
  const result = advanceV2Turn(current, {
    ana: { ...submission("ana", 1, approach.id), actions: { routeId: "boss" } },
    bruno: { ...submission("bruno", 1, "boss"), actions: { routeId: approach.id } },
  }, 1, false)!;
  assert.equal(result.state.members.ana.roomId, "boss");
  assert.equal(result.state.members.bruno.roomId, approach.id);
});
