/** Shared by the persisted V2 combat and the offline simulator. Keep experiments
 * out of request handlers; only the simulator may override the live values. */
export type TowerBalance = {
  firstFloorEnemyScale: number;
  firstBossEscortReduction: number;
  lateFloorEnemyScale: number;
  middleFloorEnemyScale?: number;
  groupSizeSlope?: number;
  middleFloorDuoGroupSizeSlope?: number;
  firstFloorGroupSizeSlope?: number;
  lateFloorGroupSizeSlope?: number;
  floorHealingFraction?: number;
  floorPressureRelief?: number;
};

export const TOWER_BALANCE: Readonly<TowerBalance> = {
  firstFloorEnemyScale: 0.95,
  firstBossEscortReduction: 2,
  lateFloorEnemyScale: 1,
};

export const TOWER_BALANCE_SOLO_V2: Readonly<TowerBalance> = {
  firstFloorEnemyScale: 0.95,
  firstBossEscortReduction: 2,
  middleFloorEnemyScale: 1,
  lateFloorEnemyScale: 1.162,
  floorHealingFraction: 0.18,
  floorPressureRelief: 4,
};

export const TOWER_BALANCE_GROUP_V2: Readonly<TowerBalance> = {
  firstFloorEnemyScale: 0.88,
  firstBossEscortReduction: 2,
  middleFloorEnemyScale: 0.961,
  lateFloorEnemyScale: 0.98,
  groupSizeSlope: 0.31,
  middleFloorDuoGroupSizeSlope: 0.33,
  firstFloorGroupSizeSlope: 0.19,
  lateFloorGroupSizeSlope: 0.2,
  floorHealingFraction: 0.18,
  floorPressureRelief: 4,
};

export function towerBalanceFor(
  profile: "SOLO" | "GROUP" | null,
  version: number | null,
): Readonly<TowerBalance> {
  if (version !== 2 || !profile) return TOWER_BALANCE;
  return profile === "SOLO" ? TOWER_BALANCE_SOLO_V2 : TOWER_BALANCE_GROUP_V2;
}

export function towerBossDefenderCount(allyCount: number, floor: number, balance: Readonly<TowerBalance> = TOWER_BALANCE): number {
  return Math.max(2, Math.max(2, allyCount) - (floor === 1 ? balance.firstBossEscortReduction : 0));
}

/** On the first floor a captive takes an escort's place, never the boss's. */
export function towerAddCaptive<T>(enemies: readonly T[], captive: T, roomKind: "BOSS" | "COMBAT", floor: number, allyCount: number,
  balance: Readonly<TowerBalance> = TOWER_BALANCE): T[] {
  const result = [...enemies];
  if (roomKind === "BOSS" && floor === 1 && result.length >= towerBossDefenderCount(allyCount, floor, balance) && result.length > 1)
    result.pop();
  result.push(captive);
  return result;
}

export function towerEnemyBaseStat(
  averageLevel: number,
  roomIndex: number,
  pressureMultiplier: number,
  floor: number,
  balance: Readonly<TowerBalance> = TOWER_BALANCE,
  partySize = 0,
): number {
  const floorScale = floor === 1 ? balance.firstFloorEnemyScale : floor >= 5
    ? balance.lateFloorEnemyScale : (balance.middleFloorEnemyScale ?? 1);
  const slope = floor === 1 ? (balance.firstFloorGroupSizeSlope ?? 0) : floor >= 5
    ? (balance.lateFloorGroupSizeSlope ?? balance.groupSizeSlope ?? 0)
    : partySize === 2 ? (balance.middleFloorDuoGroupSizeSlope ?? balance.groupSizeSlope ?? 0)
      : (balance.groupSizeSlope ?? 0);
  const groupScale = slope && partySize >= 2
    ? 1 + slope * (partySize - 2.5) : 1;
  return Math.max(12, Math.round((averageLevel * 0.72 + 18 + roomIndex * 2) * pressureMultiplier * floorScale * groupScale));
}
