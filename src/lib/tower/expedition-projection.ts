import type { TowerExpeditionV2 } from "./expedition-state";
import { canUseRecoveryRoom } from "./recovery-rules";
import { bossOverloadValue } from "./pressure-rules";
import { canStartBoss } from "./room-resolver";
import { shortestKnownPath, towerCanLeaveRoom, towerKnownExits } from "./route-rules";
import { towerRouteKey, type TowerRoomKind } from "./rooms";

export type TowerRunProjection = ReturnType<typeof projectExpeditionForMember>;

/** Player-scoped view. Never use V1's shared currentRoomId to infer a V2 player's position. */
export function projectExpeditionForMember(
  state: TowerExpeditionV2,
  viewerId: string,
  names: Record<string, string> = {},
  floor = 1,
) {
  const mine = state.members[viewerId];
  if (!mine) throw new Error("Treinador não participa desta expedição.");
  const current = state.graph.find((room) => room.id === mine.roomId);
  if (!current) throw new Error("Sala atual ausente do mapa da Torre.");
  const roomState = state.rooms[current.id];
  const revealed = new Set([...state.visited, current.id]);
  const rooms = state.graph.map((room) => {
    const known = revealed.has(room.id) || Boolean(state.countermeasures?.includes("MAP"));
    return {
      id: room.id, x: room.x, y: room.y, connections: room.connections,
      title: known ? room.title : "Sala desconhecida",
      kind: (known ? room.kind : "UNKNOWN") as TowerRoomKind | "UNKNOWN",
      visited: revealed.has(room.id),
      cleared: state.rooms[room.id]?.cleared ?? false,
      role: room.id === current.id ? "CURRENT" as const : known ? "KNOWN" as const : "HIDDEN" as const,
    };
  });
  const routes = towerKnownExits(state, current.id).map((id) => {
    const destination = state.graph.find((room) => room.id === id)!;
    const known = revealed.has(id) || Boolean(state.countermeasures?.includes("MAP"));
    const traversable = current.connections.includes(id) || state.openedEdges.includes(towerRouteKey(current.id, id));
    const blockedReason = mine.status !== "ACTIVE" ? "Você não pode se mover neste turno."
      : mine.availableFromTurn > state.globalTurn ? "Aguarde o próximo turno após a recuperação."
      : !towerCanLeaveRoom(state, current.id) ? "Resolva a sala atual antes de sair."
      : !traversable ? "Passagem ainda fechada." : null;
    return {
      id, title: known ? destination.title : "Rota desconhecida",
      kind: (known ? destination.kind : "UNKNOWN") as TowerRoomKind | "UNKNOWN",
      visited: revealed.has(id), cleared: state.rooms[id]?.cleared ?? false,
      available: !blockedReason, blockedReason,
      role: blockedReason ? "BLOCKED" as const : "NEXT" as const,
    };
  });
  const members = Object.entries(state.members).map(([id, member]) => ({
    id, name: names[id] ?? id, roomId: member.roomId,
    roomTitle: revealed.has(member.roomId) ? state.graph.find((room) => room.id === member.roomId)?.title ?? "Sala desconhecida" : "Sala desconhecida",
    status: member.status,
    confirmed: member.confirmedTurn === state.globalTurn,
    misses: member.consecutiveMisses,
    separated: member.status === "ACTIVE" && member.roomId !== current.id,
    canAct: member.status === "ACTIVE" && member.availableFromTurn <= state.globalTurn,
  }));
  const boss = current.kind === "BOSS" ? canStartBoss(state, current.id) : null;
  const bossRoom = state.graph.find((room) => room.kind === "BOSS");
  const waitingMember = bossRoom && Object.entries(state.members).find(([, member]) =>
    member.status === "ACTIVE" && member.roomId === bossRoom.id);
  const knownPath = waitingMember && bossRoom && current.id !== bossRoom.id
    ? shortestKnownPath(state, current.id, bossRoom.id) : null;
  return {
    mine: { roomId: mine.roomId, status: mine.status, confirmed: mine.confirmedTurn === state.globalTurn, canAct: mine.status === "ACTIVE" && mine.availableFromTurn <= state.globalTurn },
    members, rooms, routes,
    currentRoom: {
      ...current,
      cleared: roomState?.cleared ?? false,
      encounter: roomState?.encounter ?? null,
      replay: roomState?.replay ?? null,
      lastOutcome: roomState?.lastOutcome ?? null,
    },
    bossGate: boss ? { allowed: boss.allowed, missingMemberIds: boss.missingMemberIds,
      missingNames: boss.missingMemberIds.map((id) => names[id] ?? id) } : null,
    rendezvous: waitingMember && knownPath && knownPath.length > 1
      ? { waitingAtBoss: names[waitingMember[0]] ?? waitingMember[0], nextRoomId: knownPath[1], steps: knownPath.length - 1 }
      : null,
    recoveryAvailability: {
      available: canUseRecoveryRoom(floor, state.lastRecoveryFloor),
      nextFloor: state.lastRecoveryFloor === null ? floor : state.lastRecoveryFloor + 2,
    },
    pressureExplanation: { value: state.pressure, lastChange: state.lastPressureChange?.applied ?? 0,
      reasons: state.lastPressureChange?.reasons ?? [], activeFronts: new Set(members.filter((member) => member.status === "ACTIVE").map((member) => member.roomId)).size },
    bossAdvantage: { percent: Math.round(bossOverloadValue(state) * 100), available: bossOverloadValue(state) > 0 },
    floorLoot: (state.rewardLedger ?? []).map((entry) => ({ id: entry.id, floor: entry.floor, label: entry.label, status: entry.status })),
  };
}
