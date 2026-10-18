import type { TowerPartyProfile } from "./formation";

export function describeTowerFormation<T extends { formationSlot: number | null }>(
  profile: TowerPartyProfile | null,
  mascots: readonly T[],
) {
  const ordered = profile
    ? [...mascots].sort((a, b) => (a.formationSlot ?? 99) - (b.formationSlot ?? 99))
    : [...mascots];
  return {
    active: ordered.slice(0, 2),
    reserve: profile === "SOLO" ? ordered.slice(2, 4) : [],
    required: profile === "SOLO" ? 4 : 2,
  };
}

export function towerReserveVisible(
  events: readonly { effect?: string | null }[],
  turnIndex: number,
): boolean {
  return events.some((event, index) => index <= turnIndex &&
    event.effect?.startsWith("Reservas da Torre entraram no mesmo combate") === true);
}

/** The animated canvas currently knows only the initial lineup. */
export function towerReplayCanUseModern(
  eventCount: number,
  activeCount: number,
  enemyCount: number,
  reserveCount: number,
): boolean {
  return eventCount > 0 && activeCount > 0 && enemyCount > 0 && reserveCount === 0;
}
