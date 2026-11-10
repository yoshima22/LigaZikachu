// Bots de teste e simulação de semana em memória. Nada aqui toca banco, inventário ou ranking real.
import { hashStr } from "@/lib/league-pairing";
import { COMPETITION_DAYS, ROUNDS_PER_DAY, TOTAL_ROUNDS, mergeConfig, type ReiConfig } from "./config";
import { autoBuild, type Preset } from "./auto-build";
import { initialStandings, runRound, type FightFn, type MatchSummary, type Runtime } from "./engine";
import { freshDayState, formationMascotIds, type Formation, type MascotSnap, type Strategy } from "./team";
import type { StandRow } from "./standings";

const SPECIES = [3, 6, 9, 25, 26, 59, 65, 68, 94, 130, 131, 143, 149, 150, 196, 197, 248, 282, 306, 359, 376, 445, 448, 460, 462, 466, 470, 471, 475, 477, 530, 537, 553, 571, 609, 635, 658, 670, 681, 700, 706, 724, 727, 730, 745, 812, 815, 818, 849, 887];

function rng(seed: string) {
  let t = hashStr(seed) || 1;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

export type BotTier = "FRACO" | "MEDIO" | "FORTE";
const TIER_LEVEL: Record<BotTier, number> = { FRACO: 22, MEDIO: 38, FORTE: 55 };

/** 18+ mascotes sintéticos (sem posturas avançadas desbloqueadas). */
export function makeBotRoster(key: string, tier: BotTier = "MEDIO", count = 20): MascotSnap[] {
  const r = rng(key);
  const base = TIER_LEVEL[tier];
  return Array.from({ length: count }, (_, i) => {
    const level = Math.max(5, Math.round(base + (r() - 0.5) * 12));
    const budget = level * 2 + 20;
    const w = [r() + 0.4, r() + 0.4, r() + 0.4, r() + 0.4, r() + 0.4];
    const sum = w.reduce((a, b) => a + b, 0);
    const [f, a, ins, v, c] = w.map((x) => Math.max(5, Math.round((x / sum) * budget)));
    return {
      id: `${key}:m${i + 1}`, pokemonId: SPECIES[Math.floor(r() * SPECIES.length)], nickname: null, level,
      statForce: f, statAgility: a, statInstinct: ins, statVitality: v, statCharisma: c,
      personality: ["PROUD", "SERENE", "CURIOUS", "LOYAL", "TIMID", "COMPETITIVE", null][Math.floor(r() * 7)],
      unlocked: [],
    };
  });
}

export type SimPlayer = { pid: string; name: string; tag: string; roster: MascotSnap[]; formation: Formation };

/** `strategy`: KEEP (até cair), PRESERVE (limiar sugerido por postura) ou um número = mesmo limiar de troca em todos os slots. */
export function makeSimPlayer(i: number, preset: Preset, tier: BotTier, strategy: Strategy | number, label?: string): SimPlayer {
  const pid = `bot:${i}`;
  const roster = makeBotRoster(pid, tier);
  const built = autoBuild(roster, preset, typeof strategy === "number" ? "KEEP" : strategy);
  if (!built.ok) throw new Error(built.error);
  if (typeof strategy === "number") for (const s of built.formation.slots) s.swapBelowPct = strategy;
  return { pid, name: label ?? `Bot ${i} · ${preset}/${tier}`, tag: `${preset}/${tier}/${strategy}`, roster, formation: built.formation };
}

export type SimMetrics = {
  rounds: number; matches: number; avgKosPerMatch: number; avgDefeatedPerRound: number;
  exhaustedSlotsPerDay: number; substitutions: number; leadershipChanges: number;
  modifierApplications: number; activeBySlot: number[]; emptyPctBySlot: number[]; byTier: Record<string, { active: number[]; emptyPct: number[] }>; winsByTag: Record<string, { w: number; n: number }>; pointsByRole: Record<string, number>;
  spreadStrongWeak: number; rankWinCorr: number; inversions: number; strongWinPct: number; weakWinPct: number; ms: number; errors: string[]; champion: string;
};

export function simulateWeek(players: SimPlayer[], opts: { editionId?: string; cfg?: Partial<ReiConfig>; fight?: FightFn; onRound?: (r: number) => void } = {}) {
  const cfg = mergeConfig(opts.cfg);
  const t0 = Date.now();
  const editionId = opts.editionId ?? "sim";
  const rts: Runtime[] = players.map((p) => ({
    pid: p.pid, name: p.name, isBot: true, roster: new Map(p.roster.map((m) => [m.id, m])), formation: p.formation,
    state: freshDayState(p.formation, new Map(p.roster.map((m) => [m.id, m])), cfg.hpMultiplier), aggs: {}, wins: 0, losses: 0, draws: 0, byes: 0, damage: 0,
  }));
  const tagOf = new Map(players.map((p) => [p.pid, p.tag]));
  let snapshot: StandRow[] = initialStandings(rts, cfg);
  const past: { a: string; b: string | null; day: number }[] = [];
  const metrics: SimMetrics = { rounds: 0, matches: 0, avgKosPerMatch: 0, avgDefeatedPerRound: 0, exhaustedSlotsPerDay: 0, substitutions: 0, leadershipChanges: 0, modifierApplications: 0, activeBySlot: [0, 0, 0, 0, 0], emptyPctBySlot: [0, 0, 0, 0, 0], byTier: {}, winsByTag: {}, pointsByRole: {}, spreadStrongWeak: 0, rankWinCorr: 0, inversions: 0, strongWinPct: 0, weakWinPct: 0, ms: 0, errors: [], champion: "" };
  let kos = 0, defeated = 0, exhaustedSum = 0, lastLeader = snapshot[0]?.pid;
  const history: StandRow[][] = [];
  const tierAcc: Record<string, { n: number[]; act: number[]; emp: number[] }> = {};
  const slotN = [0, 0, 0, 0, 0], slotActive = [0, 0, 0, 0, 0], slotEmpty = [0, 0, 0, 0, 0];

  for (let round = 1; round <= TOTAL_ROUNDS; round++) {
    const day = Math.floor((round - 1) / ROUNDS_PER_DAY) + 1;
    try {
      const res = runRound({ editionId, roundIndex: round, dayIndex: day, cfg, snapshot, players: rts, past, fight: opts.fight });
      for (const m of res.matches) {
        past.push({ a: m.aId, b: m.bId, day });
        if (!m.bId) continue;
        const s = m.summary as MatchSummary;
        metrics.matches++;
        const si = (round - 1) % ROUNDS_PER_DAY;
        for (const [pid, side] of [[m.aId, s.A], [m.bId, s.B!]] as const) {
          const t = tagOf.get(pid)!.split("/")[1];
          const e = (tierAcc[t] ??= { n: [0, 0, 0, 0, 0], act: [0, 0, 0, 0, 0], emp: [0, 0, 0, 0, 0] });
          e.n[si]++; e.act[si] += side.lineup.length; e.emp[si] += side.lineup.length === 0 ? 1 : 0;
        }
        slotN[si] += 2; slotActive[si] += s.A.lineup.length + s.B!.lineup.length; slotEmpty[si] += (s.A.lineup.length === 0 ? 1 : 0) + (s.B!.lineup.length === 0 ? 1 : 0);
        kos += s.A.team.kos + s.B!.team.kos;
        defeated += s.A.team.kos + s.B!.team.kos;
        metrics.substitutions += s.A.substitutions.length + s.B!.substitutions.length;
        if (s.A.modifierPct) metrics.modifierApplications++;
        if (s.B!.modifierPct) metrics.modifierApplications++;
        for (const [pid, win] of [[m.aId, s.winner === "A"], [m.bId, s.winner === "B"]] as const) {
          const tag = tagOf.get(pid)!;
          const e = (metrics.winsByTag[tag] ??= { w: 0, n: 0 });
          e.n++; if (win) e.w++;
        }
        for (const st of [...m.stats.A, ...m.stats.B]) metrics.pointsByRole[st.role] = (metrics.pointsByRole[st.role] ?? 0) + st.total;
      }
      snapshot = res.standings;
      history.push(snapshot);
      if (snapshot[0]?.pid !== lastLeader) { metrics.leadershipChanges++; lastLeader = snapshot[0]?.pid; }
      metrics.rounds++;
      opts.onRound?.(round);
    } catch (e) {
      metrics.errors.push(`Rodada ${round}: ${e instanceof Error ? e.message : String(e)}`);
      break;
    }
    if (round % ROUNDS_PER_DAY === 0 && day < COMPETITION_DAYS) {
      // Recuperação noturna + formação original (sem personalização na simulação).
      for (const rt of rts) { exhaustedSum += rt.formation.slots.filter((s) => s.mascotIds.every((id) => rt.state.mascots[id]?.dead)).length; rt.state = freshDayState(rt.formation, rt.roster, cfg.hpMultiplier); }
    } else if (round % ROUNDS_PER_DAY === 0) {
      for (const rt of rts) exhaustedSum += rt.formation.slots.filter((s) => s.mascotIds.every((id) => rt.state.mascots[id]?.dead)).length;
    }
  }
  metrics.activeBySlot = slotN.map((n, i) => (n ? slotActive[i] / n : 0));
  metrics.emptyPctBySlot = slotN.map((n, i) => (n ? (100 * slotEmpty[i]) / n : 0));
  for (const [t, e] of Object.entries(tierAcc)) metrics.byTier[t] = { active: e.n.map((n, i) => (n ? e.act[i] / n : 0)), emptyPct: e.n.map((n, i) => (n ? (100 * e.emp[i]) / n : 0)) };
  metrics.avgKosPerMatch = metrics.matches ? kos / metrics.matches : 0;
  metrics.avgDefeatedPerRound = metrics.rounds ? defeated / metrics.rounds : 0;
  metrics.exhaustedSlotsPerDay = exhaustedSum / Math.max(1, COMPETITION_DAYS * players.length); // por jogador por dia
  const scores = snapshot.map((r) => r.score);
  metrics.spreadStrongWeak = scores.length ? (Math.max(...scores) - Math.min(...scores)) / 100 : 0;
  metrics.champion = snapshot[0]?.name ?? "";
  // Posição x vitórias: correlação de Spearman simplificada + nº de pares "invertidos" (mais derrotas acima).
  const byWins = [...snapshot].sort((a, b) => b.wins - a.wins);
  const n = snapshot.length;
  const winRank = new Map(byWins.map((r, i) => [r.pid, i + 1]));
  const d2 = snapshot.reduce((a, r) => a + (r.rank - (winRank.get(r.pid) ?? 0)) ** 2, 0);
  metrics.rankWinCorr = n > 1 ? 1 - (6 * d2) / (n * (n * n - 1)) : 1;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (snapshot[i].losses > snapshot[j].losses) metrics.inversions++;
  const tier = (pid: string) => tagOf.get(pid)!.split("/")[1];
  for (const grp of [["FORTE", "strongWinPct"], ["FRACO", "weakWinPct"]] as const) {
    const rows = snapshot.filter((r) => tier(r.pid) === grp[0]);
    const g = rows.reduce((a, r) => a + r.wins + r.losses + r.draws, 0);
    metrics[grp[1]] = g ? (100 * rows.reduce((a, r) => a + r.wins, 0)) / g : 0;
  }
  metrics.ms = Date.now() - t0;
  return { standings: snapshot, runtimes: rts, metrics, history, formationIds: players.map((p) => formationMascotIds(p.formation).length) };
}
