export type MascotRosterSortMode = "level" | "total" | "force" | "agility" | "charisma" | "instinct" | "vitality";

export type MascotRosterSortCandidate = {
  id: string;
  level: number;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
};

const statKey: Record<Exclude<MascotRosterSortMode, "level" | "total">, keyof MascotRosterSortCandidate> = {
  force: "statForce", agility: "statAgility", charisma: "statCharisma", instinct: "statInstinct", vitality: "statVitality",
};

export function mascotTotalStats(mascot: MascotRosterSortCandidate) {
  return mascot.statForce + mascot.statAgility + mascot.statCharisma + mascot.statInstinct + mascot.statVitality;
}

export function sortMascotRoster<T extends MascotRosterSortCandidate>(mascots: T[], mode: MascotRosterSortMode): T[] {
  return [...mascots].sort((a, b) => {
    const totalDiff = mascotTotalStats(b) - mascotTotalStats(a);
    if (mode === "level") return (b.level - a.level) || totalDiff || a.id.localeCompare(b.id);
    if (mode === "total") return totalDiff || (b.level - a.level) || a.id.localeCompare(b.id);
    const key = statKey[mode];
    return (Number(b[key]) - Number(a[key])) || totalDiff || (b.level - a.level) || a.id.localeCompare(b.id);
  });
}
