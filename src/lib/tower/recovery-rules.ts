import type { TowerExpeditionV2, TowerMemberState } from "./expedition-state";
import type { TowerMascotVitals } from "./pressure-rules";

export const TOWER_REVIVE_ITEM_ID = "tower-revival-kit";

export function terminalMascotDisposition(
  memberStatus: TowerMemberState,
  wonRun: boolean,
  currentHp: number,
): { state: "LOST_IN_TOWER" | "RECOVERED"; currentHp: number } {
  if (memberStatus !== "AFK_ABANDONED" && !wonRun && currentHp <= 0)
    return { state: "LOST_IN_TOWER", currentHp: 0 };
  return { state: "RECOVERED", currentHp: Math.max(1, currentHp) };
}

export type TowerRecoveryErrorCode =
  | "INVALID_ACTOR"
  | "INVALID_TARGET"
  | "TOO_FAR"
  | "NOT_IN_RECOVERY_ROOM"
  | "RECOVERY_UNAVAILABLE"
  | "MISSING_MASCOTS";

export class TowerRecoveryError extends Error {
  constructor(public readonly code: TowerRecoveryErrorCode, message: string) {
    super(message);
    this.name = "TowerRecoveryError";
  }
}

export function canUseRecoveryRoom(currentFloor: number, lastUsedFloor: number | null): boolean {
  return Number.isInteger(currentFloor) && currentFloor >= 1 &&
    (lastUsedFloor === null || currentFloor >= lastUsedFloor + 2);
}

export function reviveMember(
  state: TowerExpeditionV2,
  targetId: string,
  source: { kind: "ITEM" | "ROOM"; actorId: string },
  currentFloor: number,
  vitals: TowerMascotVitals[],
): { state: TowerExpeditionV2; hpByMascotId: Record<string, number> } {
  const actor = state.members[source.actorId];
  if (!actor || actor.status !== "ACTIVE" || actor.availableFromTurn > state.globalTurn || source.actorId === targetId)
    throw new TowerRecoveryError("INVALID_ACTOR", "Somente um aliado vivo pode reanimar outro treinador.");
  const target = state.members[targetId];
  if (!target || target.status !== "DOWNED")
    throw new TowerRecoveryError("INVALID_TARGET", "O alvo não está caído nesta expedição.");
  if (source.kind === "ITEM" && actor.roomId !== target.roomId)
    throw new TowerRecoveryError("TOO_FAR", "O item exige que você esteja na sala do aliado caído.");
  if (source.kind === "ROOM") {
    if (state.graph.find((room) => room.id === actor.roomId)?.kind !== "RECOVERY")
      throw new TowerRecoveryError("NOT_IN_RECOVERY_ROOM", "Vá até a Sala de Recuperação para usar este recurso.");
    if (!canUseRecoveryRoom(currentFloor, state.lastRecoveryFloor))
      throw new TowerRecoveryError("RECOVERY_UNAVAILABLE", `Sala disponível novamente no andar ${(state.lastRecoveryFloor ?? currentFloor) + 2}.`);
  }
  const targetMascots = vitals.filter((mascot) => mascot.ownerUserId === targetId);
  if (targetMascots.length !== 2)
    throw new TowerRecoveryError("MISSING_MASCOTS", "Os dois mascotes do aliado não foram encontrados nesta run.");
  const hpByMascotId = Object.fromEntries(targetMascots.map((mascot) => [
    mascot.mascotId,
    Math.max(1, Math.round(mascot.maxHp * 0.5)),
  ]));
  return {
    state: {
      ...state,
      members: {
        ...state.members,
        [targetId]: { ...target, status: "ACTIVE", consecutiveMisses: 0, confirmedTurn: null, availableFromTurn: state.globalTurn + 1 },
      },
      lastRecoveryFloor: source.kind === "ROOM" ? currentFloor : state.lastRecoveryFloor,
    },
    hpByMascotId,
  };
}

export type CaptiveReleaseStore = {
  /** Must be a conditional update (`recoveredAt IS NULL`) inside the caller's transaction. */
  markRecoveredIfCaptive(mascotId: string, encounterId: string, actorId: string): Promise<boolean>;
  restoreMascotToOwner(mascotId: string): Promise<void>;
};

export async function releaseCapturedMascot(
  store: CaptiveReleaseStore,
  mascotId: string,
  encounterId: string,
  actorId: string,
): Promise<boolean> {
  const claimed = await store.markRecoveredIfCaptive(mascotId, encounterId, actorId);
  if (!claimed) return false;
  await store.restoreMascotToOwner(mascotId);
  return true;
}
