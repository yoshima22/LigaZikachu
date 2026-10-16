import type { TowerPartyProfile } from "./formation";

export function canJoinTowerLobby(
  profile: TowerPartyProfile | null,
  currentMembers: number,
): boolean {
  return profile !== "SOLO" && currentMembers >= 1 && currentMembers < 3;
}

export function canEditTowerFormation(status: string, ready: boolean): boolean {
  return status === "LOBBY" && !ready;
}
