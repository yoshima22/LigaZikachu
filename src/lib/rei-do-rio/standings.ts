// Classificação, Pressão do Trono / Calor da Lareira e pareamento (reusa o suíço da Liga Semanal).
import { swissPairSlot, hashStr, type PairingPlayer } from "@/lib/league-pairing";
import { PT, type ReiConfig } from "./config";

export type Result = "W" | "L" | "D" | "BYE";

export type StandRow = {
  pid: string; name: string; isBot?: boolean;
  score: number; // centésimos
  wins: number; losses: number; draws: number; byes: number; damage: number;
  rank: number; prevRank: number | null;
  /** Rodadas seguidas no topo (só bônus de pontos de permanência; NÃO gera modificador). */
  topStreak: number;
  /** Sequência atual de vitórias / derrotas (empate zera; folga mantém). */
  winStreak: number; lossStreak: number;
  /** Níveis aplicados no PRÓXIMO combate: vêm só das sequências e somem quando ela quebra. */
  pressure: number; current: number;
};

export type RawRow = Pick<StandRow, "pid" | "name" | "score" | "wins" | "losses" | "draws" | "byes" | "damage"> & { isBot?: boolean; lastResult?: Result | null };

export const emptyBalance = { topStreak: 0, winStreak: 0, lossStreak: 0, pressure: 0, current: 0 };

const cmp = (a: RawRow, b: RawRow) => b.score - a.score || b.wins - a.wins || b.damage - a.damage || (hashStr(a.pid) & 0xffff) - (hashStr(b.pid) & 0xffff);

export const zoneSize = (n: number, fraction: number) => Math.max(1, Math.round(n * fraction));

/** Classifica e atualiza sequências/níveis a partir da classificação anterior (se houver). */
export function buildStandings(rows: RawRow[], prev: StandRow[] | null, cfg: ReiConfig): StandRow[] {
  const sorted = [...rows].sort(cmp);
  const n = sorted.length;
  const top = zoneSize(n, cfg.pressure.topFraction);
  const prevBy = new Map((prev ?? []).map((r) => [r.pid, r]));
  const balanced = n >= cfg.balanceMinPlayers;
  const maxP = cfg.pressure.steps.length - 1;
  const maxC = cfg.current.steps.length - 1;
  const level = (streak: number, min: number, max: number) => (streak >= min ? Math.min(max, streak - min + 1) : 0);
  return sorted.map((r, i) => {
    const rank = i + 1;
    const p = prevBy.get(r.pid);
    let w = p?.winStreak ?? 0, l = p?.lossStreak ?? 0;
    if (r.lastResult === "W") { w += 1; l = 0; }
    else if (r.lastResult === "L") { l += 1; w = 0; }
    else if (r.lastResult === "D") { w = 0; l = 0; }
    const topStreak = balanced && rank <= top ? (p?.topStreak ?? 0) + 1 : 0;
    const pressure = balanced && cfg.pressure.enabled ? level(w, cfg.pressure.minStreak, maxP) : 0;
    const current = balanced && cfg.current.enabled ? level(l, cfg.current.minStreak, maxC) : 0;
    const { lastResult: _unused, ...rest } = r; void _unused;
    return { ...rest, rank, prevRank: p?.rank ?? null, topStreak, winStreak: w, lossStreak: l, pressure, current };
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
export function pairRound(snapshot: StandRow[], past: PastMatch[], day: number, seed: string, healthBonus?: Map<string, number>) {
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
  const players: PairingPlayer[] = snapshot.map((r) => ({ playerId: r.pid, points: Math.round(r.score / PT / 5) + (healthBonus?.get(r.pid) ?? 0), wins: r.wins, damageDealt: r.damage, byes: 0 }));
  return swissPairSlot(players, faced, today, byeCount, seed);
}
