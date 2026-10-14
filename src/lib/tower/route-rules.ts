import type { TowerExpeditionV2 } from "./expedition-state";
import { towerRouteKey } from "./rooms";

export function towerKnownExits(state: TowerExpeditionV2, roomId: string): string[] {
  const room = state.graph.find((entry) => entry.id === roomId);
  if (!room) return [];
  const returnRoutes = state.openedEdges.flatMap((edge) => {
    const [first, second] = edge.split("::");
    return first === roomId ? [second] : second === roomId ? [first] : [];
  });
  return [...new Set([...room.connections, ...returnRoutes])];
}

export function towerCanLeaveRoom(state: TowerExpeditionV2, roomId: string): boolean {
  if (state.rooms[roomId]?.cleared) return true;
  const room = state.graph.find((entry) => entry.id === roomId);
  // Returning from the boss chamber is always legal. Boss eligibility may
  // change as other simultaneous submissions move, so it cannot gate a
  // previously confirmed route choice.
  return room?.kind === "BOSS";
}

export type TowerRouteErrorCode =
  | "INVALID_MEMBER"
  | "INACTIVE_MEMBER"
  | "UNKNOWN_ROOM"
  | "ROOM_UNCLEARED"
  | "ROUTE_CLOSED";

export class TowerRouteError extends Error {
  constructor(public readonly code: TowerRouteErrorCode, message: string) {
    super(message);
    this.name = "TowerRouteError";
  }
}

export function moveMember(
  state: TowerExpeditionV2,
  memberId: string,
  destinationId: string,
): TowerExpeditionV2 {
  const member = state.members[memberId];
  if (!member) throw new TowerRouteError("INVALID_MEMBER", "Treinador não participa da expedição.");
  if (member.status !== "ACTIVE" || member.availableFromTurn > state.globalTurn)
    throw new TowerRouteError("INACTIVE_MEMBER", "Este treinador não pode agir nesta janela.");
  const current = state.graph.find((room) => room.id === member.roomId);
  const destination = state.graph.find((room) => room.id === destinationId);
  if (!current || !destination || !state.rooms[destinationId])
    throw new TowerRouteError("UNKNOWN_ROOM", "Sala desconhecida no mapa.");
  if (!towerCanLeaveRoom(state, current.id))
    throw new TowerRouteError("ROOM_UNCLEARED", "Conclua o encontro desta sala antes de sair.");
  const edge = towerRouteKey(current.id, destinationId);
  if (!current.connections.includes(destinationId) && !state.openedEdges.includes(edge))
    throw new TowerRouteError("ROUTE_CLOSED", "Não há uma passagem aberta entre estas salas.");

  return {
    ...state,
    members: {
      ...state.members,
      [memberId]: { ...member, roomId: destinationId },
    },
    rooms: {
      ...state.rooms,
      [destinationId]: {
        ...state.rooms[destinationId],
        visitedBy: [...new Set([...state.rooms[destinationId].visitedBy, memberId])],
      },
    },
    openedEdges: state.openedEdges.includes(edge) ? state.openedEdges : [...state.openedEdges, edge],
    visited: state.visited.includes(destinationId) ? state.visited : [...state.visited, destinationId],
  };
}

/** Only already-traversed corridors are promised as a reunion route. */
export function shortestKnownPath(
  state: TowerExpeditionV2,
  fromRoomId: string,
  toRoomId: string,
): string[] | null {
  const ids = new Set(state.graph.map((room) => room.id));
  if (!ids.has(fromRoomId) || !ids.has(toRoomId)) return null;
  if (fromRoomId === toRoomId) return [fromRoomId];
  const queue: string[][] = [[fromRoomId]];
  const visited = new Set([fromRoomId]);
  while (queue.length) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    for (const edge of state.openedEdges) {
      const [first, second] = edge.split("::");
      const next = first === last ? second : second === last ? first : null;
      if (!next || visited.has(next)) continue;
      const nextPath = [...path, next];
      if (next === toRoomId) return nextPath;
      visited.add(next);
      queue.push(nextPath);
    }
  }
  return null;
}
