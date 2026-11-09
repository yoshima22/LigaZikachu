// Motor de rodada do Rei do Rio. PURO (sem banco): recebe o estado de todos os participantes e
// devolve resultados + novos estados. O mesmo código roda no processamento real, nas simulações
// administrativas e nos testes. O combate usa o motor oficial `runLeagueCombat`.
import type { ArenaTurnLog } from "@/lib/arena-z";
import { runLeagueCombat, toLeagueMascot, type LeagueMascot } from "@/lib/league-combat";
import { getCombatRoleLabel } from "@/lib/combat-roles";
import { hashStr } from "@/lib/league-pairing";
import { PT, type ReiConfig } from "./config";
import { analyzeBattle, emptyAgg, mergeAgg, sumAggs, type Fighter, type MascotAgg, type MascotMatchStats, type TeamMatchStats } from "./scoring";
import { buildStandings, modifierPct, pairRound, type PastMatch, type StandRow } from "./standings";
import { applyBattleToState, aliveCount, chooseActives, diffActives, exhaustedSlots, type DayState, type Formation, type MascotSnap, type Substitution } from "./team";

export type Runtime = {
  pid: string; name: string; isBot?: boolean;
  roster: Map<string, MascotSnap>;
  formation: Formation; // formação efetiva congelada do dia
  state: DayState;
  aggs: Record<string, MascotAgg>;
  wins: number; losses: number; draws: number; byes: number; damage: number;
};

export type SideSummary = {
  pid: string; name: string;
  lineup: Fighter[];
  before: DayState; after: DayState;
  substitutions: Substitution[];
  exhaustedSlots: number;
  rank: number; modifierPct: number; topStreak: number;
  team: TeamMatchStats;
};
export type MatchSummary = {
  roundIndex: number; dayIndex: number; rounds: number; winner: "A" | "B" | "DRAW"; exhausted: "A" | "B" | "BOTH" | null;
  A: SideSummary; B: SideSummary | null;
};
export type MatchOutcome = {
  aId: string; bId: string | null; winnerId: string | null; isDraw: boolean; seed: string;
  summary: MatchSummary | { bye: true; roundIndex: number; dayIndex: number };
  stats: { A: MascotMatchStats[]; B: MascotMatchStats[] };
  replay: ArenaTurnLog[] | null;
};

export type FightFn = (a: LeagueMascot[], b: LeagueMascot[], startHp: Map<string, number>, seed: string, maxRounds?: number) => { log: ArenaTurnLog[]; finalHp: Record<string, number>; rounds: number; winner: "A" | "B" | "DRAW" };

/** Mulberry32: torna o motor (que usa Math.random) reproduzível a partir da seed registrada. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => { t = (t + 0x6d2b79f5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
export function withSeededRandom<T>(seed: string, fn: () => T): T {
  const prev = Math.random;
  Math.random = mulberry32(hashStr(seed) || 1);
  try { return fn(); } finally { Math.random = prev; }
}

export const officialFight: FightFn = (a, b, startHp, seed, maxRounds) => {
  const r = withSeededRandom(seed, () => runLeagueCombat(a, b, null, [], [], { startingHp: startHp, includeFinalHp: true, ...(maxRounds && maxRounds < 150 ? { maxRounds } : {}) }));
  return { log: r.log, finalHp: r.finalHpById ?? {}, rounds: r.rounds, winner: r.winner };
};

function buildLineup(rt: Runtime, pct: number): { mascots: LeagueMascot[]; fighters: Fighter[] } {
  const mascots: LeagueMascot[] = [];
  const fighters: Fighter[] = [];
  rt.state.active.forEach((id, i) => {
    if (!id) return;
    const snap = rt.roster.get(id);
    const st = rt.state.mascots[id];
    if (!snap || !st || st.dead || st.hp <= 0) return;
    const m = toLeagueMascot({ ...snap, playerId: rt.pid, diseasedAt: null }, i + 1, rt.formation.slots[i].role);
    // Pressão/Calor: só estas estatísticas, só neste combate. HP máximo e Agilidade (iniciativa) ficam intactos.
    if (pct !== 0) {
      const k = 1 + pct / 100;
      for (const s of ["force", "instinct", "vitality", "charisma"] as const) m[s] = Math.max(1, Math.round(m[s] * k));
    }
    m.hp = st.max; // HP máximo persistente do evento
    mascots.push(m);
    fighters.push({ id, name: m.name, pokemonId: m.pokemonId, role: getCombatRoleLabel(m.combatRole), slot: i + 1, maxHp: st.max, startHp: st.hp });
  });
  return { mascots, fighters };
}

const dmgOf = (s: TeamMatchStats) => s.damageDealt;

function applySide(rt: Runtime, stats: MascotMatchStats[], outcome: "W" | "L" | "D", day: number) {
  for (const s of stats) rt.aggs[s.id] = mergeAgg(rt.aggs[s.id] ?? emptyAgg(s), s, outcome, day);
  if (outcome === "W") rt.wins++; else if (outcome === "L") rt.losses++; else rt.draws++;
}

export function runMatch(a: Runtime, b: Runtime, ctx: { roundIndex: number; dayIndex: number; seed: string; cfg: ReiConfig; rowA?: StandRow; rowB?: StandRow; fight?: FightFn }): MatchOutcome {
  const { cfg, seed } = ctx;
  const fight = ctx.fight ?? officialFight;
  const pctA = modifierPct(ctx.rowA, cfg);
  const pctB = modifierPct(ctx.rowB, cfg);
  const la = buildLineup(a, pctA);
  const lb = buildLineup(b, pctB);
  const beforeA = structuredClone(a.state);
  const beforeB = structuredClone(b.state);
  const topStreak = { A: ctx.rowA?.topStreak ?? 0, B: ctx.rowB?.topStreak ?? 0 };

  let log: ArenaTurnLog[] = [];
  let finalHp: Record<string, number> = {};
  let rounds = 0;
  let winner: "A" | "B" | "DRAW";
  let exhausted: MatchSummary["exhausted"] = null;
  if (la.mascots.length === 0 || lb.mascots.length === 0) {
    // Time sem combatentes: o outro vence sem luta (sem dano, sem KOs; só pontos de vitória).
    exhausted = la.mascots.length === 0 && lb.mascots.length === 0 ? "BOTH" : la.mascots.length === 0 ? "A" : "B";
    winner = exhausted === "BOTH" ? "DRAW" : exhausted === "A" ? "B" : "A";
    for (const f of [...la.fighters, ...lb.fighters]) finalHp[f.id] = f.startHp;
  } else {
    const startHp = new Map([...la.fighters, ...lb.fighters].map((f) => [f.id, f.startHp]));
    const r = fight(la.mascots, lb.mascots, startHp, seed, cfg.maxRounds);
    log = r.log; finalHp = r.finalHp; rounds = r.rounds; winner = r.winner;
    const notes: string[] = [];
    if (pctA) notes.push(`${a.name}: ${pctA > 0 ? "Calor da Lareira +" : "Pressão do Trono "}${pctA}%`);
    if (pctB) notes.push(`${b.name}: ${pctB > 0 ? "Calor da Lareira +" : "Pressão do Trono "}${pctB}%`);
    if (notes.length && log.length) {
      const first = log.find((e) => e.turn !== 0) ?? log[0];
      log = [{ ...first, turn: 0, action: "DEFEND", damage: 0, targetId: first.actorId, targetName: first.actorName, targetOwnerId: first.actorOwnerId, effect: `Equilíbrio do evento: ${notes.join(" · ")} em Força, Instinto, Vitalidade e Carisma neste combate.` }, ...log];
    }
  }

  const an = analyzeBattle({ log, sideA: la.fighters, sideB: lb.fighters, finalHp, rounds: Math.max(1, rounds), winner, cfg, topStreak });
  const statsA = [...an.A.values()];
  const statsB = [...an.B.values()];
  const sideOutcome = (side: "A" | "B") => (winner === "DRAW" ? "D" : winner === side ? "W" : "L") as "W" | "L" | "D";
  applySide(a, statsA, sideOutcome("A"), ctx.dayIndex); applySide(b, statsB, sideOutcome("B"), ctx.dayIndex);
  a.damage += dmgOf(an.teams.A); b.damage += dmgOf(an.teams.B);

  // Estado pós-combate + escolha dos ativos do PRÓXIMO combate (nunca durante o atual).
  const hpA = Object.fromEntries(la.fighters.map((f) => [f.id, finalHp[f.id] ?? f.startHp]));
  const hpB = Object.fromEntries(lb.fighters.map((f) => [f.id, finalHp[f.id] ?? f.startHp]));
  a.state = applyBattleToState(a.formation, a.state, hpA, cfg);
  b.state = applyBattleToState(b.formation, b.state, hpB, cfg);

  const side = (rt: Runtime, l: ReturnType<typeof buildLineup>, before: DayState, row: StandRow | undefined, pct: number, team: TeamMatchStats, s: "A" | "B"): SideSummary => ({
    pid: rt.pid, name: rt.name, lineup: l.fighters, before, after: rt.state,
    substitutions: diffActives(before.active, rt.state.active, rt.state),
    exhaustedSlots: exhaustedSlots(rt.formation, rt.state), rank: row?.rank ?? 0, modifierPct: pct, topStreak: topStreak[s], team,
  });
  const summary: MatchSummary = {
    roundIndex: ctx.roundIndex, dayIndex: ctx.dayIndex, rounds, winner, exhausted,
    A: side(a, la, beforeA, ctx.rowA, pctA, an.teams.A, "A"),
    B: side(b, lb, beforeB, ctx.rowB, pctB, an.teams.B, "B"),
  };
  return {
    aId: a.pid, bId: b.pid, winnerId: winner === "A" ? a.pid : winner === "B" ? b.pid : null, isDraw: winner === "DRAW", seed, summary,
    stats: { A: statsA, B: statsB }, replay: log.length ? log : null,
  };
}

export type RoundInput = {
  editionId: string; roundIndex: number; dayIndex: number; cfg: ReiConfig;
  snapshot: StandRow[]; players: Runtime[]; past: PastMatch[]; fight?: FightFn;
};
export type RoundResult = { matches: MatchOutcome[]; players: Runtime[]; standings: StandRow[] };

/** Executa uma rodada inteira. A ordem das batalhas não importa: todas leem só o snapshot e o estado pré-rodada. */
export function runRound(input: RoundInput): RoundResult {
  const { cfg, snapshot, past, roundIndex, dayIndex } = input;
  const byId = new Map(input.players.map((p) => [p.pid, p]));
  const rows = new Map(snapshot.map((r) => [r.pid, r]));
  const seedBase = `${input.editionId}:r${roundIndex}`;
  const pairs = pairRound(snapshot, past, dayIndex, seedBase);
  const matches: MatchOutcome[] = [];
  for (const pair of pairs) {
    const a = byId.get(pair.aId)!;
    if (!pair.bId) { a.byes++; matches.push({ aId: a.pid, bId: null, winnerId: null, isDraw: false, seed: seedBase, summary: { bye: true, roundIndex, dayIndex }, stats: { A: [], B: [] }, replay: null }); continue; }
    const b = byId.get(pair.bId)!;
    matches.push(runMatch(a, b, { roundIndex, dayIndex, seed: `${seedBase}:${a.pid}`, cfg, rowA: rows.get(a.pid), rowB: rows.get(b.pid), fight: input.fight }));
  }
  const standings = buildStandings(
    input.players.map((p) => ({ pid: p.pid, name: p.name, isBot: p.isBot, score: sumAggs(p.aggs), wins: p.wins, losses: p.losses, draws: p.draws, byes: p.byes, damage: p.damage })),
    snapshot, cfg,
  );
  return { matches, players: input.players, standings };
}

/** Classificação inicial (todos zerados) usada na 1ª rodada. */
export function initialStandings(players: Pick<Runtime, "pid" | "name" | "isBot">[], cfg: ReiConfig): StandRow[] {
  return buildStandings(players.map((p) => ({ pid: p.pid, name: p.name, isBot: p.isBot, score: 0, wins: 0, losses: 0, draws: 0, byes: 0, damage: 0 })), null, cfg);
}

export function nightlyRecovery(rt: Runtime, formation: Formation, fresh: DayState) {
  rt.formation = formation; rt.state = fresh;
}

export const totalScoreOf = (rt: Runtime) => sumAggs(rt.aggs);
export { chooseActives, aliveCount, PT };
