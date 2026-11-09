// Classificação, Pressão do Trono / Corrente Favorável e pareamento (reusa o suíço da Liga Semanal).
import { swissPairSlot, hashStr, type PairingPlayer } from "@/lib/league-pairing";
import { PT, type ReiConfig } from "./config";

export type StandRow = {
  pid: string; name: string; isBot?: boolean;
  score: number; // centésimos
  wins: number; losses: number; draws: number; byes: number; damage: number;
  rank: number; prevRank: number | null;
  topStreak: number; bottomStreak: number;
  /** Níveis aplicados no PRÓXIMO combate (decaem aos poucos ao sair da faixa). */
  pressure: number; current: number;
};

export type RawRow = Pick<StandRow, "pid" | "name" | "score" | "wins" | "losses" | "draws" | "byes" | "damage"> & { isBot?: boolean };

export const emptyBalance = { topStreak: 0, bottomStreak: 0, pressure: 0, current: 0 };

const cmp = (a: RawRow, b: RawRow) => b.score - a.score || b.wins - a.wins || b.damage - a.damage || (hashStr(a.pid) & 0xffff) - (hashStr(b.pid) & 0xffff);

export const zoneSize = (n: number, fraction: number) => Math.max(1, Math.round(n * fraction));

/** Classifica e atualiza streaks/níveis a partir da classificação anterior (se houver). */
export function buildStandings(rows: RawRow[], prev: StandRow[] | null, cfg: ReiConfig): StandRow[] {
  const sorted = [...rows].sort(cmp);
  const n = sorted.length;
  const top = zoneSize(n, cfg.pressure.topFraction);
  const bottom = zoneSize(n, cfg.current.bottomFraction);
  const prevBy = new Map((prev ?? []).map((r) => [r.pid, r]));
  const balanced = n >= cfg.balanceMinPlayers;
  return sorted.map((r, i) => {
    const rank = i + 1;
    const p = prevBy.get(r.pid);
    const inTop = balanced && rank <= top;
    const inBottom = balanced && !inTop && rank > n - bottom;
    const topStreak = inTop ? (p?.topStreak ?? 0) + 1 : 0;
    const bottomStreak = inBottom ? (p?.bottomStreak ?? 0) + 1 : 0;
    const maxP = cfg.pressure.steps.length - 1;
    const maxC = cfg.current.steps.length - 1;
    const pressure = inTop ? Math.min(maxP, topStreak) : Math.max(0, (p?.pressure ?? 0) - 1);
    const current = inBottom ? Math.min(maxC, bottomStreak) : Math.max(0, (p?.current ?? 0) - 1);
    return { ...r, rank, prevRank: p?.rank ?? null, topStreak, bottomStreak, pressure: cfg.pressure.enabled ? pressure : 0, current: cfg.current.enabled ? current : 0 };
  });
}

/** Modificador percentual (−6..+4) aplicado a dano/cura/suporte no combate. Nunca persiste. */
export function modifierPct(row: Pick<StandRow, "pressure" | "current"> | undefined, cfg: ReiConfig): number {
  if (!row) return 0;
  const p = cfg.pressure.steps[Math.min(row.pressure, cfg.pressure.steps.length - 1)] ?? 0;
  const c = cfg.current.steps[Math.min(row.current, cfg.current.steps.length - 1)] ?? 0;
  return row.pressure > 0 ? -p : row.current > 0 ? c : 0;
}

export type PastMatch = { a: string; b: string | null; day: number };

/** Pareamento da rodada a partir do snapshot congelado (mesmo resultado em qualquer ordem). */
export function pairRound(snapshot: StandRow[], past: PastMatch[], day: number, seed: string) {
  const faced = new Map<string, Map<string, number>>();
  const today = new Map<string, Set<string>>();
  const byeCount = new Map<string, number>();
  const bump = (x: string, y: string) => { if (!faced.has(x)) faced.set(x, new Map()); faced.get(x)!.set(y, (faced.get(x)!.get(y) ?? 0) + 1); };
  for (const m of past) {
    if (!m.b) { byeCount.set(m.a, (byeCount.get(m.a) ?? 0) + 1); continue; }
    bump(m.a, m.b); bump(m.b, m.a);
    if (m.day === day) {
      if (!today.has(m.a)) today.set(m.a, new Set()); if (!today.has(m.b)) today.set(m.b, new Set());
      today.get(m.a)!.add(m.b); today.get(m.b)!.add(m.a);
    }
  }
  const players: PairingPlayer[] = snapshot.map((r) => ({ playerId: r.pid, points: Math.round(r.score / PT / 5), wins: r.wins, damageDealt: r.damage, byes: 0 }));
  return swissPairSlot(players, faced, today, byeCount, seed);
}
