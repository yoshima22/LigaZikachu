// Pontuação do Rei do Rio: lê o LOG REAL do motor (nada é reexecutado) e distribui um
// orçamento fixo por equipe/combate entre os mascotes, com teto por categoria.
// Cada ponto nasce de uma categoria (damage/ko/support/resilience/win/leadership) e fica
// registrado em `MascotMatchStats.points` -> origem rastreável no relatório.
import type { ArenaTurnLog } from "@/lib/arena-z";
import { PT, type ReiConfig } from "./config";

export type PointCategory = "damage" | "ko" | "support" | "resilience" | "win" | "leadership";
export const CATEGORY_LABELS: Record<PointCategory, string> = {
  damage: "Dano", ko: "KOs e assistências", support: "Suporte", resilience: "Resistência", win: "Vitória", leadership: "Permanência no topo",
};

export type Fighter = { id: string; name: string; pokemonId: number; role: string; slot: number; maxHp: number; startHp: number; ability?: { slug: string; name: string; state: "ACTIVE" | "REDUCED" | "OFF" | "NONE"; factor: number; reason: string | null } | null };

export type MascotMatchStats = {
  id: string; name: string; pokemonId: number; role: string; slot: number; side: "A" | "B";
  startHp: number; endHp: number; survived: boolean; roundsAlive: number;
  damageDealt: number; damageTaken: number; kos: number; assists: number;
  healing: number; mitigated: number; buffs: number; debuffs: number; buffValue: number;
  points: Record<PointCategory, number>; // centésimos
  total: number; // centésimos
};

export type TeamMatchStats = {
  damageDealt: number; damageTaken: number; kos: number; healing: number; survivors: number; pointsTotal: number;
};

const zeroPoints = (): Record<PointCategory, number> => ({ damage: 0, ko: 0, support: 0, resilience: 0, win: 0, leadership: 0 });

/** Divide `pool` (em pontos) proporcionalmente aos pesos; devolve centésimos por id. */
function split(pool: number, weights: Map<string, number>): Map<string, number> {
  const sum = [...weights.values()].reduce((a, b) => a + b, 0);
  const out = new Map<string, number>();
  if (pool <= 0 || sum <= 0) return out;
  for (const [id, w] of weights) if (w > 0) out.set(id, Math.round((pool * w * PT) / sum));
  return out;
}

export type AnalyzeInput = {
  log: ArenaTurnLog[];
  sideA: Fighter[]; sideB: Fighter[];
  finalHp: Record<string, number>;
  rounds: number;
  winner: "A" | "B" | "DRAW";
  cfg: Pick<ReiConfig, "budget" | "supportNormFraction" | "leadershipPerStreak" | "leadershipCap">;
  /** Rodadas consecutivas de cada lado no topo (0 = fora do topo). */
  topStreak?: { A: number; B: number };
};

export function analyzeBattle(input: AnalyzeInput): { A: Map<string, MascotMatchStats>; B: Map<string, MascotMatchStats>; teams: { A: TeamMatchStats; B: TeamMatchStats } } {
  const { log, sideA, sideB, finalHp, rounds, winner, cfg } = input;
  const all = new Map<string, MascotMatchStats>();
  const sideOf = new Map<string, "A" | "B">();
  const hp = new Map<string, number>();
  const max = new Map<string, number>();
  for (const [side, list] of [["A", sideA], ["B", sideB]] as const) {
    for (const f of list) {
      sideOf.set(f.id, side); hp.set(f.id, f.startHp); max.set(f.id, f.maxHp);
      all.set(f.id, {
        id: f.id, name: f.name, pokemonId: f.pokemonId, role: f.role, slot: f.slot, side,
        startHp: f.startHp, endHp: f.startHp, survived: true, roundsAlive: rounds,
        damageDealt: 0, damageTaken: 0, kos: 0, assists: 0, healing: 0, mitigated: 0, buffs: 0, debuffs: 0, buffValue: 0,
        points: zeroPoints(), total: 0,
      });
    }
  }
  const dmgBy = new Map<string, Map<string, number>>(); // vítima -> atacante -> dano efetivo
  const encouragers = (side: "A" | "B") => (side === "A" ? sideA : sideB).filter((f) => f.role === "Encorajador");

  for (const e of log) {
    if (!e || e.turn === 0) continue;
    const actor = all.get(e.actorId);
    const target = all.get(e.targetId);
    if (!actor || !target) continue;
    const round = e.round ?? rounds;

    if (e.action === "ABILITY") {
      // Habilidades: cura efetiva (damage = cura) e debuffs reais com origem registrada.
      const heal = Math.max(0, e.damage);
      if (heal > 0 && e.targetHpAfter !== undefined) {
        const before = hp.get(target.id) ?? 0;
        const eff = Math.min(heal, Math.max(0, (max.get(target.id) ?? before) - before));
        if (actor.id !== target.id && actor.side === target.side) actor.healing += eff;
      }
      for (const ev of e.debuffEvents ?? []) {
        if (ev.kind !== "APPLY" || !ev.sourceId) continue;
        const src = all.get(ev.sourceId); const tgt = all.get(ev.targetId);
        if (src && tgt && src.side !== tgt.side) src.debuffs += 1;
      }
      if (e.targetHpAfter !== undefined) {
        hp.set(target.id, Math.max(0, e.targetHpAfter));
        if (e.targetHpAfter <= 0 && target.survived) { target.survived = false; target.roundsAlive = Math.min(target.roundsAlive, round); }
      }
      continue;
    }
    if (e.action === "HEAL") {
      const before = hp.get(target.id) ?? 0;
      const room = Math.max(0, (max.get(target.id) ?? before) - before);
      const eff = Math.min(Math.max(0, e.damage), room);
      hp.set(target.id, before + eff);
      if (actor.id !== target.id) actor.healing += eff; // autocura não é suporte
      continue;
    }
    if (e.action !== "ATTACK" || e.damage <= 0 || actor.id === target.id) continue;

    // Interceptação do Guardião: parte do golpe sai do HP do guardião, não do alvo.
    const gi = e.guardianIntercept;
    const guardian = gi ? all.get(gi.mascotId) : undefined;
    const toGuardian = guardian ? Math.min(gi!.damage, hp.get(guardian.id) ?? 0) : 0;
    if (guardian && toGuardian > 0) {
      hp.set(guardian.id, (hp.get(guardian.id) ?? 0) - toGuardian);
      guardian.damageTaken += toGuardian; guardian.mitigated += toGuardian;
      actor.damageDealt += toGuardian;
      if ((hp.get(guardian.id) ?? 0) <= 0) { guardian.survived = false; guardian.roundsAlive = Math.min(guardian.roundsAlive, round); }
    }
    const before = hp.get(target.id) ?? 0;
    const eff = Math.min(Math.max(0, e.damage - toGuardian), before); // dano excedente não conta
    hp.set(target.id, before - eff);
    actor.damageDealt += eff; target.damageTaken += eff;
    if (eff > 0) {
      const m = dmgBy.get(target.id) ?? new Map<string, number>();
      m.set(actor.id, (m.get(actor.id) ?? 0) + eff);
      dmgBy.set(target.id, m);
    }
    if (before > 0 && before - eff <= 0) {
      target.survived = false; target.roundsAlive = Math.min(target.roundsAlive, round);
      actor.kos += 1;
      const maxHp = max.get(target.id) ?? 1;
      for (const [aid, d] of dmgBy.get(target.id) ?? []) {
        if (aid !== actor.id && d >= maxHp * 0.2 && sideOf.get(aid) === actor.side) all.get(aid)!.assists += 1; // assistência relevante
      }
    }
    // Buff do Encorajador: dano que ele habilitou (só conta se houve dano efetivo).
    const enc = /Encorajador: \+(\d+)%/.exec(e.effect ?? "");
    if (enc && eff > 0) {
      const pct = Number(enc[1]) / 100;
      const owner = encouragers(actor.side).sort((x, y) => (all.get(y.id)!.survived ? 1 : 0) - (all.get(x.id)!.survived ? 1 : 0))[0];
      if (owner) { const s = all.get(owner.id)!; s.buffs += 1; s.buffValue += (eff * pct) / (1 + pct); }
    }
    // Debuff real aplicado (texto do motor). Valor fixo pequeno por aplicação, limitado depois pelo teto.
    if (/Oportunista reduziu/.test(e.effect ?? "")) { actor.debuffs += 1; }
  }

  for (const s of all.values()) { s.endHp = Math.max(0, Math.round(finalHp[s.id] ?? hp.get(s.id) ?? 0)); s.survived = s.endHp > 0; if (s.survived) s.roundsAlive = rounds; }

  const teams = {} as { A: TeamMatchStats; B: TeamMatchStats };
  for (const side of ["A", "B"] as const) {
    const mine = (side === "A" ? sideA : sideB).map((f) => all.get(f.id)!);
    const foes = (side === "A" ? sideB : sideA).map((f) => all.get(f.id)!);
    const foePool = foes.reduce((a, f) => a + (max.get(f.id) ?? 0), 0);
    const size = Math.max(1, mine.length);
    const dealt = mine.reduce((a, s) => a + s.damageDealt, 0);

    // Dano: pool = budget * (dano efetivo / HP total inimigo).
    for (const [id, v] of split(cfg.budget.damage * Math.min(1, dealt / Math.max(1, foePool)), new Map(mine.map((s) => [s.id, s.damageDealt])))) all.get(id)!.points.damage = v;
    // KOs e assistências (assistência vale metade).
    const koW = new Map(mine.map((s) => [s.id, s.kos + s.assists * 0.5]));
    const koScore = [...koW.values()].reduce((a, b) => a + b, 0);
    for (const [id, v] of split(cfg.budget.ko * Math.min(1, koScore / Math.max(1, foes.length)), koW)) all.get(id)!.points.ko = v;
    // Suporte: cura efetiva + dano interceptado + dano habilitado por buffs + debuffs (6% do HP inimigo médio cada).
    const avgFoe = foePool / Math.max(1, foes.length);
    const supVal = new Map(mine.map((s) => [s.id, s.healing + s.mitigated + s.buffValue + s.debuffs * avgFoe * 0.06]));
    const supSum = [...supVal.values()].reduce((a, b) => a + b, 0);
    for (const [id, v] of split(cfg.budget.support * Math.min(1, supSum / Math.max(1, foePool * cfg.supportNormFraction)), supVal)) all.get(id)!.points.support = v;
    // Resistência: sobrevivência ativa x dano suportado, normalizada pelo tamanho da equipe.
    for (const s of mine) {
      const surv = rounds > 0 ? s.roundsAlive / rounds : 1;
      const taken = Math.min(1, s.damageTaken / Math.max(1, max.get(s.id) ?? 1));
      s.points.resilience = Math.round(((cfg.budget.resilience * surv * (0.5 + 0.5 * taken)) / size) * PT);
    }
    // Vitória: dividida entre quem entrou em campo (empate = metade).
    const winPool = winner === side ? cfg.budget.win : winner === "DRAW" ? cfg.budget.win / 2 : 0;
    for (const [id, v] of split(winPool, new Map(mine.map((s) => [s.id, 1])))) all.get(id)!.points.win = v;
    // Permanência no topo: SÓ mascotes ativos que sobreviveram; teto baixo para não valer mais que vencer.
    const streak = input.topStreak?.[side] ?? 0;
    if (streak > 0) {
      const pool = Math.min(cfg.leadershipCap, streak * cfg.leadershipPerStreak);
      for (const [id, v] of split(pool, new Map(mine.filter((s) => s.survived).map((s) => [s.id, 1])))) all.get(id)!.points.leadership = v;
    }
    for (const s of mine) s.total = Object.values(s.points).reduce((a, b) => a + b, 0);
    teams[side] = {
      damageDealt: dealt, damageTaken: mine.reduce((a, s) => a + s.damageTaken, 0), kos: mine.reduce((a, s) => a + s.kos, 0),
      healing: mine.reduce((a, s) => a + s.healing, 0), survivors: mine.filter((s) => s.survived).length,
      pointsTotal: mine.reduce((a, s) => a + s.total, 0),
    };
  }
  return {
    A: new Map(sideA.map((f) => [f.id, all.get(f.id)!])),
    B: new Map(sideB.map((f) => [f.id, all.get(f.id)!])),
    teams,
  };
}

/** Acumulado semanal por mascote (guardado em ReiRioParticipant.scoresJson). */
export type MascotAgg = {
  id: string; name: string; pokemonId: number; matches: number; wins: number; losses: number; draws: number;
  damageDealt: number; damageTaken: number; kos: number; assists: number; healing: number; mitigated: number; buffs: number; debuffs: number;
  activeRounds: number; survivedBattles: number;
  points: Record<PointCategory, number>; total: number;
  byRole: Record<string, number>; // pontos por postura (distribuição por postura)
  byDay: Record<string, number>; // pontos por dia
};

export function emptyAgg(s: Pick<MascotMatchStats, "id" | "name" | "pokemonId">): MascotAgg {
  return { id: s.id, name: s.name, pokemonId: s.pokemonId, matches: 0, wins: 0, losses: 0, draws: 0, damageDealt: 0, damageTaken: 0, kos: 0, assists: 0, healing: 0, mitigated: 0, buffs: 0, debuffs: 0, activeRounds: 0, survivedBattles: 0, points: zeroPoints(), total: 0, byRole: {}, byDay: {} };
}

export function mergeAgg(agg: MascotAgg, s: MascotMatchStats, outcome: "W" | "L" | "D", day: number): MascotAgg {
  const points = { ...agg.points };
  for (const k of Object.keys(points) as PointCategory[]) points[k] += s.points[k];
  return {
    ...agg, matches: agg.matches + 1,
    wins: agg.wins + (outcome === "W" ? 1 : 0), losses: agg.losses + (outcome === "L" ? 1 : 0), draws: agg.draws + (outcome === "D" ? 1 : 0),
    damageDealt: agg.damageDealt + s.damageDealt, damageTaken: agg.damageTaken + s.damageTaken, kos: agg.kos + s.kos, assists: agg.assists + s.assists,
    healing: agg.healing + s.healing, mitigated: agg.mitigated + s.mitigated, buffs: agg.buffs + s.buffs, debuffs: agg.debuffs + s.debuffs,
    activeRounds: agg.activeRounds + s.roundsAlive, survivedBattles: agg.survivedBattles + (s.survived ? 1 : 0),
    points, total: agg.total + s.total,
    byRole: { ...agg.byRole, [s.role]: (agg.byRole[s.role] ?? 0) + s.total },
    byDay: { ...agg.byDay, [String(day)]: (agg.byDay[String(day)] ?? 0) + s.total },
  };
}

export const sumAggs = (aggs: Record<string, MascotAgg>) => Object.values(aggs).reduce((a, m) => a + m.total, 0);
