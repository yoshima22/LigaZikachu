// Motor das habilidades passivas no combate. Só roda quando o Arena Draft passa a opção
// `abilities` ao runArenaCombat: os outros modos não enxergam nada disto.
import type { ArenaMascot } from "@/lib/arena-z";
import { abilityDebuffStat, abilityTypes, abilityValue, getAbilityInfo, type AbilityInfo } from "./index";

export type Stat4 = "force" | "agility" | "instinct" | "vitality";
export type DebuffMap = Map<string, Partial<Record<Stat4, number>>>;

/** Habilidade em uso por mascote e o fator do time (1 = ligada, 0.7 = reduzida, 0 = desligada). */
export type AbilityLineup = Record<string, { slug: string; factor: number }>;

export type DebuffOrigin = { pct: number; sourceId: string | null; sourceName: string; label: string; round: number };
export type DebuffEvent = {
  kind: "APPLY" | "REMOVE";
  targetId: string;
  stat: Stat4;
  pct: number;
  sourceId: string | null;
  sourceName: string;
  label: string;
  round: number;
};

export type AbilityRuntime = {
  started: boolean;
  uses: Record<string, number>;
  /** Bônus de dano do próximo golpe (Embalo, Vingança, Adversidade, Revide). */
  pending: Record<string, { v: number; label: string }>;
  /** Bônus de Agilidade acumulado (Impulso). */
  agility: Record<string, number>;
  ambient: { A: { types: string[]; v: number } | null; D: { types: string[]; v: number } | null };
  /** Postura firme armada (Defensor preparou a defesa). */
  armed: string[];
  /** Origem do maior debuff ativo por atributo. */
  origins: Record<string, Partial<Record<Stat4, DebuffOrigin>>>;
  /** Bônus de Ambiente e Aura do lado anulados nesta rodada (Anula bônus rivais). */
  anular: { A: boolean; D: boolean };
};

export type AbilityStandalone = {
  actor: ArenaMascot;
  target?: ArenaMascot;
  text: string;
  heal?: number;
  hpAfter?: number;
  events?: DebuffEvent[];
};

export type AbilityHost = {
  attackers: ArenaMascot[];
  defenders: ArenaMascot[];
  hp: Map<string, number>;
  debuffs: DebuffMap;
  rand: () => number;
  typesOf: (m: ArenaMascot) => string[];
  getRound: () => number;
};

type Held = { info: AbilityInfo; factor: number };
const REACTION_CHANCE = 0.3;
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const statLabel: Record<Stat4, string> = { force: "Força", agility: "Agilidade", instinct: "Instinto", vitality: "Vitalidade" };

export function emptyAbilityRuntime(): AbilityRuntime {
  return { started: false, uses: {}, pending: {}, agility: {}, ambient: { A: null, D: null }, armed: [], origins: {}, anular: { A: false, D: false } };
}

export function createAbilityEngine(config: AbilityLineup, host: AbilityHost, previous?: AbilityRuntime) {
  const rt: AbilityRuntime = previous
    ? { ...emptyAbilityRuntime(), ...structuredClone(previous) }
    : emptyAbilityRuntime();
  const all = [...host.attackers, ...host.defenders];
  const byId = new Map(all.map((m) => [m.id, m]));
  const sideOf = new Map<string, "A" | "D">();
  host.attackers.forEach((m) => sideOf.set(m.id, "A"));
  host.defenders.forEach((m) => sideOf.set(m.id, "D"));
  const teamOf = (m: ArenaMascot) => (sideOf.get(m.id) === "A" ? host.attackers : host.defenders);
  const foesOf = (m: ArenaMascot) => (sideOf.get(m.id) === "A" ? host.defenders : host.attackers);
  const alive = (list: ArenaMascot[]) => list.filter((m) => (host.hp.get(m.id) ?? 0) > 0);
  const hpOf = (m: ArenaMascot) => host.hp.get(m.id) ?? 0;
  const events: DebuffEvent[] = [];
  const standalone: AbilityStandalone[] = [];
  const hpChanges: Array<{ m: ArenaMascot; hpAfter: number; by: ArenaMascot; text: string; heal?: number }> = [];
  let redirected: string | null = null; // quem foi redirecionado por Para-raios neste golpe

  const held = (m: ArenaMascot): Held | null => {
    const c = config[m.id];
    if (!c || c.factor <= 0) return null;
    const info = getAbilityInfo(c.slug);
    return info?.hasEffect ? { info, factor: c.factor } : null;
  };
  const heldAs = (m: ArenaMascot, code: string): Held | null => {
    const h = held(m);
    return h && h.info.effectCode === code ? h : null;
  };
  const stats = (m: ArenaMascot) => ({ force: m.force, agility: m.agility, charisma: m.charisma, instinct: m.instinct, vitality: m.vitality });
  const value = (m: ArenaMascot, h: Held) => abilityValue(h.info, stats(m), h.factor);
  const hasLeft = (m: ArenaMascot, h: Held) => h.info.activations === 0 || (rt.uses[m.id] ?? 0) < h.info.activations;
  /** Consome uma ativação e devolve o sufixo "(n/max)". */
  const spend = (m: ArenaMascot, h: Held) => {
    if (h.info.activations === 0) return "";
    rt.uses[m.id] = (rt.uses[m.id] ?? 0) + 1;
    return ` (${rt.uses[m.id]}/${h.info.activations})`;
  };
  const say = (m: ArenaMascot, h: Held, text: string) => `✨ ${h.info.name} de ${m.name}${spend(m, h)}: ${text}`;
  const matchesTypes = (h: Held, types: string[]) => {
    const wanted = abilityTypes(h.info);
    return wanted.length > 0 && types.some((t) => wanted.includes(t));
  };
  const immuneIndirect = (m: ArenaMascot) => Boolean(heldAs(m, "IMUNE_INDIRETO"));

  // ── Debuffs ────────────────────────────────────────────────────────────────
  const setDebuff = (target: ArenaMascot, stat: Stat4, amount: number, source: ArenaMascot | null, label: string) => {
    const current = host.debuffs.get(target.id) ?? {};
    if (amount <= (current[stat] ?? 0)) return false; // não soma: vale o maior
    host.debuffs.set(target.id, { ...current, [stat]: amount });
    const origin: DebuffOrigin = { pct: amount, sourceId: source?.id ?? null, sourceName: source?.name ?? "—", label, round: host.getRound() };
    (rt.origins[target.id] ??= {})[stat] = origin;
    events.push({ kind: "APPLY", targetId: target.id, stat, pct: amount, sourceId: origin.sourceId, sourceName: origin.sourceName, label, round: origin.round });
    return true;
  };

  /** Ponto único de aplicação de debuff: aplica Corpo limpo, Véu e Espelho e registra a origem. */
  function applyDebuff(args: { target: ArenaMascot; source: ArenaMascot | null; stat: Stat4; pct: number; label: string }): string[] {
    const notes: string[] = [];
    let amount = args.pct;
    const own = held(args.target);
    if (own?.info.effectCode === "CORPO_LIMPO" && hasLeft(args.target, own)) {
      const v = value(args.target, own);
      amount *= 1 - v;
      notes.push(say(args.target, own, `o debuff recebido ficou ${pct(v)} menor.`));
    }
    for (const ally of alive(teamOf(args.target))) {
      if (ally.id === args.target.id) continue;
      const h = heldAs(ally, "VEU");
      if (h && hasLeft(ally, h)) {
        const v = value(ally, h);
        amount *= 1 - v;
        notes.push(say(ally, h, `o debuff em ${args.target.name} ficou ${pct(v)} menor.`));
        break;
      }
    }
    if (amount <= 0.0005) return notes;
    if (own?.info.effectCode === "ESPELHO" && hasLeft(args.target, own) && args.source && args.source.id !== args.target.id) {
      const v = value(args.target, own);
      const note = say(args.target, own, `devolveu ${pct(amount * v)} do debuff a ${args.source.name}.`);
      if (setDebuff(args.source, args.stat, amount * v, args.target, `Habilidade ${own.info.name}`)) notes.push(note);
    }
    if (setDebuff(args.target, args.stat, amount, args.source, args.label)) {
      notes.push(`${statLabel[args.stat]} de ${args.target.name} -${pct(amount)} (${args.label}${args.source ? `, de ${args.source.name}` : ""}).`);
      const adv = heldAs(args.target, "ADVERSIDADE");
      if (adv && hasLeft(args.target, adv)) {
        rt.pending[args.target.id] = { v: value(args.target, adv), label: adv.info.name };
        notes.push(say(args.target, adv, `o próximo golpe causa ${pct(value(args.target, adv))} mais dano.`));
      }
    } else {
      notes.push(`${statLabel[args.stat]} de ${args.target.name} já tinha um debuff maior (debuffs não somam).`);
    }
    return notes;
  }

  const flushEvents = () => events.splice(0, events.length);
  const flushStandalone = () => standalone.splice(0, standalone.length);
  const flushHpChanges = () => hpChanges.splice(0, hpChanges.length);

  // ── Início da luta / da rodada ─────────────────────────────────────────────
  function onBattleStart() {
    if (rt.started) return;
    rt.started = true;
    for (const m of all) {
      const h = heldAs(m, "INTIMIDACAO");
      if (!h || hpOf(m) <= 0 || !hasLeft(m, h)) continue;
      const stat = abilityDebuffStat(h.info);
      if (!stat) continue;
      const v = value(m, h);
      const head = say(m, h, `reduz ${statLabel[stat]} dos rivais em ${pct(v)}.`);
      const notes: string[] = [];
      for (const foe of alive(foesOf(m))) notes.push(...applyDebuff({ target: foe, source: m, stat, pct: v, label: `Habilidade ${h.info.name}` }));
      standalone.push({ actor: m, text: [head, ...notes].join(" "), events: flushEvents() });
    }
  }

  function bestDebuff(target: ArenaMascot): Stat4 | null {
    const d = host.debuffs.get(target.id);
    if (!d) return null;
    let best: Stat4 | null = null;
    for (const [k, v] of Object.entries(d) as Array<[Stat4, number]>) if (v > 0 && (best === null || v > (d[best] ?? 0))) best = k;
    return best;
  }
  function reduceDebuff(target: ArenaMascot, stat: Stat4, by: number, source: ArenaMascot, label: string) {
    const d = { ...(host.debuffs.get(target.id) ?? {}) };
    const before = d[stat] ?? 0;
    const after = Math.max(0, before - by);
    if (after <= 0.005) delete d[stat]; else d[stat] = after;
    host.debuffs.set(target.id, d);
    if (after <= 0.005) delete rt.origins[target.id]?.[stat];
    events.push({ kind: "REMOVE", targetId: target.id, stat, pct: before - after, sourceId: source.id, sourceName: source.name, label, round: host.getRound() });
    return { before, after };
  }

  function onRoundStart(round: number) {
    for (const side of ["A", "D"] as const) {
      const team = side === "A" ? host.attackers : host.defenders;
      rt.ambient[side] = null;
      for (const m of alive(team)) {
        const h = held(m);
        if (!h) continue;
        const code = h.info.effectCode;
        if (code === "AMBIENTE" && round <= 3 && hasLeft(m, h)) {
          const v = value(m, h);
          if (!rt.ambient[side] || v > rt.ambient[side]!.v) rt.ambient[side] = { types: abilityTypes(h.info), v };
          standalone.push({ actor: m, text: say(m, h, `aliados do tipo ${h.info.param} causam ${pct(v)} mais dano nesta rodada.`) });
        } else if (code === "IMPULSO" && round <= 3 && hasLeft(m, h)) {
          const step = value(m, h) / 3;
          rt.agility[m.id] = (rt.agility[m.id] ?? 0) + step;
          standalone.push({ actor: m, text: say(m, h, `Agilidade +${pct(step)} (total ${pct(rt.agility[m.id])}).`) });
        } else if (code === "CURA_GRADUAL" && hasLeft(m, h) && hpOf(m) < m.hp) {
          const v = value(m, h);
          const gain = Math.max(1, Math.round(m.hp * v));
          const after = Math.min(m.hp, hpOf(m) + gain);
          const real = after - hpOf(m);
          host.hp.set(m.id, after);
          standalone.push({ actor: m, target: m, heal: real, hpAfter: after, text: say(m, h, `curou ${real} HP (${pct(v)} do máximo).`) });
        } else if (code === "PURIFICACAO" && hasLeft(m, h)) {
          const stat = bestDebuff(m);
          if (stat) {
            const v = value(m, h);
            const r = reduceDebuff(m, stat, v, m, `Habilidade ${h.info.name}`);
            standalone.push({ actor: m, text: say(m, h, `${statLabel[stat]} de ${m.name}: debuff de ${pct(r.before)} caiu para ${pct(r.after)}.`), events: flushEvents() });
          }
        } else if (code === "PURIFICACAO_GRUPO" && hasLeft(m, h)) {
          const ally = alive(team).filter((x) => bestDebuff(x)).sort((a, b) => (host.debuffs.get(b.id)?.[bestDebuff(b)!] ?? 0) - (host.debuffs.get(a.id)?.[bestDebuff(a)!] ?? 0))[0];
          if (ally) {
            const stat = bestDebuff(ally)!;
            const v = value(m, h);
            const r = reduceDebuff(ally, stat, v, m, `Habilidade ${h.info.name}`);
            standalone.push({ actor: m, target: ally, text: say(m, h, `${statLabel[stat]} de ${ally.name}: debuff de ${pct(r.before)} caiu para ${pct(r.after)}.`), events: flushEvents() });
          }
        } else if (code === "CURA_ALIADO" && round === 2 && hasLeft(m, h)) {
          const ally = alive(team).filter((x) => x.id !== m.id && hpOf(x) < x.hp).sort((a, b) => hpOf(a) / a.hp - hpOf(b) / b.hp)[0];
          if (ally) {
            const v = value(m, h);
            const after = Math.min(ally.hp, hpOf(ally) + Math.max(1, Math.round(ally.hp * v)));
            const real = after - hpOf(ally);
            host.hp.set(ally.id, after);
            standalone.push({ actor: m, target: ally, heal: real, hpAfter: after, text: say(m, h, `curou ${real} HP de ${ally.name}.`) });
          }
        }
      }
    }
    // Anula bônus rivais: nas 3 primeiras rodadas o Ambiente e a Aura do lado oposto não valem.
    for (const side of ["A", "D"] as const) {
      rt.anular[side] = false;
      const foes = side === "A" ? host.defenders : host.attackers;
      for (const holder of alive(foes)) {
        const h = heldAs(holder, "ANULAR_BONUS");
        if (!h || round > 3 || !hasLeft(holder, h)) continue;
        rt.anular[side] = true;
        rt.ambient[side] = null;
        standalone.push({ actor: holder, text: say(holder, h, `os bônus de Ambiente e Aura dos rivais foram anulados nesta rodada.`) });
        break;
      }
    }
    // Pesadelo: cada rival perde uma fração do HP máximo no início da rodada.
    for (const m of all) {
      const h = heldAs(m, "PESADELO");
      if (!h || hpOf(m) <= 0 || round > 3 || !hasLeft(m, h)) continue;
      const v = value(m, h);
      const head = say(m, h, `os rivais perdem ${pct(v)} do HP máximo.`);
      let first = true;
      for (const foe of alive(foesOf(m))) {
        const loss = Math.max(1, Math.round(foe.hp * v));
        host.hp.set(foe.id, Math.max(0, hpOf(foe) - loss));
        const notes: string[] = [];
        if (hpOf(foe) <= 0) onFall(foe, m, notes);
        standalone.push({ actor: m, target: foe, hpAfter: hpOf(foe), text: `${first ? head + " " : ""}${foe.name} perdeu ${loss} HP.${notes.length ? " " + notes.join(" ") : ""}` });
        first = false;
      }
    }
  }

  // ── Ataque ─────────────────────────────────────────────────────────────────
  function attackBonus(a: { actor: ArenaMascot; target: ArenaMascot; multiplier: number; isLastOfSide: boolean }) {
    let off = 0;
    let ignore = 0;
    let extraHit = 0;
    const notes: string[] = [];
    const types = host.typesOf(a.actor);
    const hpPct = hpOf(a.actor) / a.actor.hp;
    const h = held(a.actor);
    if (h && hasLeft(a.actor, h)) {
      const v = value(a.actor, h);
      let ok = false;
      let text = `golpe com ${pct(v)} mais dano.`;
      switch (h.info.effectCode) {
        case "FURIA_TIPO": ok = hpPct < 0.33 && matchesTypes(h, types); break;
        case "FURIA": ok = hpPct < 0.33; break;
        case "MAESTRIA_TIPO": ok = matchesTypes(h, types); break;
        case "MAESTRIA_GOLPE": case "PODER_BRUTO": ok = true; break;
        case "VANTAGEM": ok = a.multiplier > 1; break;
        case "LENTE": ok = a.multiplier < 1; text = `o golpe resistido perde menos dano (+${pct(v)}).`; break;
        case "ULTIMO": ok = a.isLastOfSide; break;
        case "GOLPE_FELIZ": ok = host.rand() < REACTION_CHANCE; text = `golpe feliz: ${pct(v)} mais dano.`; break;
        case "AQUECIMENTO": ok = host.getRound() >= 3; text = `já aquecido: golpe com ${pct(v)} mais dano.`; break;
        case "ANALISE": {
          const weakest = [...alive(foesOf(a.actor))].sort((x, y) => x.vitality - y.vitality)[0];
          ok = weakest?.id === a.target.id;
          break;
        }
        case "QUEBRA_GUARDA": ignore = v; ok = true; text = `ignora ${pct(v)} da defesa de ${a.target.name}.`; break;
        case "GOLPE_DUPLO": extraHit = v; ok = true; text = `segundo impacto de ${pct(v)} do dano.`; break;
        default: break;
      }
      if (ok) {
        if (h.info.effectCode !== "QUEBRA_GUARDA" && h.info.effectCode !== "GOLPE_DUPLO") off += v;
        notes.push(say(a.actor, h, text));
      }
    }
    const pend = rt.pending[a.actor.id];
    if (pend) {
      off += pend.v;
      delete rt.pending[a.actor.id];
      notes.push(`✨ ${pend.label} de ${a.actor.name}: o golpe carregado causa ${pct(pend.v)} mais dano.`);
    }
    // Bônus de aliados: Aura (por tipo) e Ambiente (nas 3 primeiras rodadas).
    let bestAura: { m: ArenaMascot; h: Held; v: number } | null = null;
    for (const ally of alive(teamOf(a.actor))) {
      const ah = heldAs(ally, "AURA");
      if (ah && !rt.anular[sideOf.get(a.actor.id)!] && hasLeft(ally, ah) && matchesTypes(ah, types)) {
        const v = value(ally, ah);
        if (!bestAura || v > bestAura.v) bestAura = { m: ally, h: ah, v };
      }
    }
    if (bestAura) {
      off += bestAura.v;
      notes.push(say(bestAura.m, bestAura.h, `${a.actor.name} causa ${pct(bestAura.v)} mais dano.`));
    }
    const amb = rt.ambient[sideOf.get(a.actor.id)!];
    if (amb && amb.types.some((t) => types.includes(t))) off += amb.v;
    return { off, ignore, extraHit, notes };
  }

  /** Reforço (aliado) e Ignorar bônus (alvo) alteram os bônus de Encorajador/Batedor. */
  function buffMods(a: { actor: ArenaMascot; target: ArenaMascot; encourage: number; scout: number }) {
    let encourage = a.encourage;
    let scout = a.scout;
    const notes: string[] = [];
    if (encourage + scout > 0) {
      for (const ally of alive(teamOf(a.actor))) {
        const h = heldAs(ally, "REFORCO");
        if (h && hasLeft(ally, h)) {
          const v = value(ally, h);
          encourage *= 1 + v; scout *= 1 + v;
          notes.push(say(ally, h, `os bônus de equipe ficaram ${pct(v)} maiores.`));
          break;
        }
      }
      const neg = heldAs(a.target, "NEGAR_BUFF");
      if (neg && hasLeft(a.target, neg)) {
        const v = value(a.target, neg);
        encourage *= 1 - v; scout *= 1 - v;
        notes.push(say(a.target, neg, `ignora ${pct(v)} dos bônus de equipe do atacante.`));
      }
    }
    return { encourage, scout, notes };
  }

  /** Para-raios: golpes do tipo da habilidade contra aliados vão para o portador. */
  function maybeRedirect(actor: ArenaMascot, target: ArenaMascot): { target: ArenaMascot; note: string } | null {
    redirected = null;
    const types = host.typesOf(actor);
    for (const foe of alive(foesOf(actor))) {
      if (foe.id === target.id) continue;
      const h = heldAs(foe, "PARARAIO");
      if (h && hasLeft(foe, h) && matchesTypes(h, types)) {
        redirected = foe.id;
        return { target: foe, note: say(foe, h, `desviou o golpe de ${actor.name} para si.`) };
      }
    }
    return null;
  }

  function onDefend(actor: ArenaMascot): string[] {
    const h = heldAs(actor, "PREPARO");
    if (!h || !hasLeft(actor, h) || rt.armed.includes(actor.id)) return [];
    rt.armed.push(actor.id);
    return [`✨ ${h.info.name} de ${actor.name}: defesa reforçada para o próximo golpe.`];
  }

  /** Redução de dano do alvo e cura por absorção. */
  function defense(a: { actor: ArenaMascot; target: ArenaMascot; multiplier: number }) {
    let factor = 1;
    let heal = 0;
    const notes: string[] = [];
    const h = held(a.target);
    if (!h) return { factor, heal, notes };
    const code = h.info.effectCode;
    if (code === "AQUECIMENTO") {
      // Nas 2 primeiras rodadas o dono se protege; depois passa a bater mais forte (ver attackBonus).
      if (host.getRound() <= 2) {
        const v = value(a.target, h);
        return { factor: 1 - v, heal, notes: [`✨ ${h.info.name} de ${a.target.name}: aquecendo, o golpe causou ${pct(v)} menos dano.`] };
      }
      return { factor, heal, notes };
    }
    const hpFull = hpOf(a.target) >= a.target.hp;
    const hpPct = hpOf(a.target) / a.target.hp;
    const attackerTypes = host.typesOf(a.actor);
    let ok = false;
    switch (code) {
      case "PELAGEM": ok = matchesTypes(h, attackerTypes); break;
      case "ABSORCAO": ok = matchesTypes(h, attackerTypes); break;
      case "ARMADURA": ok = a.multiplier > 1; break;
      case "GUARDA_PERFEITA": ok = a.multiplier <= 1; break;
      case "ESCAMAS": ok = hpFull; break;
      case "RETIRADA": ok = hpPct < 0.5; break;
      case "CASCO": case "EVASIVA": ok = true; break;
      case "PARARAIO": ok = redirected === a.target.id; break;
      case "PREPARO": ok = rt.armed.includes(a.target.id); if (ok) rt.armed = rt.armed.filter((id) => id !== a.target.id); break;
      default: break;
    }
    if (ok && code === "PARARAIO") {
      // A ativação já foi gasta ao desviar o golpe.
      const v = value(a.target, h);
      factor = 1 - v;
      notes.push(`✨ ${h.info.name} de ${a.target.name}: o golpe desviado causou ${pct(v)} menos dano.`);
    } else if (ok && hasLeft(a.target, h)) {
      const v = value(a.target, h);
      factor = 1 - v;
      if (code === "ABSORCAO") heal = Math.max(1, Math.round(a.target.hp * 0.05));
      notes.push(say(a.target, h, `o golpe causou ${pct(v)} menos dano${heal ? ` e curou ${heal} HP` : ""}.`));
    }
    return { factor, heal, notes };
  }

  /** Guarda de aliados: o Guardião com a habilidade reduz o dano que sobrou. */
  function guardianExtra(guardian: ArenaMascot, remaining: number): { damage: number; note: string | null } {
    const h = heldAs(guardian, "GUARDA");
    if (!h || !hasLeft(guardian, h) || remaining <= 0) return { damage: remaining, note: null };
    const v = value(guardian, h);
    return { damage: Math.max(0, Math.round(remaining * (1 - v))), note: say(guardian, h, `o golpe protegido causou ${pct(v)} menos dano.`) };
  }

  /** Resistência (Sturdy): resiste a um golpe fatal, qualquer que seja o HP. */
  function survive(target: ArenaMascot, damage: number): { damage: number; note: string } | null {
    const h = heldAs(target, "RESISTENCIA");
    if (!h || !hasLeft(target, h)) return null;
    const current = hpOf(target);
    if (damage < current) return null;
    return { damage: current - 1, note: say(target, h, `resistiu ao golpe fatal e ficou com 1 HP.`) };
  }

  function healTarget(m: ArenaMascot, amount: number) {
    const after = Math.min(m.hp, hpOf(m) + amount);
    host.hp.set(m.id, after);
    return after;
  }

  function onFall(fallen: ArenaMascot, killer: ArenaMascot | null, notes: string[]) {
    // Vingança: aliados do caído carregam o próximo golpe.
    for (const ally of alive(teamOf(fallen))) {
      const h = heldAs(ally, "VINGANCA");
      if (h && hasLeft(ally, h)) {
        const v = value(ally, h);
        const t = say(ally, h, `o próximo golpe causa ${pct(v)} mais dano.`);
        rt.pending[ally.id] = { v, label: h.info.name };
        notes.push(t);
      }
    }
    const own = heldAs(fallen, "ULTIMO_SUSPIRO");
    if (own && killer && hasLeft(fallen, own) && !immuneIndirect(killer) && hpOf(killer) > 0) {
      const v = value(fallen, own);
      const dmg = Math.max(1, Math.round(killer.hp * v));
      host.hp.set(killer.id, Math.max(0, hpOf(killer) - dmg));
      const text = say(fallen, own, `causou ${dmg} de dano a ${killer.name}.`);
      notes.push(text);
      hpChanges.push({ m: killer, hpAfter: hpOf(killer), by: fallen, text: `${fallen.name} → ${killer.name}: −${dmg} HP` });
      if (hpOf(killer) <= 0) onFall(killer, fallen, notes);
    }
    if (killer) {
      const k = heldAs(killer, "EMBALO");
      if (k && hasLeft(killer, k) && hpOf(killer) > 0) {
        const v = value(killer, k);
        rt.pending[killer.id] = { v, label: k.info.name };
        notes.push(say(killer, k, `o próximo golpe causa ${pct(v)} mais dano.`));
      }
    }
  }

  /** Efeitos depois do golpe: reflexo, reações, regeneração e quedas. */
  function afterHit(a: { actor: ArenaMascot; target: ArenaMascot; damage: number }) {
    const notes: string[] = [];
    const targetAlive = hpOf(a.target) > 0;
    const t = held(a.target);
    if (t && a.damage > 0) {
      const code = t.info.effectCode;
      if (code === "ESPINHOS" && hasLeft(a.target, t) && hpOf(a.actor) > 0 && !immuneIndirect(a.actor)) {
        const v = value(a.target, t);
        const back = Math.max(1, Math.round(a.damage * v));
        host.hp.set(a.actor.id, Math.max(0, hpOf(a.actor) - back));
        notes.push(say(a.target, t, `devolveu ${back} de dano a ${a.actor.name}.`));
        hpChanges.push({ m: a.actor, hpAfter: hpOf(a.actor), by: a.target, text: `${a.target.name} → ${a.actor.name}: −${back} HP` });
        if (hpOf(a.actor) <= 0) onFall(a.actor, a.target, notes);
      } else if (code === "REACAO" && targetAlive && hasLeft(a.target, t) && hpOf(a.actor) > 0 && host.rand() < REACTION_CHANCE) {
        const stat = abilityDebuffStat(t.info);
        if (stat) {
          const v = value(a.target, t);
          notes.push(say(a.target, t, `reagiu ao golpe.`), ...applyDebuff({ target: a.actor, source: a.target, stat, pct: v, label: `Habilidade ${t.info.name}` }));
        }
      } else if (code === "REVIDE" && targetAlive && hasLeft(a.target, t)) {
        const v = value(a.target, t);
        rt.pending[a.target.id] = { v, label: t.info.name };
        notes.push(say(a.target, t, `o próximo golpe causa ${pct(v)} mais dano.`));
      } else if (code === "REGENERACAO" && targetAlive && hasLeft(a.target, t) && hpOf(a.target) / a.target.hp < 0.5) {
        const v = value(a.target, t);
        const gain = Math.max(1, Math.round(a.target.hp * v));
        const before = hpOf(a.target);
        healTarget(a.target, gain);
        notes.push(say(a.target, t, `recuperou ${hpOf(a.target) - before} HP.`));
      }
    }
    const vamp = heldAs(a.actor, "VAMPIRISMO");
    if (vamp && hasLeft(a.actor, vamp) && a.damage > 0 && hpOf(a.actor) > 0 && hpOf(a.actor) < a.actor.hp) {
      const v = value(a.actor, vamp);
      const before = hpOf(a.actor);
      healTarget(a.actor, Math.max(1, Math.round(a.damage * v)));
      const gained = hpOf(a.actor) - before;
      notes.push(say(a.actor, vamp, `recuperou ${gained} HP do dano causado.`));
      hpChanges.push({ m: a.actor, hpAfter: hpOf(a.actor), by: a.actor, heal: gained, text: `${a.actor.name} recupera ${gained} HP` });
    }
    const h = held(a.actor);
    if (h && h.info.effectCode === "TOQUE" && targetAlive && hasLeft(a.actor, h) && hpOf(a.actor) > 0 && host.rand() < REACTION_CHANCE) {
      const stat = abilityDebuffStat(h.info);
      if (stat) {
        const v = value(a.actor, h);
        notes.push(say(a.actor, h, `debilitou o alvo.`), ...applyDebuff({ target: a.target, source: a.actor, stat, pct: v, label: `Habilidade ${h.info.name}` }));
      }
    }
    if (!targetAlive) onFall(a.target, a.actor, notes);
    return notes;
  }

  return {
    onBattleStart, onRoundStart, attackBonus, buffMods, maybeRedirect, onDefend, defense, guardianExtra, survive, afterHit,
    applyDebuff, flushEvents, flushStandalone, flushHpChanges, healTarget,
    agilityMult: (id: string) => 1 + (rt.agility[id] ?? 0),
    snapshot: (): AbilityRuntime => structuredClone(rt),
  };
}

export type AbilityEngine = ReturnType<typeof createAbilityEngine>;
