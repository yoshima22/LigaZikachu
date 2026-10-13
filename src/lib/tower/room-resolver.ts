import type { TowerExpeditionV2 } from "./expedition-state";
import type { TowerRoomNode } from "./rooms";

export type RoomFrontAction = {
  memberId: string;
  action?: string;
  puzzleChoice?: string;
};

export type RoomCombatInput = {
  roomId: string;
  room: TowerRoomNode;
  memberIds: string[];
  state: TowerExpeditionV2;
};

export type RoomCombatOutput = {
  won: boolean;
  hpByMascotId: Record<string, number>;
  events: string[];
  kos: string[];
  replay?: unknown;
};

export type RoomCombatAdapter = (input: RoomCombatInput) => RoomCombatOutput;

export type RoomFrontResult = {
  state: TowerExpeditionV2;
  roomId: string;
  participantIds: string[];
  events: string[];
  kos: string[];
  hpByMascotId: Record<string, number>;
  blockedBy: string[];
  success: boolean;
  mistakes: number;
  interaction: "REST" | "EVENT" | "LUCK" | "RESCUE" | null;
};

export function groupActiveMembersByRoom(state: TowerExpeditionV2): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const [id, member] of Object.entries(state.members)) {
    if (member.status !== "ACTIVE") continue;
    const group = groups.get(member.roomId) ?? [];
    group.push(id);
    groups.set(member.roomId, group);
  }
  return groups;
}

export function freezeRoomEncounter(
  state: TowerExpeditionV2,
  roomId: string,
  enemies: { pokemonId: number; name: string; level: number }[],
  preparationTurns: number,
): TowerExpeditionV2 {
  const room = state.graph.find((entry) => entry.id === roomId);
  if (!room || (room.kind !== "COMBAT" && room.kind !== "BOSS") ||
      !state.rooms[roomId] || state.rooms[roomId].cleared || state.rooms[roomId].encounter) return state;
  return {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: {
        ...state.rooms[roomId],
        encounter: { preparationTurns, enemies: enemies.map((enemy) => ({ ...enemy })) },
      },
    },
  };
}

export function canStartBoss(
  state: TowerExpeditionV2,
  bossRoomId: string,
): { allowed: boolean; missingMemberIds: string[] } {
  const missingMemberIds = Object.entries(state.members)
    .filter(([, member]) => member.status === "ACTIVE" && member.roomId !== bossRoomId)
    .map(([id]) => id);
  const boss = state.graph.find((room) => room.id === bossRoomId && room.kind === "BOSS");
  const pendingElsewhere = Object.entries(state.rooms).some(([roomId, room]) =>
    roomId !== bossRoomId && !room.cleared && Boolean(room.encounter));
  const activeCount = Object.values(state.members).filter((member) => member.status === "ACTIVE").length;
  return { allowed: Boolean(boss && activeCount && !missingMemberIds.length && !pendingElsewhere), missingMemberIds };
}

export function resolveRoomFront(
  state: TowerExpeditionV2,
  roomId: string,
  actions: RoomFrontAction[],
  combatAdapter: RoomCombatAdapter,
): RoomFrontResult {
  const room = state.graph.find((entry) => entry.id === roomId);
  if (!room || !state.rooms[roomId]) throw new Error(`Sala desconhecida: ${roomId}`);
  const participantIds = groupActiveMembersByRoom(state).get(roomId) ?? [];
  const eligible = participantIds.filter((id) => state.members[id].availableFromTurn <= state.globalTurn);
  const validActions = actions.filter((entry) => eligible.includes(entry.memberId));
  const empty = (blockedBy: string[] = []): RoomFrontResult => ({
    state, roomId, participantIds: eligible, events: [], kos: [], hpByMascotId: {}, blockedBy,
    success: false, mistakes: 0, interaction: null,
  });
  if (state.rooms[roomId].cleared || !eligible.length) return empty();
  if (room.kind === "BOSS") {
    const gate = canStartBoss(state, roomId);
    if (!gate.allowed) return empty(gate.missingMemberIds);
  }
  if (room.kind === "PUZZLE" && room.puzzle) {
    const chosen = validActions.find((entry) => entry.puzzleChoice)?.puzzleChoice;
    if (!chosen || !room.puzzle.options.some((option) => option.id === chosen)) return empty();
    const correct = chosen === room.puzzle.answer;
    return {
      ...empty(),
      state: { ...state, rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], cleared: true,
        lastOutcome: correct ? room.puzzle.discovery : "O mecanismo reagiu à escolha errada; a passagem abriu, mas a Pressão aumentará." } } },
      events: [correct ? room.puzzle.discovery : "Resposta incorreta: a passagem abriu sob risco."],
      success: correct,
      mistakes: correct ? 0 : 1,
    };
  }
  if (room.kind === "REST" || room.kind === "EVENT" || room.kind === "LUCK" || room.kind === "RESCUE") {
    const interact = validActions.some((entry) => entry.action === "INTERACT" || (room.kind === "RESCUE" && entry.action === "RESOLVE_ROOM"));
    const skip = validActions.some((entry) => entry.action === "SKIP");
    if (!interact && !skip) return empty();
    const interaction = interact ? room.kind : null;
    return {
      ...empty(),
      state: { ...state, rooms: { ...state.rooms, [roomId]: { ...state.rooms[roomId], cleared: true,
        lastOutcome: interact ? `${room.title}: interação concluída.` : `${room.title}: o grupo seguiu sem interagir.` } } },
      events: [interact ? `${room.title}: interação concluída.` : `${room.title}: passagem liberada.`],
      interaction,
      success: interact,
    };
  }
  if (room.kind !== "COMBAT" && room.kind !== "BOSS") return empty();
  if (!validActions.some((entry) => entry.action === "FIGHT")) return empty();

  const combat = combatAdapter({ roomId, room, memberIds: eligible, state });
  const updatedRoom = {
    ...state.rooms[roomId],
    cleared: combat.won,
    encounter: combat.won ? undefined : state.rooms[roomId].encounter,
    replay: combat.replay,
    lastOutcome: combat.won ? `${room.title} foi vencida.` : `${room.title}: os defensores venceram.`,
  };
  return {
    state: { ...state, rooms: { ...state.rooms, [roomId]: updatedRoom } },
    roomId,
    participantIds: eligible,
    events: combat.events,
    kos: combat.kos,
    hpByMascotId: combat.hpByMascotId,
    blockedBy: [],
    success: combat.won,
    mistakes: 0,
    interaction: null,
  };
}
