import assert from "node:assert/strict";
import { test } from "node:test";
import { newExpeditionState } from "./expedition-state";
import { projectExpeditionForMember } from "./expedition-projection";
import { generateTowerRoomGraph } from "./rooms";

function sample() {
  const state = newExpeditionState(generateTowerRoomGraph("projection-seed"), ["ana", "bruno", "caio"]);
  const entrance = state.graph.find((room) => room.kind === "ENTRANCE")!;
  const next = state.graph.find((room) => entrance.connections.includes(room.id))!;
  state.members.bruno.roomId = next.id;
  state.rooms[next.id].visitedBy.push("bruno");
  state.visited.push(next.id);
  state.members.caio.status = "DOWNED";
  return { state, entrance, next };
}

test("distant ally is identified by name and room; downed is distinct", () => {
  const { state, next } = sample();
  const view = projectExpeditionForMember(state, "ana", { bruno: "Bruno", caio: "Caio" });
  assert.equal(view.mine.roomId, state.members.ana.roomId);
  assert.equal(view.members.find((member) => member.id === "bruno")?.name, "Bruno");
  assert.equal(view.members.find((member) => member.id === "bruno")?.roomId, next.id);
  assert.equal(view.members.find((member) => member.id === "bruno")?.separated, true);
  assert.equal(view.members.find((member) => member.id === "caio")?.status, "DOWNED");
});

test("current, next and blocked routes have separate states", () => {
  const { state, entrance, next } = sample();
  const initial = projectExpeditionForMember(state, "ana");
  assert.equal(initial.rooms.find((room) => room.id === entrance.id)?.role, "CURRENT");
  assert.equal(initial.routes.find((route) => route.id === next.id)?.role, "NEXT");
  state.rooms[entrance.id].cleared = false;
  const locked = projectExpeditionForMember(state, "ana");
  assert.equal(locked.routes.find((route) => route.id === next.id)?.role, "BLOCKED");
  assert.match(locked.routes.find((route) => route.id === next.id)?.blockedReason ?? "", /sala/i);
});

test("hidden rooms reveal neither enemy nor title and boss gate names only living absentees", () => {
  const { state } = sample();
  const hidden = state.graph.find((room) => !state.visited.includes(room.id) && !state.graph.find((r) => r.id === state.members.ana.roomId)?.connections.includes(room.id))!;
  const view = projectExpeditionForMember(state, "ana", { bruno: "Bruno", caio: "Caio" });
  const node = view.rooms.find((room) => room.id === hidden.id)!;
  assert.equal(node.title, "Sala desconhecida");
  assert.equal(node.kind, "UNKNOWN");
  assert.equal("enemies" in node, false);
  const boss = state.graph.find((room) => room.kind === "BOSS")!;
  state.members.ana.roomId = boss.id;
  const atBoss = projectExpeditionForMember(state, "ana", { bruno: "Bruno", caio: "Caio" });
  assert.deepEqual(atBoss.bossGate?.missingNames, ["Bruno"]);
});

test("a distant trainer sees a known next corridor toward the waiting boss", () => {
  const { state, entrance } = sample();
  const boss = state.graph.find((room) => room.kind === "BOSS")!;
  state.members.bruno.roomId = boss.id;
  const queue = [[entrance.id]];
  let path: string[] = [];
  while (queue.length) {
    const candidate = queue.shift()!;
    if (candidate.at(-1) === boss.id) { path = candidate; break; }
    for (const next of state.graph.find((room) => room.id === candidate.at(-1))!.connections)
      if (!candidate.includes(next)) queue.push([...candidate, next]);
  }
  for (let index = 1; index < path.length; index++)
    state.openedEdges.push([path[index - 1], path[index]].sort().join("::"));
  const view = projectExpeditionForMember(state, "ana", { bruno: "Bruno" });
  assert.equal(view.rendezvous?.waitingAtBoss, "Bruno");
  assert.equal(view.rendezvous?.nextRoomId, path[1]);
});

test("a blocked boss offers the previously opened return route", () => {
  const { state, entrance, next } = sample();
  const boss = state.graph.find((room) => room.kind === "BOSS")!;
  state.members.ana.roomId = boss.id;
  state.openedEdges = [[boss.id, next.id].sort().join("::")];
  state.rooms[next.id].encounter = { preparationTurns: 1, enemies: [] };
  const view = projectExpeditionForMember(state, "ana");
  assert.equal(view.bossGate?.allowed, false);
  assert.equal(view.routes.find((route) => route.id === next.id)?.available, true);
  assert.equal(view.routes.find((route) => route.id === entrance.id)?.available, undefined);
});

test("banked boss advantage is projected without exposing hidden rooms", () => {
  const { state } = sample();
  state.bossOverloadCharge = 0.08;
  const view = projectExpeditionForMember(state, "ana");
  assert.equal(view.bossAdvantage.percent, 8);
  assert.equal(view.bossAdvantage.available, true);
  state.bossOverloadCharge = 0;
  assert.equal(projectExpeditionForMember(state, "ana").bossAdvantage.available, false);
});
