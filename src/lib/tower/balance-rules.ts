/** Shared by the persisted V2 combat and the offline simulator. Keep experiments
 * out of request handlers; only the simulator may override the live values. */
export type TowerBalance = {
  firstFloorEnemyScale: number;
  firstBossEscortReduction: number;
  lateFloorEnemyScale: number;
};

export const TOWER_BALANCE: Readonly<TowerBalance> = {
  firstFloorEnemyScale: 0.95,
  firstBossEscortReduction: 2,
  lateFloorEnemyScale: 1,
};

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
): number {
  const floorScale = floor === 1 ? balance.firstFloorEnemyScale : floor >= 5 ? balance.lateFloorEnemyScale : 1;
  return Math.max(12, Math.round((averageLevel * 0.72 + 18 + roomIndex * 2) * pressureMultiplier * floorScale));
}
