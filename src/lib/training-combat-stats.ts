import { getPokemonTypes, getTypeLabelPt } from "./mascot-data";
import type { TrainingObjectiveType } from "./training-milestones";

/** Entrada mínima do log de combate (ArenaTurnLog gravado em replayJson). */
export type CombatLogEntry = {
  turn?: number; round?: number; reaction?: boolean; action?: string; damage?: number;
  actorId?: string; targetId?: string; actorRole?: string; targetRole?: string;
  typeStep?: number; effect?: string; guardianIntercept?: { mascotId: string; damage: number };
};
/** Lineup gravada em resultJson (Liga Semanal usa maxHp, Liga Rush guarda o mascote inteiro com hp). */
export type CombatLineupMascot = {
  id: string; ownerId?: string | null; pokemonId?: number; name?: string; maxHp?: number; hp?: number; role?: string;
  force?: number; agility?: number; instinct?: number; vitality?: number; charisma?: number;
};

export type MascotBattleStats = {
  counts: Partial<Record<TrainingObjectiveType, number>>;
  /** K.O.s em inimigos, por nome PT do tipo / por rótulo da postura (qualquer aliado dá o golpe final). */
  typeKos: Record<string, number>;
  roleKos: Record<string, number>;
  /** Afinidade de personalidade medida no log (PROUD, MISCHIEVOUS, DRAMATIC, SERENE, LOYAL, CHAOTIC e COMPETITIVE quando há atributos). */
  affinity: Record<string, number>;
  /** Objetivos de afinidade especiais por postura+personalidade (EXEC_COMPETITIVE, PURIFIER_LOYAL, COMMANDER_LOYAL). */
  special: Record<string, number>;
  /** O log traz `round`? Sem ele, objetivos baseados em round não são medidos. */
  hasRounds: boolean;
};

const maxHpOf = (m: CombatLineupMascot) => Math.max(1, Number(m.maxHp ?? m.hp) || 1);

/**
 * Lê UM combate de liga já resolvido e devolve, por mascote, o que cada objetivo da jornada de postura
 * contaria. Função pura: o mesmo código serve ao combate ao vivo e à recuperação retroativa.
 */
export function extractBattleStats(input: {
  log: CombatLogEntry[]; lineupA: CombatLineupMascot[]; lineupB: CombatLineupMascot[];
  winner: "A" | "B" | "DRAW"; rounds: number;
}): Map<string, MascotBattleStats> {
  const { log, lineupA, lineupB, winner, rounds } = input;
  const teamOf = new Map<string, "A" | "B">();
  const info = new Map<string, CombatLineupMascot>();
  for (const m of lineupA) { teamOf.set(m.id, "A"); info.set(m.id, m); }
  for (const m of lineupB) { teamOf.set(m.id, "B"); info.set(m.id, m); }
  const hp = new Map<string, number>([...info].map(([id, m]) => [id, maxHpOf(m)]));
  const hasRounds = log.some((e) => typeof e.round === "number");
  // Arena-Z guarda o nº de ações em `rounds`; com `round` no log o total real é o maior round.
  const totalRounds = hasRounds ? Math.max(...log.map((e) => e.round ?? 0)) : rounds;

  const stats = new Map<string, MascotBattleStats>();
  const bump = (id: string, type: TrainingObjectiveType, n = 1) => {
    const s = stats.get(id)!; s.counts[type] = (s.counts[type] ?? 0) + n;
  };
  for (const id of info.keys()) stats.set(id, { counts: {}, typeKos: {}, roleKos: {}, affinity: {}, special: {}, hasRounds });

  const deathRound = new Map<string, number>();
  const kosByTeamBattle = { A: 0, B: 0 };
  const directAttacks = new Map<string, number>();
  const actedRounds = new Map<string, Set<number>>();
  const focus = new Map<string, Map<string, Set<string>>>(); // round -> alvo -> atacantes
  const pressure: Array<{ id: string; round: number }> = [];
  const roleOfDead = new Map<string, string>();
  const debuffed = new Set<string>();
  const provoked = new Set<string>();
  const names = new Map<string, string>();
  for (const [id, m] of info) if (m.name) names.set(id, m.name);
  for (const e of log) { if (e.actorId && (e as { actorName?: string }).actorName) names.set(e.actorId, (e as { actorName?: string }).actorName!); if (e.targetId && (e as { targetName?: string }).targetName) names.set(e.targetId, (e as { targetName?: string }).targetName!); }
  const statTotal = (id: string) => { const m = info.get(id); return m && m.force != null ? (m.force ?? 0) + (m.agility ?? 0) + (m.instinct ?? 0) + (m.vitality ?? 0) + (m.charisma ?? 0) : null; };
  const loyalMate = new Map<string, string>();
  const attacks: Array<{ actor: string; target: string; targetPct: number; killed: boolean }> = [];
  const protections: Array<{ by: string; ally: string; pct: number }> = [];
  const hitHigherStat = new Set<string>();
  const koHigherStat = new Map<string, number>();
  const buffHits = new Map<string, { enc: number; scout: number }>();
  const roleOf = new Map<string, string>();
  for (const e of log) { if (e.actorId && e.actorRole) roleOf.set(e.actorId, e.actorRole); if (e.targetId && e.targetRole) roleOf.set(e.targetId, e.targetRole); }

  for (const e of log) {
    if (!e.actorId || !e.targetId || !info.has(e.actorId) || !info.has(e.targetId) || !e.turn) continue;
    const actor = e.actorId, target = e.targetId;
    const round = e.round;
    if (round != null) { (actedRounds.get(actor) ?? actedRounds.set(actor, new Set()).get(actor)!).add(round); }

    if (e.action === "HEAL") {
      const max = maxHpOf(info.get(target)!), before = hp.get(target) ?? 0;
      const healed = Math.max(0, Math.min(max, before + (e.damage ?? 0)) - before);
      hp.set(target, before + healed);
      if (actor !== target && healed >= max * 0.05) bump(actor, "HEALS");
      if (actor !== target && before / max < 0.5 && healed > 0) { bump(actor, "PROTECT_DANGER"); protections.push({ by: actor, ally: target, pct: before / max }); }
      continue;
    }
    // Dano de postura (Artilheiro, Revidador, Explosivo): tira HP mas não é ataque direto do mascote.
    if (e.action === "ATTACK" && e.reaction) {
      const before = hp.get(target) ?? 0, lost = Math.min(e.damage ?? 0, before);
      hp.set(target, before - lost);
      if (before > 0 && before - lost <= 0 && round != null) deathRound.set(target, round);
      continue;
    }
    if (e.action !== "ATTACK" || !(e.damage! > 0) || teamOf.get(actor) === teamOf.get(target)) continue;

    const side = teamOf.get(actor)!;
    const enemies = [...info.keys()].filter((id) => teamOf.get(id) !== side);
    const aliveEnemies = enemies.filter((id) => (hp.get(id) ?? 0) > 0);
    const lowestEnemy = aliveEnemies.sort((x, y) => (hp.get(x) ?? 0) - (hp.get(y) ?? 0))[0];

    bump(actor, "DIRECT_ATTACKS");
    directAttacks.set(actor, (directAttacks.get(actor) ?? 0) + 1);
    if (lowestEnemy === target) bump(actor, "LOWEST_HP_ATTACK");
    const step = e.typeStep ?? 0;
    if (step >= 2) bump(actor, "ULTRA_EFFECTIVE");
    else if (step === 1) bump(actor, "SUPER_EFFECTIVE");
    if (step <= -2) bump(target, "HEAVILY_RESISTED_HITS");
    else if (step === -1) bump(target, "RESISTED_HITS");
    if (/reduziu|Travessura de/i.test(e.effect ?? "")) {
      if (/Oportunista reduziu/.test(e.effect ?? "")) bump(actor, "DEBUFFS");
      debuffed.add(target);
      if (/Travessura de/.test(e.effect ?? "")) stats.get(actor)!.affinity.MISCHIEVOUS = 1;
    }
    if (/último ato/i.test(e.effect ?? "")) stats.get(target)!.affinity.DRAMATIC = 1;
    if (/Provocador desviou/.test(e.effect ?? "")) provoked.add(target);
    const actorName = names.get(actor);
    if (actorName && (e.effect ?? "").includes(`Leal ${actorName} `)) {
      for (const [id, nm] of names) if (id !== actor && teamOf.get(id) === side && ((e.effect ?? "").includes(`protege ${nm}.`) || (e.effect ?? "").includes(`defende ${nm} em perigo`))) loyalMate.set(actor, id);
    }
    // Buffs de apoio (Encorajador/Batedor): cada ataque de um aliado que recebeu o bônus conta para o mascote de apoio.
    for (const [id, role] of roleOf) {
      if (id === actor || teamOf.get(id) !== side || (hp.get(id) ?? 0) <= 0) continue;
      const bh = buffHits.get(id) ?? { enc: 0, scout: 0 };
      if (role === "Encorajador" && /Encorajador: \+/.test(e.effect ?? "")) bh.enc++;
      if (role === "Batedor" && /Batedor: \+/.test(e.effect ?? "")) bh.scout++;
      buffHits.set(id, bh);
    }
    const aStat = statTotal(actor), tStat = statTotal(target);
    if (aStat != null && tStat != null && tStat > aStat) hitHigherStat.add(actor);

    // dano efetivo (não passa do HP que restava) + Guardião
    const before = hp.get(target) ?? 0;
    attacks.push({ actor, target, targetPct: before / maxHpOf(info.get(target)!), killed: before - Math.min(e.damage!, before) <= 0 });
    const dealt = Math.min(e.damage!, before);
    hp.set(target, before - dealt);
    stats.get(actor)!.counts.DAMAGE = (stats.get(actor)!.counts.DAMAGE ?? 0) + dealt / maxHpOf(info.get(actor)!);
    if (e.guardianIntercept && info.has(e.guardianIntercept.mascotId)) {
      const g = e.guardianIntercept.mascotId;
      const gBefore = hp.get(g) ?? 0;
      if (before / maxHpOf(info.get(target)!) < 0.5) { bump(g, "PROTECT_DANGER"); protections.push({ by: g, ally: target, pct: before / maxHpOf(info.get(target)!) }); }
      hp.set(g, Math.max(0, gBefore - e.guardianIntercept.damage));
      if (gBefore > 0 && (hp.get(g) ?? 0) <= 0) { if (round != null) deathRound.set(g, round); }
    }

    if (round != null) {
      const byTarget = focus.get(String(round)) ?? focus.set(String(round), new Map()).get(String(round))!;
      (byTarget.get(target) ?? byTarget.set(target, new Set()).get(target)!).add(actor);
      if ((hp.get(actor) ?? 0) / maxHpOf(info.get(actor)!) < 0.5) pressure.push({ id: actor, round });
    }

    if (before > 0 && (hp.get(target) ?? 0) <= 0) {
      kosByTeamBattle[side]++;
      bump(actor, "KOS");
      const kaStat = statTotal(actor), ktStat = statTotal(target);
      if (kaStat != null && ktStat != null && ktStat > kaStat) koHigherStat.set(actor, (koHigherStat.get(actor) ?? 0) + 1);
      if (round != null) deathRound.set(target, round);
      const types = getPokemonTypes(info.get(target)!.pokemonId ?? 0).map(getTypeLabelPt);
      const role = e.targetRole ?? info.get(target)!.role ?? "";
      roleOfDead.set(target, role);
      // todo mascote do time do atacante ganha o K.O. por tipo/postura ("qualquer aliado pode dar o golpe final")
      for (const [id] of stats) {
        if (teamOf.get(id) !== side) continue;
        for (const t of types) stats.get(id)!.typeKos[t] = (stats.get(id)!.typeKos[t] ?? 0) + 1;
        if (role) stats.get(id)!.roleKos[role] = (stats.get(id)!.roleKos[role] ?? 0) + 1;
      }
    }
  }

  const aliveAtEnd = (id: string) => (hp.get(id) ?? 0) > 0;
  for (const [id, s] of stats) {
    const side = teamOf.get(id)!;
    const mates = [...info.keys()].filter((x) => teamOf.get(x) === side);
    const won = winner === side;
    if (kosByTeamBattle[side] >= 2) s.counts.MULTI_KO_BATTLE = 1;
    if (aliveAtEnd(id) && mates.filter(aliveAtEnd).length === 1 && mates.length > 1) s.counts.LAST_SURVIVOR = 1;
    if (debuffed.has(id) && aliveAtEnd(id)) s.counts.SURVIVE_DEBUFF = 1;
    if ((debuffed.has(id) || provoked.has(id)) && aliveAtEnd(id)) s.affinity.SERENE = 1;
    if (won && debuffed.has(id)) s.affinity.CHAOTIC = 1;
    if (won && hitHigherStat.has(id)) s.affinity.COMPETITIVE = 1;
    if (koHigherStat.get(id)) s.special.EXEC_COMPETITIVE = koHigherStat.get(id)!;
    const mate = loyalMate.get(id);
    if (mate) {
      if (won && aliveAtEnd(mate)) s.affinity.LOYAL = 1;
      const prot = protections.filter((p) => p.by === id && p.ally === mate).length;
      if (prot) s.special.PURIFIER_LOYAL = prot;
      const aggressors = new Set(attacks.filter((a) => a.target === mate && a.targetPct < 0.5).map((a) => a.actor));
      const kos = attacks.filter((a) => a.actor === id && a.killed && aggressors.has(a.target)).length;
      if (kos) s.special.COMMANDER_LOYAL = kos;
    }
    const bh = buffHits.get(id);
    if (bh && bh.enc + bh.scout > 0) s.counts.BUFFS = bh.enc + bh.scout;
    if (won && aliveAtEnd(id) && (hp.get(id) ?? 0) / maxHpOf(info.get(id)!) > 0.7) s.affinity.PROUD = 1;
    if (!hasRounds) continue;
    const alive = (r: number) => (deathRound.has(id) ? deathRound.get(id)! >= r : totalRounds >= r);
    if (alive(3)) s.counts.TURN_THREE_HOLD = 1;
    if (alive(5)) s.counts.TURN_FIVE_HOLD = 1;
    if ((directAttacks.get(id) ?? 0) >= 3) s.counts.THIRD_ATTACK = 1;
    const acted = actedRounds.get(id) ?? new Set<number>();
    const survivesThrough = (r: number) => !deathRound.has(id) || deathRound.get(id)! > r;
    for (const r of acted) if (acted.has(r + 1) && acted.has(r + 2) && survivesThrough(r + 2)) { s.counts.ROUND_SURVIVAL = 1; break; }
    for (const [, byTarget] of focus) for (const [, attackers] of byTarget)
      if (attackers.has(id) && attackers.size >= 2) s.counts.FOCUS_CHAIN = 1;
    const pr = pressure.filter((p) => p.id === id && survivesThrough(p.round + 1)).length;
    if (pr) s.counts.PRESSURE_UNDER_RISK = pr;
  }
  return stats;
}
