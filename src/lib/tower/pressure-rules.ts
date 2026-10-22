import { newExpeditionState, type TowerExpeditionV2 } from "./expedition-state";
import type { RoomFrontResult } from "./room-resolver";
import { generateTowerRoomGraph, towerPressureModifiers } from "./rooms";
import type { TowerBalance } from "./balance-rules";

/** Initial design values; the simulator can change these before public opening. */
export const TOWER_BALANCE_SEED = {
  basePressurePerTurn: 1,
  extraPressurePerSplitFront: 1,
  maxSplitFrontsCharged: 2,
  pressurePerMistake: 1,
  maxMistakesCharged: 2,
  pressurePerWait: 1,
  maxWaitsCharged: 2,
  maxPressure: 12,
  overloadPerExtraSuccessfulFront: 0.08,
  duoOverloadPerExtraSuccessfulFront: 0.03,
  maxOverload: 0.16,
  overloadDurationTurns: 2,
  floorPressureRelief: 4,
  floorHealingFraction: 0.18,
} as const;

export type PressureInput = {
  activeFronts: number;
  mistakes: number;
  waits: number;
  shield: number;
  /** Existing Legado split multiplier: 2 at rank zero, down to 1. */
  splitPenalty?: number;
};

export type PressureResult = {
  gross: number;
  absorbed: number;
  applied: number;
  remainingShield: number;
  reasons: string[];
};

export function pressureDelta(input: PressureInput): PressureResult {
  const base = input.activeFronts > 0 ? TOWER_BALANCE_SEED.basePressurePerTurn : 0;
  const extraFronts = Math.min(TOWER_BALANCE_SEED.maxSplitFrontsCharged, Math.max(0, input.activeFronts - 1));
  const splitFactor = Math.max(0, (input.splitPenalty ?? 2) - 1);
  const split = extraFronts * TOWER_BALANCE_SEED.extraPressurePerSplitFront * splitFactor;
  const mistakes = Math.min(TOWER_BALANCE_SEED.maxMistakesCharged, Math.max(0, input.mistakes)) * TOWER_BALANCE_SEED.pressurePerMistake;
  const waits = Math.min(TOWER_BALANCE_SEED.maxWaitsCharged, Math.max(0, input.waits)) * TOWER_BALANCE_SEED.pressurePerWait;
  const gross = base + split + mistakes + waits;
  const absorbed = Math.min(gross, Math.max(0, input.shield));
  return {
    gross,
    absorbed,
    applied: gross - absorbed,
    remainingShield: Math.max(0, input.shield - absorbed),
    reasons: [
      ...(base ? [`Turno global +${base}`] : []),
      ...(split ? [`Frentes separadas +${split}`] : []),
      ...(mistakes ? [`Erros de sala +${mistakes}`] : []),
      ...(waits ? [`Espera +${waits}`] : []),
      ...(absorbed ? [`Escudo absorveu ${absorbed}`] : []),
    ],
  };
}

function overloadPerExtraFront(partySize?: number): number {
  return partySize === 2
    ? TOWER_BALANCE_SEED.duoOverloadPerExtraSuccessfulFront
    : TOWER_BALANCE_SEED.overloadPerExtraSuccessfulFront;
}

export function overloadFromResults(results: RoomFrontResult[], partySize?: number): number {
  const successfulRooms = new Set(results.filter((result) => result.success).map((result) => result.roomId));
  return Math.min(
    TOWER_BALANCE_SEED.maxOverload,
    Math.max(0, successfulRooms.size - 1) * overloadPerExtraFront(partySize),
  );
}

export function bossOverloadValue(state: TowerExpeditionV2): number {
  return Math.min(TOWER_BALANCE_SEED.maxOverload, Math.max(0, state.bossOverloadCharge ?? 0));
}

export function earnBossOverloadCharge(
  state: TowerExpeditionV2,
  successfulRoomIds: readonly string[],
): TowerExpeditionV2 {
  if (Object.keys(state.members).length < 2 || state.bossOverloadAwarded) return state;
  const distinct = new Set(successfulRoomIds);
  if (distinct.size < 2) return state;
  return {
    ...state,
    bossOverloadCharge: Math.min(TOWER_BALANCE_SEED.maxOverload,
      (distinct.size - 1) * overloadPerExtraFront(Object.keys(state.members).length)),
    bossOverloadAwarded: true,
  };
}

export function consumeBossOverloadCharge(state: TowerExpeditionV2): TowerExpeditionV2 {
  return bossOverloadValue(state) > 0 ? { ...state, bossOverloadCharge: 0 } : state;
}

export function applyPressureToExpedition(
  state: TowerExpeditionV2,
  change: PressureResult,
): TowerExpeditionV2 {
  const pressure = Math.min(TOWER_BALANCE_SEED.maxPressure, Math.max(0, state.pressure + change.applied));
  const actual = pressure - state.pressure;
  return {
    ...state,
    pressure,
    pressureShield: change.remainingShield,
    activeModifiers: towerPressureModifiers(pressure),
    lastPressureChange: {
      applied: actual,
      reasons: [...change.reasons, ...(actual < change.applied ? ["Pressão no limite da Torre"] : [])],
    },
  };
}

export function updateOverload(
  state: TowerExpeditionV2,
  currentTurn: number,
  earned: number,
): TowerExpeditionV2 {
  const previous = state.overload && state.overload.expiresAfterTurn >= currentTurn ? state.overload : null;
  if (earned <= 0) return { ...state, overload: previous };
  return {
    ...state,
    overload: {
      value: Math.min(TOWER_BALANCE_SEED.maxOverload, (previous?.value ?? 0) + earned),
      expiresAfterTurn: currentTurn + TOWER_BALANCE_SEED.overloadDurationTurns,
    },
  };
}

export type TowerMascotVitals = {
  mascotId: string;
  ownerUserId: string;
  currentHp: number;
  maxHp: number;
};

/** HP remains authoritative in TowerRunMascot; the pure rule returns DB updates. */
export function transitionFloor(
  state: TowerExpeditionV2,
  nextFloor: number,
  seed: string,
  mascots: TowerMascotVitals[],
  balance?: Readonly<TowerBalance>,
): { state: TowerExpeditionV2; healingByMascotId: Record<string, number> } {
  if (!Number.isInteger(nextFloor) || nextFloor < 2 || nextFloor > 7)
    throw new Error("Andar de destino inválido.");
  const fresh = newExpeditionState(generateTowerRoomGraph(seed, nextFloor), Object.keys(state.members));
  const entranceId = fresh.currentRoomId;
  const pressure = Math.max(0, state.pressure - (balance?.floorPressureRelief ?? TOWER_BALANCE_SEED.floorPressureRelief));
  const members = Object.fromEntries(Object.entries(state.members).map(([id, member]) => [id, {
    ...member,
    roomId: entranceId,
    confirmedTurn: null,
  }]));
  const healingByMascotId: Record<string, number> = {};
  for (const mascot of mascots) {
    if (state.members[mascot.ownerUserId]?.status !== "ACTIVE" || mascot.currentHp <= 0) continue;
    const nextHp = Math.min(mascot.maxHp, mascot.currentHp + Math.round(mascot.maxHp * (balance?.floorHealingFraction ?? TOWER_BALANCE_SEED.floorHealingFraction)));
    healingByMascotId[mascot.mascotId] = nextHp;
  }
  return {
    state: {
      ...fresh,
      globalTurn: state.globalTurn,
      members,
      pressure,
      activeModifiers: towerPressureModifiers(pressure),
      pressureShield: state.pressureShield,
      countermeasures: state.countermeasures,
      relics: state.relics,
      runReport: state.runReport,
      rewardLedger: state.rewardLedger ?? [],
      lastRecoveryFloor: state.lastRecoveryFloor,
      overload: null,
      bossOverloadCharge: 0,
      bossOverloadAwarded: false,
      lastPressureChange: { applied: pressure - state.pressure, reasons: ["Transição de andar: alívio parcial da Pressão"] },
    },
    healingByMascotId,
  };
}
