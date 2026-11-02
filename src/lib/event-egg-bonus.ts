export type MascotStatKey = "statForce" | "statAgility" | "statCharisma" | "statInstinct" | "statVitality";

/** The stored stat already includes the event bonus; this only controls its UI marker. */
export function eventEggBonusForStat(statKey: MascotStatKey, bonusStat: string | null | undefined, bonusValue: number | null | undefined) {
  return bonusStat === statKey && typeof bonusValue === "number" && bonusValue > 0 ? bonusValue : null;
}
