import {
  getAccumulatorDamagePct, getArtillerySplashPct, getCorrosiveWoundPct, getExecutorThreshold,
  getFortressStatPct, getStrategistAgilityPct, getBloodthirstyLifeSteal, scaleCombatRoleEffect,
} from "./combat-roles";
import { debuffResistanceFactor } from "./personality-combat";

/**
 * Efeitos das 13 posturas desbloqueáveis, num resolvedor único usado pelos dois motores
 * (league-combat e arena-z). Sem nenhuma dessas posturas em campo o motor nem é criado
 * (`createStanceEngine` devolve null), então o combate antigo não muda em nada.
 * Contrato: docs/superpowers/specs/2026-11-02-posturas-desbloqueaveis-producao-design.md.
 */
export const UNLOCKABLE_STANCES = [
  "EXECUTOR", "COMMANDER", "PURIFIER", "BLOODTHIRSTY", "ARTILLERY", "RETRIBUTOR", "CORROSIVE",
  "STRATEGIST", "UNSHAKABLE", "FORTRESS", "ACCUMULATOR", "EXPLOSIVE", "TRAPPER",
] as const;
const STANCE_SET = new Set<string>(UNLOCKABLE_STANCES);

/** Números de equilíbrio que não vêm de atributos. Explosivo: fração do HP atual somada ao dano-base do 3º ataque. */
export const STANCE_TUNING = { explosiveHpPct: 1, explosiveLeftPct: 0.01, retributorPct: 0.1 };

export type StanceMascot = {
  id: string; name: string; level: number; combatRole: string; hp: number;
  force: number; agility: number; instinct: number; vitality: number; charisma: number;
};
type Stat = "force" | "agility" | "instinct" | "vitality";
type DebuffMap = Map<string, Partial<Record<Stat, number>>>;

/** Evento extra gerado por uma postura: o motor transforma em linha de log (sempre com `reaction: true`). */
export type StanceReaction = {
  kind: "HEAL" | "HIT" | "SELF_KO"; actorId: string; targetId: string; amount: number; hpAfter: number; text: string;
};

export type StanceState = {
  purifierGain: Record<string, number>; purifierLast: Record<string, number>;
  stratBonus: Record<string, Record<string, number>>;
  fortressHits: Record<string, number>; shield: Record<string, number>;
  wound: Record<string, { pct: number; until: number }>;
  accCharges: Record<string, number>; accActed: string[];
  directCount: Record<string, number>;
  commanderDone: string[];
  order: Record<string, { targetId: string; commanderId: string; expires: number; used: string[] }>;
  trap: { round: number; sides: string[] };
  oppTagged: string[];
  execUsed: string[]; artUsed: string[]; retUsed: string[];
  dmgTaken: Record<string, number>; firstAgg: Record<string, string>;
  bloodHeal: Record<string, number>; marks: Record<string, string>;
  pendingExplosive: string | null;
};

const emptyState = (): StanceState => ({
  purifierGain: {}, purifierLast: {}, stratBonus: {}, fortressHits: {}, shield: {}, wound: {},
  accCharges: {}, accActed: [], directCount: {}, commanderDone: [], order: {}, trap: { round: 0, sides: [] },
  oppTagged: [], execUsed: [], artUsed: [], retUsed: [], dmgTaken: {}, firstAgg: {}, bloodHeal: {}, marks: {},
  pendingExplosive: null,
});

const isStance = (m: { combatRole: string }, role: string) => m.combatRole === role;

export class StanceEngine<M extends StanceMascot> {
  readonly state: StanceState;
  private reg = new Map<string, M>();
  private sideOfId = new Map<string, string>();
  private base = new Map<string, Record<Stat | "charisma", number>>();
  private round = 0;

  constructor(private hp: Map<string, number>, teams: Record<string, M[]>, restore?: StanceState) {
    this.state = restore ? { ...emptyState(), ...restore } : emptyState();
    for (const [side, list] of Object.entries(teams)) this.addTeam(side, list);
  }

  addTeam(side: string, list: M[]) {
    for (const m of list) {
      this.reg.set(m.id, m); this.sideOfId.set(m.id, side);
      this.base.set(m.id, { force: m.force, agility: m.agility, instinct: m.instinct, vitality: m.vitality, charisma: m.charisma });
    }
  }

  private sides() { return [...new Set(this.sideOfId.values())]; }
  private enemySide(side: string) { return this.sides().find((s) => s !== side) ?? side; }
  private alive(side: string) { return [...this.reg.values()].filter((m) => this.sideOfId.get(m.id) === side && (this.hp.get(m.id) ?? 0) > 0); }
  private hpOf(id: string) { return this.hp.get(id) ?? 0; }
  private b(id: string) { return this.base.get(id)!; }
  /** Bônus de postura da equipe desligados por um Armadilheiro inimigo neste round (não remove o que já estava aplicado). */
  private blocked(id: string) { return this.state.trap.round === this.round && this.state.trap.sides.includes(this.sideOfId.get(id) ?? ""); }
  private active(m: M, role: string) { return isStance(m, role) && !this.blocked(m.id) && this.hpOf(m.id) > 0; }
  private lowestHp(list: M[]) { return [...list].sort((x, y) => this.hpOf(x.id) - this.hpOf(y.id))[0]; }
  private damageTo(id: string, amount: number) {
    const before = this.hpOf(id); const dealt = Math.min(amount, before);
    this.hp.set(id, before - dealt); return dealt;
  }

  /** Multiplicador de atributo vindo das posturas (Purificador, Estrategista, Fortaleza). Estados já aplicados continuam mesmo sob bloqueio. */
  statMult(id: string, stat: Stat) {
    const s = this.state;
    if (stat === "agility") {
      const strat = Object.entries(s.stratBonus[id] ?? {}).filter(([sid]) => this.hpOf(sid) > 0).reduce((sum, [, v]) => sum + v, 0);
      return (1 + (s.purifierGain[id] ?? 0)) * (1 + Math.min(0.2, strat));
    }
    const m = this.reg.get(id);
    if (!m || !(id in s.fortressHits)) return 1;
    const pct = Math.min(0.2, (s.fortressHits[id] ?? 0) * getFortressStatPct(this.b(id).vitality, this.b(id).instinct));
    return stat === "force" ? 1 - pct : stat === "vitality" || stat === "instinct" ? 1 + pct : 1;
  }

  /** Ferida do Corrosivo: reduz a cura efetiva recebida. */
  healFactor(id: string) {
    const w = this.state.wound[id];
    return w && this.round <= w.until ? 1 - w.pct : 1;
  }

  tagOpportunist(targetId: string) { if (!this.state.oppTagged.includes(targetId)) this.state.oppTagged.push(targetId); }

  roundStart(round: number, debuffs: DebuffMap) {
    this.round = round; const s = this.state;
    s.execUsed = []; s.artUsed = []; s.retUsed = []; s.dmgTaken = {}; s.firstAgg = {}; s.bloodHeal = {}; s.marks = {}; s.accActed = [];
    // Armadilheiro: rounds 3 e 5 desligam os bônus de postura da equipe inimiga.
    if (round === 3 || round === 5) {
      const sides = this.sides().filter((side) => this.alive(this.enemySide(side)).some((m) => isStance(m, "TRAPPER")));
      s.trap = { round, sides };
    }
    // Purificador: a cada dois rounds limpa até duas reduções de Oportunista do aliado de menor % de HP.
    for (const m of [...this.reg.values()]) {
      if (!this.active(m, "PURIFIER") || (round - (s.purifierLast[m.id] ?? -9)) < 2) continue;
      s.purifierLast[m.id] = round;
      const side = this.sideOfId.get(m.id)!;
      const ally = [...this.alive(side)].sort((x, y) => this.hpOf(x.id) / x.hp - this.hpOf(y.id) / y.hp)[0];
      if (!ally || !s.oppTagged.includes(ally.id)) continue;
      const entry = debuffs.get(ally.id); if (!entry) continue;
      let removed = 0;
      for (const stat of ["agility", "vitality"] as const) if (removed < 2 && (entry[stat] ?? 0) > 0) { delete entry[stat]; removed++; }
      if (removed > 0) s.purifierGain[m.id] = scaleCombatRoleEffect((this.b(m.id).agility + this.b(m.id).charisma) / 2, 0.05, 0.20);
    }
  }

  roundEnd() {
    const s = this.state;
    for (const id of s.accActed) if (this.hpOf(id) > 0) s.accCharges[id] = Math.min(3, (s.accCharges[id] ?? 0) + 1);
    s.accActed = [];
  }

  /** Início de um ataque direto: pode trocar o alvo (Explosivo, Comandante, Estrategista) e somar bônus de dano. */
  beginAttack(actor: M, opponents: M[], current: M) {
    const s = this.state; const notes: string[] = [];
    s.directCount[actor.id] = (s.directCount[actor.id] ?? 0) + 1;
    let target: M | null = null; let rawAdd = 0; let dmgMult = 1;
    s.pendingExplosive = null;
    if (this.active(actor, "EXPLOSIVE") && s.directCount[actor.id] === 3 && opponents.length) {
      target = [...opponents].sort((x, y) => y.agility * this.statMult(y.id, "agility") - x.agility * this.statMult(x.id, "agility"))[0];
      rawAdd = this.hpOf(actor.id) * STANCE_TUNING.explosiveHpPct; s.pendingExplosive = actor.id;
      notes.push(`Explosivo ${actor.name} mirou o inimigo mais ágil, ${target.name}, somando ${Math.round(STANCE_TUNING.explosiveHpPct * 100)}% da própria vida ao golpe.`);
    }
    const order = s.order[this.sideOfId.get(actor.id) ?? ""];
    if (!target && order && order.commanderId !== actor.id && !order.used.includes(actor.id) && this.round <= order.expires && opponents.length) {
      target = opponents.find((o) => o.id === order.targetId) ?? this.lowestHp(opponents);
      order.targetId = target.id; order.used.push(actor.id);
      notes.push(`Ordem do Comandante: ${actor.name} focou ${target.name}.`);
    }
    if (!target && this.active(actor, "STRATEGIST")) {
      const marked = new Set(Object.values(s.marks));
      if (marked.has(current.id)) { const free = opponents.find((o) => !marked.has(o.id)); if (free) target = free; }
    }
    if (this.active(actor, "ACCUMULATOR")) {
      s.accActed.push(actor.id);
      if ((s.accCharges[actor.id] ?? 0) >= 3) {
        dmgMult = 1 + getAccumulatorDamagePct(this.b(actor.id).force, this.b(actor.id).agility);
        s.accCharges[actor.id] = 0;
        notes.push(`Acumulador ${actor.name} liberou 3 cargas: +${Math.round((dmgMult - 1) * 100)}% de dano.`);
      }
    }
    return { target, rawAdd, dmgMult, notes };
  }

  /** Depois da interceptação e antes de Sobrevivente/Dramático: escudo do alvo e execução. */
  preHit(actor: M, target: M, damage: number) {
    const s = this.state; const notes: string[] = [];
    const shield = s.shield[target.id] ?? 0;
    if (shield > 0 && damage > 0) {
      const absorbed = Math.min(shield, damage);
      s.shield[target.id] = shield - absorbed; damage -= absorbed;
      notes.push(`Escudo de ${target.name} absorveu ${absorbed}.`);
    }
    const cur = this.hpOf(target.id);
    if (this.active(actor, "EXECUTOR") && !s.execUsed.includes(actor.id)) {
      const th = getExecutorThreshold(this.b(actor.id).force, this.b(actor.id).agility);
      if (cur <= th * target.hp) {
        s.execUsed.push(actor.id); damage = Math.max(damage, cur);
        notes.push(`Executor ${actor.name} executou ${target.name} (limiar ${Math.round(th * 100)}% do HP).`);
      }
    }
    return { damage, notes };
  }

  /** Depois do dano aplicado. `dealt` é o HP que o alvo realmente perdeu. */
  postHit(actor: M, target: M, dealt: number) {
    const s = this.state; const reactions: StanceReaction[] = []; const notes: string[] = [];
    const side = this.sideOfId.get(actor.id)!; const eSide = this.sideOfId.get(target.id)!;
    const targetAlive = this.hpOf(target.id) > 0;
    const hit = (by: M, victim: M, amount: number, text: string) => {
      const d = this.damageTo(victim.id, amount);
      reactions.push({ kind: "HIT", actorId: by.id, targetId: victim.id, amount: d, hpAfter: this.hpOf(victim.id), text });
    };

    // Defesa do alvo
    if (this.active(target, "FORTRESS")) {
      s.fortressHits[target.id] = (s.fortressHits[target.id] ?? 0) + 1;
      const pct = Math.min(0.2, s.fortressHits[target.id] * getFortressStatPct(this.b(target.id).vitality, this.b(target.id).instinct));
      notes.push(`Fortaleza ${target.name}: Vitalidade e Instinto +${Math.round(pct * 100)}%, Força -${Math.round(pct * 100)}%.`);
    }
    s.dmgTaken[target.id] = (s.dmgTaken[target.id] ?? 0) + dealt;
    s.firstAgg[target.id] ??= actor.id;

    // Ofensivas do atacante
    if (this.active(actor, "UNSHAKABLE") && this.hpOf(actor.id) > 0) {
      s.shield[actor.id] = Math.round(actor.hp * 0.05);
      notes.push(`Inabalável ${actor.name} renovou o escudo (${s.shield[actor.id]}).`);
    }
    if (this.active(actor, "BLOODTHIRSTY") && dealt > 0 && this.hpOf(actor.id) > 0) {
      const cap = Math.max(0, Math.round(actor.hp * 0.08) - (s.bloodHeal[actor.id] ?? 0));
      const want = Math.floor(dealt * getBloodthirstyLifeSteal(this.b(actor.id).force, this.b(actor.id).vitality));
      const heal = Math.min(cap, Math.round(want * this.healFactor(actor.id)), actor.hp - this.hpOf(actor.id));
      if (heal > 0) {
        this.hp.set(actor.id, this.hpOf(actor.id) + heal); s.bloodHeal[actor.id] = (s.bloodHeal[actor.id] ?? 0) + heal;
        reactions.push({ kind: "HEAL", actorId: actor.id, targetId: actor.id, amount: heal, hpAfter: this.hpOf(actor.id), text: `Sanguinário ${actor.name} recuperou ${heal} HP.` });
      }
    }
    if (this.active(actor, "CORROSIVE") && dealt > 0 && targetAlive) {
      const pct = getCorrosiveWoundPct(this.b(actor.id).force, this.b(actor.id).instinct) * debuffResistanceFactor(actor, target);
      const cur = s.wound[target.id];
      s.wound[target.id] = { pct: Math.max(pct, cur && cur.until >= this.round ? cur.pct : 0), until: this.round + 1 };
      notes.push(`Corrosivo ${actor.name} feriu ${target.name}: cura recebida -${Math.round(pct * 100)}% até o fim do próximo round.`);
    }
    if (this.active(actor, "STRATEGIST") && !s.marks[actor.id]) {
      s.marks[actor.id] = target.id; notes.push(`Estrategista ${actor.name} marcou ${target.name}.`);
    } else {
      for (const strat of this.alive(side)) {
        if (!isStance(strat, "STRATEGIST") || strat.id === actor.id || s.marks[strat.id] !== target.id || this.blocked(strat.id)) continue;
        const pct = getStrategistAgilityPct(this.b(strat.id).instinct, this.b(strat.id).agility);
        (s.stratBonus[actor.id] ??= {})[strat.id] = pct; delete s.marks[strat.id];
        notes.push(`Marca de ${strat.name} cumprida: ${actor.name} ganhou +${Math.round(pct * 100)}% de Agilidade.`);
      }
    }
    if (this.active(actor, "ARTILLERY") && !s.artUsed.includes(actor.id) && dealt > 0) {
      s.artUsed.push(actor.id);
      const other = this.lowestHp(this.alive(eSide).filter((m) => m.id !== target.id));
      if (other) hit(actor, other, Math.max(1, Math.round(dealt * getArtillerySplashPct(this.b(actor.id).force, this.b(actor.id).agility))), `Artilheiro ${actor.name} atingiu também ${other.name}.`);
    }
    if (targetAlive && this.active(target, "RETRIBUTOR") && !s.retUsed.includes(target.id) && (s.dmgTaken[target.id] ?? 0) >= target.hp * 0.15) {
      const aggressor = this.reg.get(s.firstAgg[target.id] ?? "");
      if (aggressor && this.hpOf(aggressor.id) > 0) {
        s.retUsed.push(target.id);
        const b = this.b(target.id);
        hit(target, aggressor, Math.max(1, Math.round(STANCE_TUNING.retributorPct * (b.force * 1.8 + target.level * 2 + b.instinct * 0.7 + 6))), `Revidador ${target.name} revidou contra ${aggressor.name}.`);
      }
    }
    if (!targetAlive && this.active(actor, "COMMANDER") && !s.commanderDone.includes(actor.id)) {
      const foe = this.lowestHp(this.alive(eSide));
      if (foe) {
        s.commanderDone.push(actor.id);
        s.order[side] = { targetId: foe.id, commanderId: actor.id, expires: this.round + 1, used: [] };
        notes.push(`Comandante ${actor.name} deu a ordem: focar ${foe.name}.`);
      }
    }
    if (s.pendingExplosive === actor.id) {
      s.pendingExplosive = null;
      const left = Math.max(1, Math.round(actor.hp * STANCE_TUNING.explosiveLeftPct));
      const d = this.damageTo(actor.id, Math.max(0, this.hpOf(actor.id) - left));
      reactions.push({ kind: "SELF_KO", actorId: actor.id, targetId: actor.id, amount: d, hpAfter: this.hpOf(actor.id), text: `Explosivo ${actor.name} se esgotou na explosão e ficou com ${this.hpOf(actor.id)} HP.` });
    }
    return { notes, reactions };
  }

  snapshot(): StanceState { return JSON.parse(JSON.stringify(this.state)) as StanceState; }
}

/** Cria o motor só se alguma postura desbloqueável estiver em campo; senão o combate segue exatamente como antes. */
export function createStanceEngine<M extends StanceMascot>(hp: Map<string, number>, teams: Record<string, M[]>, restore?: StanceState) {
  const any = Object.values(teams).some((list) => list.some((m) => STANCE_SET.has(m.combatRole)));
  return any ? new StanceEngine<M>(hp, teams, restore) : null;
}
