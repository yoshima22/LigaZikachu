import type { TowerExplorationState } from "./rooms";

export type TowerMemberState = "ACTIVE" | "DOWNED" | "AFK_ABANDONED";

export type TowerExpeditionMember = {
  roomId: string;
  status: TowerMemberState;
  consecutiveMisses: number;
  confirmedTurn: number | null;
  availableFromTurn: number;
};

export type TowerExpeditionRoom = {
  cleared: boolean;
  visitedBy: string[];
};

/** Persisted only for runs started after the V2 cutover. V1 JSON is never upgraded in place. */
export type TowerExpeditionV2 = TowerExplorationState & {
  version: 2;
  globalTurn: number;
  members: Record<string, TowerExpeditionMember>;
  rooms: Record<string, TowerExpeditionRoom>;
  lastRecoveryFloor: number | null;
};

export function newExpeditionState(
  source: TowerExplorationState,
  memberIds: string[],
): TowerExpeditionV2 {
  const ids = memberIds.map((id) => id.trim());
  if (ids.length < 1 || ids.length > 3 || ids.some((id) => !id) || new Set(ids).size !== ids.length)
    throw new Error("A expedição precisa de 1 a 3 jogadores distintos.");
  const entrance = source.graph.find((room) => room.kind === "ENTRANCE");
  if (!entrance) throw new Error("O mapa da Torre não possui entrada.");

  const graph = structuredClone(source.graph);
  const members = Object.fromEntries(ids.map((id) => [id, {
    roomId: entrance.id,
    status: "ACTIVE" as const,
    consecutiveMisses: 0,
    confirmedTurn: null,
    availableFromTurn: 1,
  }]));
  const rooms = Object.fromEntries(graph.map((room) => [room.id, {
    cleared: room.id === entrance.id,
    visitedBy: room.id === entrance.id ? [...ids] : [],
  }]));

  return {
    ...source,
    version: 2,
    graph,
    currentRoomId: entrance.id, // transitional V1 read-only projection; never authoritative for V2.
    visited: [entrance.id],
    globalTurn: 1,
    members,
    rooms,
    lastRecoveryFloor: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isExpeditionV2(value: unknown): value is TowerExpeditionV2 {
  if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.graph) ||
      !Number.isInteger(value.globalTurn) || Number(value.globalTurn) < 1 ||
      !isRecord(value.members) || !isRecord(value.rooms)) return false;
  const members = Object.entries(value.members);
  if (members.length < 1 || members.length > 3) return false;
  const roomIds = new Set<string>();
  for (const room of value.graph) {
    if (!isRecord(room) || typeof room.id !== "string") return false;
    const savedRoom = value.rooms[room.id];
    if (!isRecord(savedRoom) || typeof savedRoom.cleared !== "boolean" || !Array.isArray(savedRoom.visitedBy)) return false;
    roomIds.add(room.id);
  }
  if (!roomIds.size) return false;
  return members.every(([id, member]) =>
    Boolean(id) && isRecord(member) && typeof member.roomId === "string" &&
    roomIds.has(member.roomId) &&
    (member.status === "ACTIVE" || member.status === "DOWNED" || member.status === "AFK_ABANDONED") &&
    Number.isInteger(member.consecutiveMisses) && Number(member.consecutiveMisses) >= 0 &&
    (member.confirmedTurn === null || Number.isInteger(member.confirmedTurn)) &&
    Number.isInteger(member.availableFromTurn),
  );
}
