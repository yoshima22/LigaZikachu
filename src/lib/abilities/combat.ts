// Motor das habilidades passivas no combate. Só roda quando o Arena Draft passa a opção
// `abilities` ao runArenaCombat: os outros modos não enxergam nada disto.
import type { ArenaMascot } from "@/lib/arena-z";
import { TYPE_ADVANTAGE } from "@/lib/mascot-data";
import { abilityDebuffStat, abilityTypes, abilityValue, getAbilityInfo, type AbilityInfo } from "./index";
import {
  CURSE_INFO, STATUS_INFO, STATUS_RULES, paramIncludesAllies, paramIsAllStatuses, paramIsRandom, paramMentionsCurse, paramNeedsSun, statusesInParam,
  type StatusKind,
} from "./status";

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
  /** Estado alterado ativo por mascote (um por vez). Vale nas rodadas depois de `since` até `until`. */
  status: Record<string, { kind: StatusKind; since: number; until: number; sourceId: string | null; sourceName: string }>;
  /** Maldição: alvo -> quem amaldiçoou (acumula com os demais estados; dura enquanto o autor estiver vivo). */
  curse: Record<string, { sourceId: string; sourceName: string }>;
  /** Clima da rodada atual (sol, chuva, areia) e até quando a areia de reação dura. */
  field: { sol: boolean; chuva: boolean; areia: boolean; sandUntil: number };
  /** Bônus temporário de Agilidade (clima de chuva, disfarce, garra rápida) válido até a rodada indicada. */
  tempAgility: Record<string, { v: number; until: number }>;
  /** Redução de dano temporária (disfarce com Vitalidade). */
  tempShield: Record<string, { v: number; until: number }>;
  /** Tipos assumidos por Disfarce/Impostor/Transformação. */
  types: Record<string, string[]>;
  /** Quem já usou a ação inicial de disfarce. */
  disguised: string[];
  /** Armadura quebrada: passam a receber +10% de dano. */
  weak: string[];
  /** Cópia de buff (Trace): um por vez, até a rodada indicada. */
  traced: Record<string, { kind: "pending" | "agility"; v: number; until: number }>;
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
  return {
    started: false, uses: {}, pending: {}, agility: {}, ambient: { A: null, D: null }, armed: [], origins: {}, anular: { A: false, D: false },
    status: {}, curse: {}, field: { sol: false, chuva: false, areia: false, sandUntil: 0 }, tempAgility: {}, tempShield: {}, types: {}, disguised: [], weak: [], traced: {},
  };
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
  // Tipos assumidos em lutas anteriores (segmentos do Draft) voltam a valer nos mascotes desta execução.
  for (const [id, types] of Object.entries(rt.types)) {
    const m = byId.get(id);
    if (m) m.types = [...types];
  }

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

  // ── Estados alterados ──────────────────────────────────────────────────────
  const statusLabel = (kind: StatusKind) => STATUS_INFO[kind].label;
  const hasAnyStatus = (m: ArenaMascot) => Boolean(rt.status[m.id]);
  /** O estado atual do mascote bate com o parâmetro ("envenenado", "qualquer estado alterado"...)? */
  const matchesStatus = (m: ArenaMascot, param: string | null) => {
    const current = rt.status[m.id];
    if (!current) return false;
    if (paramIsAllStatuses(param)) return true;
    return statusesInParam(param).includes(current.kind);
  };
  const randInt = (min: number, max: number) => min + Math.floor(host.rand() * (max - min + 1));
  /** Bônus à chance de estados aplicados pelos aliados do portador (Brincalhão). */
  const statusChanceBonus = (source: ArenaMascot) => {
    for (const ally of alive(teamOf(source))) {
      const h = heldAs(ally, "BONUS_CHANCE_ESTADO");
      if (h) return value(ally, h);
    }
    return 0;
  };
  const highestStat = (m: ArenaMascot): Stat4 => {
    const s = stats(m);
    return (["force", "instinct", "agility", "vitality"] as Stat4[]).reduce((best, k) => (s[k] > s[best] ? k : best), "force" as Stat4);
  };

  /** Imunidade por tipo ou habilidade (do próprio mascote ou de um aliado "protetor"). */
  const statusBlockedBy = (target: ArenaMascot, kind: StatusKind | "CURSE"): { by: ArenaMascot; h: Held } | null => {
    for (const holder of alive(teamOf(target))) {
      const h = heldAs(holder, "IMUNE_ESTADO");
      if (!h) continue;
      if (holder.id !== target.id && !paramIncludesAllies(h.info.param)) continue;
      if (paramNeedsSun(h.info.param) && !rt.field.sol) continue;
      const covers = paramIsAllStatuses(h.info.param) || (kind !== "CURSE" && statusesInParam(h.info.param).includes(kind)) || (kind === "CURSE" && paramMentionsCurse(h.info.param));
      if (covers) return { by: holder, h };
    }
    return null;
  };

  /**
   * Ponto único de aplicação de estado alterado. Respeita imunidades (tipo e habilidade), a regra de um estado por vez
   * (Maldito acumula), "só um paralisado por autor" e devolve notas de log. `chance` já deve incluir os bônus.
   */
  function applyStatus(args: { target: ArenaMascot; source: ArenaMascot; kind: StatusKind | "CURSE"; label: string; allowReturn?: boolean }): string[] {
    const { target, source, kind } = args;
    const notes: string[] = [];
    if (hpOf(target) <= 0) return notes;
    const name = kind === "CURSE" ? CURSE_INFO.label : statusLabel(kind);
    const emoji = kind === "CURSE" ? CURSE_INFO.emoji : STATUS_INFO[kind].emoji;
    // Imunidade por tipo (Corrosão dos aliados pode ignorar a de Veneno/Metal).
    const immuneTypes = kind === "CURSE" ? CURSE_INFO.immuneTypes : STATUS_INFO[kind].immuneTypes;
    const targetTypes = host.typesOf(target);
    if (immuneTypes.some((t) => targetTypes.includes(t))) {
      let ignored = false;
      if (kind === "POISON") {
        for (const ally of alive(teamOf(source))) {
          const h = heldAs(ally, "IGNORA_IMUNIDADE");
          if (h && host.rand() < value(ally, h)) {
            notes.push(say(ally, h, `ignorou a imunidade de ${target.name} a veneno.`));
            ignored = true;
            break;
          }
        }
      }
      if (!ignored) {
        notes.push(`🛡️ ${target.name} é imune a ${name.toLowerCase()} pelo tipo.`);
        return notes;
      }
    }
    const blocker = statusBlockedBy(target, kind);
    if (blocker) {
      notes.push(say(blocker.by, blocker.h, `${target.name} não pode ficar ${name.toLowerCase()}.`));
      return notes;
    }
    if (kind === "CURSE") {
      if (rt.curse[target.id]) return notes;
      rt.curse[target.id] = { sourceId: source.id, sourceName: source.name };
      notes.push(`${emoji} ${target.name} está ${name.toLowerCase()} por ${source.name}: se atacá-lo, perde ${pct(CURSE_INFO.selfDamagePct)} do HP máximo, até ele cair.`);
      return notes;
    }
    if (rt.status[target.id]) {
      notes.push(`${target.name} já está ${STATUS_INFO[rt.status[target.id].kind].adjective} (estados não acumulam).`);
      return notes;
    }
    if (kind === "PARALYSIS") {
      // Cada autor só mantém um rival paralisado por vez.
      const already = Object.entries(rt.status).find(([id, st]) => st.kind === "PARALYSIS" && st.sourceId === source.id && hpOf(byId.get(id)!) > 0);
      if (already) {
        notes.push(`${source.name} já mantém ${byId.get(already[0])!.name} paralisado (só um por vez).`);
        return notes;
      }
    }
    const [dMin, dMax] = STATUS_INFO[kind].duration;
    const duration = randInt(dMin, dMax);
    const round = host.getRound();
    rt.status[target.id] = { kind, since: round, until: round + duration, sourceId: source.id, sourceName: source.name };
    notes.push(`${emoji} ${target.name} ficou ${STATUS_INFO[kind].adjective} por ${duration} rodada${duration > 1 ? "s" : ""} (${args.label}, de ${source.name}).`);
    if (kind === "FREEZE") notes.push(...applyDebuff({ target, source, stat: "agility", pct: STATUS_RULES.freezeAgility, label: "Congelado" }));
    // Sincronia: devolve o estado recebido a quem o causou.
    if (args.allowReturn !== false) {
      const sync = heldAs(target, "ESTADO_DEVOLVE");
      if (sync && hasLeft(target, sync) && source.id !== target.id && hpOf(source) > 0 && host.rand() < value(target, sync)) {
        notes.push(say(target, sync, `devolveu ${STATUS_INFO[kind].adjective} a ${source.name}.`), ...applyStatus({ target: source, source: target, kind, label: sync.info.name, allowReturn: false }));
      }
    }
    return notes;
  }

  function clearStatus(m: ArenaMascot, byName: string): string | null {
    const st = rt.status[m.id];
    if (!st) return null;
    delete rt.status[m.id];
    if (st.kind === "FREEZE") {
      const d = { ...(host.debuffs.get(m.id) ?? {}) };
      if ((d.agility ?? 0) > 0) {
        delete d.agility;
        host.debuffs.set(m.id, d);
        delete rt.origins[m.id]?.agility;
      }
    }
    return `${STATUS_INFO[st.kind].emoji} ${m.name} deixou de estar ${STATUS_INFO[st.kind].adjective} (${byName}).`;
  }

  /** Perda de HP direta (queimadura, veneno, areia...): trata quedas. */
  function loseHp(m: ArenaMascot, amount: number, by: ArenaMascot | null, notes: string[]) {
    host.hp.set(m.id, Math.max(0, hpOf(m) - amount));
    if (hpOf(m) <= 0) onFall(m, by, notes);
  }

  /** Ponto único de aplicação de debuff: aplica Corpo limpo, Véu e Espelho e registra a origem. */
  function applyDebuff(args: { target: ArenaMascot; source: ArenaMascot | null; stat: Stat4; pct: number; label: string }): string[] {
    const notes: string[] = [];
    let amount = args.pct;
    const nullify = heldAs(args.target, "ANULA_DEBUFF");
    if (nullify && hasLeft(args.target, nullify) && host.rand() < value(args.target, nullify)) {
      notes.push(say(args.target, nullify, `anulou o debuff de ${statLabel[args.stat]}${args.source ? ` aplicado por ${args.source.name}` : ""}.`));
      return notes;
    }
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
    // Sala Maravilhosa: embaralha os atributos do rival mais forte (o maior atributo dele cai).
    for (const m of all) {
      const h = heldAs(m, "MUDANCA_STATUS");
      if (!h || hpOf(m) <= 0 || !hasLeft(m, h)) continue;
      const strongest = [...alive(foesOf(m))].sort((x, y) => (y.force + y.agility + y.instinct + y.vitality) - (x.force + x.agility + x.instinct + x.vitality))[0];
      if (!strongest) continue;
      const stat = highestStat(strongest);
      const v = value(m, h);
      const head = say(m, h, `embaralhou os atributos de ${strongest.name}: ${statLabel[stat]} caiu ${pct(v)}.`);
      const notes = applyDebuff({ target: strongest, source: m, stat, pct: v, label: `Habilidade ${h.info.name}` });
      standalone.push({ actor: m, target: strongest, text: [head, ...notes].join(" "), events: flushEvents() });
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
    // Clima e estados da rodada: o clima é recalculado abaixo; estados vencidos saem e veneno/areia causam dano.
    rt.field.sol = false;
    rt.field.chuva = false;
    rt.field.areia = false;
    for (const id of Object.keys(rt.tempAgility)) if (rt.tempAgility[id].until < round) delete rt.tempAgility[id];
    for (const id of Object.keys(rt.tempShield)) if (rt.tempShield[id].until < round) delete rt.tempShield[id];
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
          if (abilityTypes(h.info).includes("fire")) rt.field.sol = true;
          standalone.push({ actor: m, text: say(m, h, `aliados do tipo ${h.info.param} causam ${pct(v)} mais dano nesta rodada.`) });
        } else if (code === "CLIMA_CHUVA" && round <= 3 && hasLeft(m, h)) {
          const v = value(m, h);
          rt.field.chuva = true;
          const wet = alive(team).filter((x) => matchesTypes(h, host.typesOf(x)));
          for (const ally of wet) rt.tempAgility[ally.id] = { v, until: round };
          standalone.push({ actor: m, text: say(m, h, `chuva: aliados do tipo ${h.info.param} ganham ${pct(v)} de Agilidade nesta rodada.`) });
        } else if (code === "CLIMA_AREIA" && round <= 3 && hasLeft(m, h)) {
          rt.field.areia = true;
          standalone.push({ actor: m, text: say(m, h, `tempestade de areia: mascotes que não são Pedra, Terra ou Metal perdem ${pct(STATUS_RULES.sandPct)} do HP máximo nesta rodada.`) });
        } else if (code === "ATAQUE_RAPIDO" && round === 1 && hasLeft(m, h)) {
          const v = value(m, h);
          rt.tempAgility[m.id] = { v, until: 1 };
          standalone.push({ actor: m, text: say(m, h, `Agilidade +${pct(v)} na 1ª rodada: age primeiro.`) });
        } else if (code === "IMPULSO" && round <= 3 && hasLeft(m, h)) {
          const step = value(m, h) / 3;
          rt.agility[m.id] = (rt.agility[m.id] ?? 0) + step;
          standalone.push({ actor: m, text: say(m, h, `Agilidade +${pct(step)} (total ${pct(rt.agility[m.id])}).`) });
          maybeTrace(m, "agility", step);
        } else if (code === "CURA_GRADUAL" && hasLeft(m, h) && hpOf(m) < m.hp) {
          const v = value(m, h);
          const gain = Math.max(1, Math.round(m.hp * v));
          const after = Math.min(m.hp, hpOf(m) + gain);
          const real = after - hpOf(m);
          host.hp.set(m.id, after);
          standalone.push({ actor: m, target: m, heal: real, hpAfter: after, text: say(m, h, `curou ${real} HP (${pct(v)} do máximo).`) });
        } else if (code === "PURIFICACAO" && hasLeft(m, h)) {
          const stat = bestDebuff(m);
          if (stat || hasAnyStatus(m) || rt.curse[m.id]) {
            const v = value(m, h);
            const parts: string[] = [];
            if (stat) {
              const r = reduceDebuff(m, stat, v, m, `Habilidade ${h.info.name}`);
              parts.push(`${statLabel[stat]} de ${m.name}: debuff de ${pct(r.before)} caiu para ${pct(r.after)}.`);
            }
            const cured = clearStatus(m, `Habilidade ${h.info.name}`);
            if (cured) parts.push(cured);
            standalone.push({ actor: m, text: say(m, h, parts.join(" ")), events: flushEvents() });
          }
        } else if (code === "PURIFICACAO_GRUPO" && hasLeft(m, h)) {
          const needs = (x: ArenaMascot) => (bestDebuff(x) ? (host.debuffs.get(x.id)?.[bestDebuff(x)!] ?? 0) : 0) + (hasAnyStatus(x) ? 0.5 : 0);
          const ally = alive(team).filter((x) => needs(x) > 0).sort((a, b) => needs(b) - needs(a))[0];
          if (ally) {
            const v = value(m, h);
            const parts: string[] = [];
            const stat = bestDebuff(ally);
            if (stat) {
              const r = reduceDebuff(ally, stat, v, m, `Habilidade ${h.info.name}`);
              parts.push(`${statLabel[stat]} de ${ally.name}: debuff de ${pct(r.before)} caiu para ${pct(r.after)}.`);
            }
            const cured = clearStatus(ally, `Habilidade ${h.info.name}`);
            if (cured) parts.push(cured);
            standalone.push({ actor: m, target: ally, text: say(m, h, parts.join(" ")), events: flushEvents() });
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
    tickRound(round);
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
      let offAmount = v;
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
        case "FORCA_ESTADO": ok = matchesStatus(a.actor, h.info.param); text = `com ${h.info.param}, o golpe causa ${pct(v)} mais dano.`; break;
        case "DANO_CONTRA_ESTADO": ok = matchesStatus(a.target, h.info.param); text = `${a.target.name} está ${h.info.param}: o golpe causa ${pct(v)} mais dano.`; break;
        case "ATRIBUTO_CLIMA": {
          const top = highestStat(a.actor);
          ok = rt.field.sol && (top === "force" || top === "instinct");
          text = `sob sol forte, o maior atributo (${statLabel[top]}) sobe: golpe com ${pct(v)} mais dano.`;
          break;
        }
        case "CONVERSAO_TIPO": {
          const converted = abilityTypes(h.info)[0];
          const weakTo = converted ? (TYPE_ADVANTAGE[converted] ?? []) : [];
          if (types.includes("normal") && a.multiplier <= 1 && host.typesOf(a.target).some((t) => weakTo.includes(t)) && host.rand() < v) {
            ok = true;
            offAmount = 0.3;
            text = `o golpe virou ${h.info.param} e foi super efetivo contra ${a.target.name} (+30% de dano).`;
          }
          break;
        }
        default: break;
      }
      if (ok) {
        if (h.info.effectCode !== "QUEBRA_GUARDA" && h.info.effectCode !== "GOLPE_DUPLO") off += offAmount;
        notes.push(say(a.actor, h, text));
      }
    }
    const traced = rt.traced[a.actor.id];
    if (traced && traced.kind === "pending" && traced.until >= host.getRound()) {
      off += traced.v;
      delete rt.traced[a.actor.id];
      notes.push(`✨ Trace de ${a.actor.name}: o golpe copiado causa ${pct(traced.v)} mais dano.`);
    }
    const curse = rt.curse[a.actor.id];
    if (curse && curse.sourceId === a.target.id && hpOf(a.target) > 0) {
      const loss = Math.max(1, Math.round(a.actor.hp * CURSE_INFO.selfDamagePct));
      host.hp.set(a.actor.id, Math.max(1, hpOf(a.actor) - loss));
      notes.push(`${CURSE_INFO.emoji} ${a.actor.name} está amaldiçoado por ${a.target.name} e perdeu ${loss} HP ao atacá-lo.`);
      hpChanges.push({ m: a.actor, hpAfter: hpOf(a.actor), by: a.target, text: `${a.target.name} → ${a.actor.name}: −${loss} HP (maldição)` });
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
    if (rt.weak.includes(a.target.id)) {
      factor *= 1.1;
      notes.push(`💥 ${a.target.name} está com a armadura quebrada: o golpe causa 10% mais dano.`);
    }
    const shield = rt.tempShield[a.target.id];
    if (shield && shield.until >= host.getRound()) {
      factor *= 1 - shield.v;
      notes.push(`🛡️ Disfarce de ${a.target.name}: o golpe causa ${pct(shield.v)} menos dano.`);
    }
    const h = held(a.target);
    if (!h) return { factor, heal, notes };
    const code = h.info.effectCode;
    if (code === "AQUECIMENTO") {
      // Nas 2 primeiras rodadas o dono se protege; depois passa a bater mais forte (ver attackBonus).
      if (host.getRound() <= 2) {
        const v = value(a.target, h);
        // Aquecimento: a redução fica entre 10% e 15% (metade da faixa do bônus de ataque).
        const reduction = (h.info.min ?? 0.1) + (v - (h.info.min ?? 0.1)) * 0.5;
        return { factor: factor * (1 - reduction), heal, notes: [...notes, `✨ ${h.info.name} de ${a.target.name}: aquecendo, o golpe causou ${pct(reduction)} menos dano.`] };
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
      case "DEFESA_ESTADO": ok = matchesStatus(a.target, h.info.param); break;
      case "ATRIBUTO_CLIMA": ok = rt.field.sol && highestStat(a.target) === "vitality"; break;
      case "CASCO": case "EVASIVA": ok = true; break;
      case "PARARAIO": ok = redirected === a.target.id; break;
      case "PREPARO": ok = rt.armed.includes(a.target.id); if (ok) rt.armed = rt.armed.filter((id) => id !== a.target.id); break;
      default: break;
    }
    if (ok && code === "PARARAIO") {
      // A ativação já foi gasta ao desviar o golpe.
      const v = value(a.target, h);
      factor *= 1 - v;
      notes.push(`✨ ${h.info.name} de ${a.target.name}: o golpe desviado causou ${pct(v)} menos dano.`);
    } else if (ok && hasLeft(a.target, h)) {
      const v = value(a.target, h);
      factor *= 1 - v;
      if (code === "ABSORCAO") heal = Math.max(1, Math.round(a.target.hp * 0.05));
      notes.push(say(a.target, h, `o golpe causou ${pct(v)} menos dano${heal ? ` e curou ${heal} HP` : ""}.`));
    }
    return { factor, heal, notes };
  }

  /** Guarda de aliados: o Guardião com a habilidade reduz o dano que sobrou. */
  function guardianExtra(guardian: ArenaMascot, remaining: number, protectedAlly?: ArenaMascot): { damage: number; note: string | null } {
    const h = heldAs(guardian, "GUARDA") ?? heldAs(guardian, "GUARDA_TIPO");
    if (!h || !hasLeft(guardian, h) || remaining <= 0) return { damage: remaining, note: null };
    // Proteção de tipo (Lum Protection): só vale para aliados do tipo da habilidade.
    if (h.info.effectCode === "GUARDA_TIPO" && (!protectedAlly || !matchesTypes(h, host.typesOf(protectedAlly)))) return { damage: remaining, note: null };
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
        maybeTrace(ally, "pending", v);
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
        maybeTrace(killer, "pending", v);
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
        maybeTrace(a.target, "pending", v);
        notes.push(say(a.target, t, `o próximo golpe causa ${pct(v)} mais dano.`));
      } else if (code === "REGENERACAO" && targetAlive && hasLeft(a.target, t) && hpOf(a.target) / a.target.hp < 0.5) {
        const v = value(a.target, t);
        const gain = Math.max(1, Math.round(a.target.hp * v));
        const before = hpOf(a.target);
        healTarget(a.target, gain);
        notes.push(say(a.target, t, `recuperou ${hpOf(a.target) - before} HP.`));
      } else if (code === "ESTADO_CONTATO" && targetAlive && hasLeft(a.target, t) && hpOf(a.actor) > 0 && host.rand() < value(a.target, t) + statusChanceBonus(a.target)) {
        const kind = pickStatus(t.info.param);
        if (kind) notes.push(say(a.target, t, `reagiu ao golpe.`), ...applyStatus({ target: a.actor, source: a.target, kind, label: `Habilidade ${t.info.name}` }));
      } else if (code === "ESTADO_ALEATORIO" && hasLeft(a.target, t) && host.rand() < value(a.target, t) + statusChanceBonus(a.target)) {
        const foes = alive(foesOf(a.target));
        const kind = pickStatus(t.info.param);
        const victim = foes[Math.floor(host.rand() * foes.length)];
        if (kind && victim) notes.push(say(a.target, t, `espalhou espinhos tóxicos.`), ...applyStatus({ target: victim, source: a.target, kind, label: `Habilidade ${t.info.name}` }));
      } else if (code === "CLIMA_AREIA_REACAO" && hasLeft(a.target, t) && host.rand() < value(a.target, t)) {
        rt.field.sandUntil = host.getRound() + 1;
        notes.push(say(a.target, t, `levantou uma tempestade de areia para a próxima rodada.`));
      } else if (code === "ARMADURA_FRACA" && targetAlive && hasLeft(a.target, t) && !rt.weak.includes(a.target.id)) {
        const v = value(a.target, t);
        rt.weak.push(a.target.id);
        rt.agility[a.target.id] = (rt.agility[a.target.id] ?? 0) + v;
        notes.push(say(a.target, t, `a armadura quebrou: passa a receber 10% mais dano, mas ganhou ${pct(v)} de Agilidade.`));
        maybeTrace(a.target, "agility", v);
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
    if (h && h.info.effectCode === "ESTADO_TOQUE" && targetAlive && hasLeft(a.actor, h) && hpOf(a.actor) > 0 && host.rand() < value(a.actor, h) + statusChanceBonus(a.actor)) {
      const kind = pickStatus(h.info.param);
      if (kind) notes.push(say(a.actor, h, `o toque afetou o alvo.`), ...applyStatus({ target: a.target, source: a.actor, kind, label: `Habilidade ${h.info.name}` }));
    }
    if (!targetAlive) onFall(a.target, a.actor, notes);
    return notes;
  }

  // ── Estados: expiração, danos de rodada e ações ─────────────────────────────

  /** Estado citado no parâmetro ("queimado", "maldito" ou sorteado entre os citados). */
  function pickStatus(param: string | null): StatusKind | "CURSE" | null {
    if (paramMentionsCurse(param)) return "CURSE";
    const kinds = statusesInParam(param);
    if (kinds.length === 0) return null;
    return paramIsRandom(param) ? kinds[Math.floor(host.rand() * kinds.length)] : kinds[0];
  }

  /** Trace: quando um rival ganha um buff, o portador pode copiá-lo por 2 rodadas (um por vez). */
  function maybeTrace(owner: ArenaMascot, kind: "pending" | "agility", v: number) {
    for (const foe of alive(foesOf(owner))) {
      const h = heldAs(foe, "COPIA_BUFF");
      if (!h || !hasLeft(foe, h)) continue;
      const current = rt.traced[foe.id];
      if (current && current.until >= host.getRound()) continue;
      if (host.rand() >= value(foe, h)) continue;
      rt.traced[foe.id] = { kind, v, until: host.getRound() + 2 };
      standalone.push({ actor: foe, target: owner, text: say(foe, h, kind === "pending" ? `copiou o buff de ${owner.name}: o próximo golpe causa ${pct(v)} mais dano.` : `copiou o buff de ${owner.name}: Agilidade +${pct(v)} por 2 rodadas.`) });
      break;
    }
  }

  /** Início da rodada: estados vencidos saem; veneno e areia causam dano. */
  function tickRound(round: number) {
    for (const m of all) {
      const st = rt.status[m.id];
      if (st && (round > st.until || hpOf(m) <= 0)) {
        const text = clearStatus(m, "terminou o tempo");
        if (text && hpOf(m) > 0) standalone.push({ actor: m, text });
      }
      const curse = rt.curse[m.id];
      if (curse && hpOf(byId.get(curse.sourceId)!) <= 0) {
        delete rt.curse[m.id];
        if (hpOf(m) > 0) standalone.push({ actor: m, text: `${CURSE_INFO.emoji} A maldição sobre ${m.name} acabou: ${curse.sourceName} caiu.` });
      }
    }
    // Veneno: no fim do turno (aplicado no começo da rodada seguinte). Poison Heal cura em vez de ferir.
    for (const m of all) {
      const st = rt.status[m.id];
      if (!st || st.kind !== "POISON" || hpOf(m) <= 0 || round <= st.since) continue;
      const heal = heldAs(m, "CURA_VENENO");
      if (heal) {
        const gain = Math.max(1, Math.round(m.hp * value(m, heal)));
        const before = hpOf(m);
        healTarget(m, gain);
        standalone.push({ actor: m, target: m, heal: hpOf(m) - before, hpAfter: hpOf(m), text: `${STATUS_INFO.POISON.emoji} ${heal.info.name} de ${m.name}: o veneno curou ${hpOf(m) - before} HP em vez de ferir.` });
        continue;
      }
      const loss = Math.max(1, Math.round(m.hp * STATUS_RULES.poisonPct));
      const notes: string[] = [];
      loseHp(m, loss, byId.get(st.sourceId ?? "") ?? null, notes);
      standalone.push({ actor: m, target: m, hpAfter: hpOf(m), text: `${STATUS_INFO.POISON.emoji} ${m.name} perdeu ${loss} HP envenenado (${pct(STATUS_RULES.poisonPct)} do máximo).${notes.length ? " " + notes.join(" ") : ""}` });
    }
    // Tempestade de areia: rodadas 1–3 (Sand Stream) ou 1 rodada após a reação de Sand Spit.
    if (rt.field.areia || rt.field.sandUntil === round) {
      for (const m of alive(all)) {
        const types = host.typesOf(m);
        if (types.some((t) => t === "rock" || t === "ground" || t === "steel")) continue;
        const loss = Math.max(1, Math.round(m.hp * STATUS_RULES.sandPct));
        const notes: string[] = [];
        loseHp(m, loss, null, notes);
        standalone.push({ actor: m, target: m, hpAfter: hpOf(m), text: `🏜️ Tempestade de areia: ${m.name} perdeu ${loss} HP (${pct(STATUS_RULES.sandPct)} do máximo).${notes.length ? " " + notes.join(" ") : ""}` });
      }
    }
  }

  /**
   * Antes de cada ação do mascote: queimadura, cura de chuva, disfarces e os estados que impedem de agir
   * (sono, paralisia, confusão). Devolve \`skip\` quando a ação é perdida. Quedas são tratadas aqui.
   */
  function onActionStart(actor: ArenaMascot, actionIndex: number): { skip: boolean } {
    if (hpOf(actor) <= 0) return { skip: true };
    const round = host.getRound();
    const h = held(actor);

    // Disfarces: Illusion/Imposter/Transform na primeira ação.
    if (h && !rt.disguised.includes(actor.id) && (h.info.effectCode === "COPIA_TIPO_ALIADO" || h.info.effectCode === "COPIA_TIPO_RIVAL") && hasLeft(actor, h)) {
      rt.disguised.push(actor.id);
      const pool = h.info.effectCode === "COPIA_TIPO_ALIADO" ? alive(teamOf(actor)).filter((x) => x.id !== actor.id) : alive(foesOf(actor));
      const model = pool[0] ?? null;
      if (model) {
        const copied = [...host.typesOf(model)];
        actor.types = copied;
        rt.types[actor.id] = copied;
        const v = value(actor, h);
        const alliesMode = h.info.effectCode === "COPIA_TIPO_ALIADO";
        if (alliesMode) rt.tempShield[actor.id] = { v, until: round + 1 };
        else rt.tempAgility[actor.id] = { v, until: round + 1 };
        standalone.push({ actor, target: model, text: say(actor, h, `assumiu o tipo de ${model.name} (${copied.join("/")}) e ganhou ${alliesMode ? `${pct(v)} menos dano recebido` : `${pct(v)} de Agilidade`} por 2 rodadas.`) });
      }
    }

    // Dry Skin: na chuva, recupera HP antes de atacar.
    if (h && h.info.effectCode === "CURA_CLIMA" && rt.field.chuva && hasLeft(actor, h) && hpOf(actor) < actor.hp) {
      const gain = Math.max(1, Math.round(actor.hp * value(actor, h)));
      const text = say(actor, h, `a chuva curou ${Math.min(gain, actor.hp - hpOf(actor))} HP.`);
      const before = hpOf(actor);
      healTarget(actor, gain);
      standalone.push({ actor, target: actor, heal: hpOf(actor) - before, hpAfter: hpOf(actor), text });
    }

    const st = rt.status[actor.id];
    const active = Boolean(st && round > st.since && round <= st.until);
    if (!active || !st) return { skip: false };

    // Queimadura: no início do turno (1ª ação da rodada).
    if (st.kind === "BURN" && actionIndex === 0) {
      const loss = Math.max(1, Math.round(actor.hp * STATUS_RULES.burnPct));
      const notes: string[] = [];
      loseHp(actor, loss, byId.get(st.sourceId ?? "") ?? null, notes);
      standalone.push({ actor, target: actor, hpAfter: hpOf(actor), text: `${STATUS_INFO.BURN.emoji} ${actor.name} perdeu ${loss} HP queimado (${pct(STATUS_RULES.burnPct)} do máximo).${notes.length ? " " + notes.join(" ") : ""}` });
      if (hpOf(actor) <= 0) return { skip: true };
    }

    // Estados que fazem perder a ação. Mente aberta (No Guard) pode ignorá-los.
    const ignoreRoll = () => {
      const g = heldAs(actor, "ATACA_APESAR_ESTADO");
      return g && hasLeft(actor, g) && host.rand() < value(actor, g) ? g : null;
    };
    let skip = false;
    if (st.kind === "SLEEP") {
      if (host.rand() < STATUS_RULES.sleepWake) {
        const text = clearStatus(actor, "acordou");
        if (text) standalone.push({ actor, text });
      } else {
        const g = ignoreRoll();
        if (g) standalone.push({ actor, text: say(actor, g, `${actor.name} ignorou o sono e agiu mesmo assim.`) });
        else {
          skip = true;
          standalone.push({ actor, text: `${STATUS_INFO.SLEEP.emoji} ${actor.name} continua dormindo e não agiu.` });
        }
      }
    } else if (st.kind === "PARALYSIS") {
      if (host.rand() < STATUS_RULES.paralysisSkip) {
        const g = ignoreRoll();
        if (g) standalone.push({ actor, text: say(actor, g, `${actor.name} ignorou a paralisia e agiu mesmo assim.`) });
        else {
          skip = true;
          standalone.push({ actor, text: `${STATUS_INFO.PARALYSIS.emoji} ${actor.name} está paralisado e não conseguiu agir.` });
        }
      }
    } else if (st.kind === "CONFUSION") {
      if (host.rand() < STATUS_RULES.confusionSelfHit) {
        const g = ignoreRoll();
        if (g) standalone.push({ actor, text: say(actor, g, `${actor.name} ignorou a confusão e agiu mesmo assim.`) });
        else {
          skip = true;
          const loss = Math.max(1, Math.round(actor.hp * STATUS_RULES.confusionSelfPct));
          const notes: string[] = [];
          loseHp(actor, loss, null, notes);
          standalone.push({ actor, target: actor, hpAfter: hpOf(actor), text: `${STATUS_INFO.CONFUSION.emoji} ${actor.name} está confuso e se machucou: perdeu ${loss} HP em vez de atacar.${notes.length ? " " + notes.join(" ") : ""}` });
        }
      }
      if (hpOf(actor) > 0 && host.rand() < STATUS_RULES.confusionCure) {
        const text = clearStatus(actor, "a confusão passou");
        if (text) standalone.push({ actor, text });
      }
    }
    return { skip: skip || hpOf(actor) <= 0 };
  }

  /** Propeller Tail/Stalwart: chance de ignorar o Provocador que desviaria o golpe. */
  function ignoresProvoker(actor: ArenaMascot): string | null {
    const h = heldAs(actor, "IGNORA_PROVOCADOR");
    if (!h || !hasLeft(actor, h) || host.rand() >= value(actor, h)) return null;
    return say(actor, h, `ignorou o Provocador e manteve o alvo.`);
  }

  return {
    onBattleStart, onRoundStart, onActionStart, ignoresProvoker, attackBonus, buffMods, maybeRedirect, onDefend, defense, guardianExtra, survive, afterHit,
    applyDebuff, flushEvents, flushStandalone, flushHpChanges, healTarget,
    agilityMult: (id: string) => {
      const m = byId.get(id);
      const round = host.getRound();
      let v = rt.agility[id] ?? 0;
      const temp = rt.tempAgility[id];
      if (temp && temp.until >= round) v += temp.v;
      const trace = rt.traced[id];
      if (trace && trace.kind === "agility" && trace.until >= round) v += trace.v;
      if (m) {
        const h = held(m);
        if (h?.info.effectCode === "AGILIDADE_ESTADO" && matchesStatus(m, h.info.param)) v += value(m, h);
        if (h?.info.effectCode === "ATRIBUTO_CLIMA" && rt.field.sol && highestStat(m) === "agility") v += value(m, h);
      }
      return 1 + v;
    },
    snapshot: (): AbilityRuntime => structuredClone(rt),
  };
}

export type AbilityEngine = ReturnType<typeof createAbilityEngine>;
