import type { LeagueMascot } from "@/lib/league-combat";
import type { TowerRunReport } from "./rooms";

export type TowerCombatLogLine = {
  actorId: string; actorOwnerId: string | null; actorName: string;
  targetId: string; targetOwnerId: string | null; action: string; damage: number;
};

function emptyReport(): TowerRunReport {
  return { mascots: {}, monstersDefeated: 0, bossesDefeated: 0, alliesRecovered: 0, talentPoints: 0, roomsCleared: 0 };
}

export function recordRecoveryInReport(report: TowerRunReport | undefined): TowerRunReport {
  return { ...(report ?? emptyReport()), alliesRecovered: (report?.alliesRecovered ?? 0) + 1 };
}

export function recordRoomClearedInReport(report: TowerRunReport | undefined): TowerRunReport {
  return { ...(report ?? emptyReport()), roomsCleared: (report?.roomsCleared ?? 0) + 1 };
}

export function addCombatToRunReport(
  report: TowerRunReport | undefined,
  allies: LeagueMascot[], enemies: LeagueMascot[], log: TowerCombatLogLine[],
  isBoss: boolean, won: boolean,
): TowerRunReport {
  const next: TowerRunReport = report
    ? { ...report, mascots: Object.fromEntries(Object.entries(report.mascots).map(([id, mascot]) => [id, { ...mascot }])) }
    : emptyReport();
  const hp = new Map([...allies, ...enemies].map((mascot) => [mascot.id, mascot.hp]));
  const defeated = new Set<string>();
  for (const ally of allies) if (!next.mascots[ally.id]) next.mascots[ally.id] = {
    mascotId: ally.id, ownerUserId: ally.ownerId, name: ally.name, pokemonId: ally.pokemonId,
    level: ally.level, damageDealt: 0, damageReceived: 0, healing: 0, kos: 0,
  };
  for (const event of log) {
    const actor = next.mascots[event.actorId];
    const target = next.mascots[event.targetId];
    if (event.action === "HEAL") {
      if (actor) actor.healing += Math.max(0, event.damage);
      const current = hp.get(event.targetId);
      if (current !== undefined && current > 0) {
        const maximum = [...allies, ...enemies].find((mascot) => mascot.id === event.targetId)?.hp ?? current;
        hp.set(event.targetId, Math.min(maximum, current + Math.max(0, event.damage)));
      }
    }
    if (event.action !== "ATTACK") continue;
    const damage = Math.max(0, event.damage);
    if (actor) actor.damageDealt += damage;
    if (target) {
      const before = hp.get(event.targetId) ?? 0;
      target.damageReceived += Math.min(before, damage);
    }
    if (hp.has(event.targetId)) hp.set(event.targetId, Math.max(0, (hp.get(event.targetId) ?? 0) - damage));
    if (actor && event.targetOwnerId === "TORRE" && !defeated.has(event.targetId) && (hp.get(event.targetId) ?? 0) <= 0) {
      actor.kos += 1;
      defeated.add(event.targetId);
    }
  }
  if (won) {
    next.roomsCleared += 1;
    next.monstersDefeated += defeated.size;
    if (isBoss) { next.bossesDefeated += 1; next.talentPoints += 1; }
  }
  return next;
}
