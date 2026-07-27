import { getTypeAdvantageMultiplier } from "@/lib/mascot-data";
import type { LivePvpMove } from "@/lib/live-pvp-moves";

export type LivePvpStatus =
  | "paralysis"
  | "sleep"
  | "poison"
  | "badly-poisoned"
  | "burn"
  | "freeze"
  | null;
export type LivePvpFighter = {
  id: string;
  pokemonId: number;
  spriteUrl: string;
  name: string;
  level: number;
  types: string[];
  hp: number;
  maxHp: number;
  force: number;
  agility: number;
  charisma: number;
  instinct: number;
  vitality: number;
  transformedFromName?: string;
  status?: LivePvpStatus;
  statusTurns?: number;
  confusionTurns?: number;
  statStages?: Record<string, number>;
  flinched?: boolean;
  toxicCounter?: number;
  protected?: boolean;
};
export type LivePvpTurnResult = {
  first: "A" | "B";
  fighterA: LivePvpFighter;
  fighterB: LivePvpFighter;
  events: string[];
  winner: "A" | "B" | null;
};

const STATUS_LABEL: Record<string, string> = {
  paralysis: "paralisia",
  sleep: "sono",
  poison: "veneno",
  "badly-poisoned": "veneno grave",
  burn: "queimadura",
  freeze: "congelamento",
  confusion: "confusão",
};
const SELF_TARGETS = new Set(["user", "users-field", "user-or-ally"]);
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
function clone(f: LivePvpFighter): LivePvpFighter {
  return { ...f, types: [...f.types], statStages: { ...(f.statStages ?? {}) } };
}
function stageMultiplier(stage = 0) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}
function staged(f: LivePvpFighter, key: string, value: number) {
  return value * stageMultiplier(f.statStages?.[key] ?? 0);
}
function attackStat(f: LivePvpFighter, m: LivePvpMove) {
  return m.damageClass === "physical"
    ? staged(f, "attack", f.force)
    : staged(f, "special-attack", (f.instinct + f.charisma) / 2);
}
function defenseStat(f: LivePvpFighter, m: LivePvpMove) {
  return m.damageClass === "physical"
    ? staged(f, "defense", f.vitality)
    : staged(f, "special-defense", (f.vitality + f.charisma) / 2);
}
function effectiveSpeed(f: LivePvpFighter) {
  const speed = staged(f, "speed", f.agility);
  return f.status === "paralysis" ? speed / 2 : speed;
}
function chance(value: number | null | undefined, fallback = 100) {
  return value && value > 0 ? value : fallback;
}
function rollPercent(random: () => number, pct: number) {
  return random() * 100 < pct;
}

function canAct(f: LivePvpFighter, random: () => number, events: string[]) {
  if (f.flinched) {
    f.flinched = false;
    events.push(`${f.name} hesitou e perdeu a ação.`);
    return false;
  }
  if (f.status === "sleep") {
    if ((f.statusTurns ?? 0) > 0) {
      f.statusTurns = (f.statusTurns ?? 1) - 1;
      events.push(`${f.name} está dormindo.`);
      return false;
    }
    f.status = null;
    events.push(`${f.name} acordou.`);
  }
  if (f.status === "freeze") {
    if (!rollPercent(random, 20)) {
      events.push(`${f.name} está congelado e não conseguiu agir.`);
      return false;
    }
    f.status = null;
    events.push(`${f.name} descongelou.`);
  }
  if (f.status === "paralysis" && rollPercent(random, 25)) {
    events.push(`${f.name} está paralisado e não conseguiu agir.`);
    return false;
  }
  if ((f.confusionTurns ?? 0) > 0) {
    f.confusionTurns!--;
    if (rollPercent(random, 33.33)) {
      const damage = Math.max(1, Math.round(f.maxHp / 10));
      f.hp = Math.max(0, f.hp - damage);
      events.push(
        `${f.name} se feriu na própria confusão e perdeu ${damage} HP.`,
      );
      return false;
    }
    events.push(`${f.name} superou a confusão nesta ação.`);
    if (f.confusionTurns === 0) events.push(`${f.name} não está mais confuso.`);
  }
  return f.hp > 0;
}
function applyAilment(
  attacker: LivePvpFighter,
  target: LivePvpFighter,
  move: LivePvpMove,
  random: () => number,
  events: string[],
) {
  if (
    move.ailment === "none" ||
    !rollPercent(
      random,
      Math.min(
        100,
        chance(move.ailmentChance, move.effectChance ?? 100) +
          attackerSupportBonus(move, attacker),
      ),
    )
  )
    return;
  const immune =
    (move.ailment === "burn" && target.types.includes("fire")) ||
    (move.ailment === "freeze" && target.types.includes("ice")) ||
    (move.ailment === "paralysis" && target.types.includes("electric")) ||
    (["poison", "badly-poisoned"].includes(move.ailment) &&
      target.types.some((type) => type === "poison" || type === "steel")) ||
    ((move.slug.includes("powder") || move.slug.includes("spore")) &&
      target.types.includes("grass"));
  if (immune) {
    events.push(`${target.name} é imune ao efeito de ${move.name}.`);
    return;
  }
  if (move.ailment === "confusion") {
    target.confusionTurns = 2 + Math.floor(random() * 4);
    events.push(
      `${target.name} ficou confuso por até ${target.confusionTurns} ações.`,
    );
    return;
  }
  const supported: LivePvpStatus[] = [
    "paralysis",
    "sleep",
    "poison",
    "badly-poisoned",
    "burn",
    "freeze",
  ];
  if (!supported.includes(move.ailment as LivePvpStatus) || target.status)
    return;
  target.status = move.ailment as LivePvpStatus;
  target.statusTurns =
    move.ailment === "sleep" ? 1 + Math.floor(random() * 3) : undefined;
  target.toxicCounter = move.ailment === "badly-poisoned" ? 1 : undefined;
  events.push(
    `${target.name} recebeu ${STATUS_LABEL[move.ailment] ?? move.ailment}.`,
  );
}
function attackerSupportBonus(move: LivePvpMove, attacker: LivePvpFighter) {
  return Math.min(
    15,
    (SELF_TARGETS.has(move.target) ? attacker.charisma : attacker.instinct) /
      18,
  );
}
function applyStatChanges(
  attacker: LivePvpFighter,
  defender: LivePvpFighter,
  move: LivePvpMove,
  random: () => number,
  events: string[],
) {
  const selfTarget = SELF_TARGETS.has(move.target);
  const supportChance = Math.min(
    18,
    (selfTarget ? attacker.charisma : attacker.instinct) / 14,
  );
  if (
    !move.statChanges.length ||
    !rollPercent(
      random,
      Math.min(100, chance(move.effectChance, 100) + supportChance),
    )
  )
    return;
  const target = selfTarget ? attacker : defender;
  target.statStages ??= {};
  for (const change of move.statChanges) {
    const before = target.statStages[change.stat] ?? 0;
    const extra =
      selfTarget &&
      change.change > 0 &&
      rollPercent(random, Math.min(35, attacker.charisma / 8))
        ? 1
        : 0;
    target.statStages[change.stat] = clamp(
      before + change.change + extra,
      -6,
      6,
    );
    events.push(
      `${target.name}: ${change.stat} ${change.change > 0 ? "subiu" : "caiu"} ${Math.abs(change.change) + extra} estágio(s)${extra ? " com impulso do Carisma" : ""}.`,
    );
  }
}
function calculateDamage(
  attacker: LivePvpFighter,
  defender: LivePvpFighter,
  move: LivePvpMove,
  random: () => number,
) {
  const levelFactor = (2 * attacker.level) / 5 + 2;
  let raw =
    (levelFactor *
      (move.power ?? 0) *
      Math.max(1, attackStat(attacker, move))) /
      Math.max(1, defenseStat(defender, move)) /
      50 +
    2;
  if (attacker.status === "burn" && move.damageClass === "physical") raw *= 0.5;
  const stab = attacker.types.includes(move.type) ? 1.2 : 1;
  const type = getTypeAdvantageMultiplier(move.type, defender.types);
  const critical = rollPercent(random, 6.25 * (1 + move.critRate));
  return {
    damage: Math.max(
      1,
      Math.round(
        raw * stab * type * (0.9 + random() * 0.1) * (critical ? 1.5 : 1),
      ),
    ),
    type,
    critical,
  };
}
function execute(
  attacker: LivePvpFighter,
  defender: LivePvpFighter,
  move: LivePvpMove,
  random: () => number,
  events: string[],
) {
  if (attacker.hp <= 0 || defender.hp <= 0 || !canAct(attacker, random, events))
    return;
  if (move.slug === "transform") {
    const original = attacker.transformedFromName ?? attacker.name;
    Object.assign(attacker, {
      pokemonId: defender.pokemonId,
      spriteUrl: defender.spriteUrl,
      name: `${original} transformado em ${defender.transformedFromName ?? defender.name}`,
      types: [...defender.types],
      force: defender.force,
      agility: defender.agility,
      charisma: defender.charisma,
      instinct: defender.instinct,
      vitality: defender.vitality,
      statStages: { ...(defender.statStages ?? {}) },
      transformedFromName: original,
    });
    events.push(
      `${original} usou Transform e copiou forma, tipos, atributos, estágios e golpes de ${defender.name}. O HP foi preservado.`,
    );
    return;
  }
  if (
    [
      "protect",
      "detect",
      "kings-shield",
      "spiky-shield",
      "baneful-bunker",
      "silk-trap",
      "burning-bulwark",
    ].includes(move.slug)
  ) {
    attacker.protected = true;
    events.push(`${attacker.name} se protegeu contra ataques nesta rodada.`);
    return;
  }
  if (move.slug === "rest") {
    const healed = attacker.maxHp - attacker.hp;
    attacker.hp = attacker.maxHp;
    attacker.status = "sleep";
    attacker.statusTurns = 2;
    events.push(
      `${attacker.name} usou ${move.name}, recuperou ${healed} HP e adormeceu por duas ações.`,
    );
    return;
  }
  const bespoke = new Set([
    "metronome",
    "future-sight",
    "substitute",
    "power-swap",
    "guard-swap",
    "power-trick",
    "trick-room",
    "wonder-room",
    "magic-room",
    "baton-pass",
    "belly-drum",
    "counter",
    "mirror-coat",
    "encore",
    "disable",
    "taunt",
    "torment",
  ]);
  if (bespoke.has(move.slug)) {
    events.push(
      `${attacker.name} usou ${move.name}, mas a regra exclusiva deste golpe ainda não foi habilitada no sandbox.`,
    );
    return;
  }
  if (defender.protected) {
    events.push(`${defender.name} bloqueou completamente ${move.name}.`);
    return;
  }
  const accuracy =
    move.accuracy == null
      ? 100
      : move.accuracy *
        stageMultiplier(
          (attacker.statStages?.accuracy ?? 0) -
            (defender.statStages?.evasion ?? 0),
        );
  if (!rollPercent(random, accuracy)) {
    events.push(`${attacker.name} usou ${move.name}, mas errou.`);
    return;
  }
  let totalDamage = 0;
  let effectiveness = 1;
  let critical = false;
  const hits = move.power
    ? move.minHits && move.maxHits
      ? move.minHits + Math.floor(random() * (move.maxHits - move.minHits + 1))
      : 1
    : 0;
  for (let i = 0; i < hits && defender.hp > 0; i++) {
    const result = calculateDamage(attacker, defender, move, random);
    defender.hp = Math.max(0, defender.hp - result.damage);
    totalDamage += result.damage;
    effectiveness = result.type;
    critical ||= result.critical;
  }
  if (totalDamage) {
    events.push(
      `${attacker.name} usou ${move.name} e causou ${totalDamage} de dano${hits > 1 ? ` em ${hits} acertos` : ""}.${effectiveness > 1 ? " Foi super efetivo!" : effectiveness < 1 ? " Não foi muito efetivo." : ""}${critical ? " Acerto crítico!" : ""}`,
    );
  } else events.push(`${attacker.name} usou ${move.name}.`);
  if (move.healing) {
    const supportScale =
      0.75 +
      attacker.charisma / 500 +
      attacker.vitality / 750 +
      attacker.level / 500;
    const healed = Math.min(
      attacker.maxHp - attacker.hp,
      Math.round(((attacker.maxHp * move.healing) / 100) * supportScale),
    );
    attacker.hp += healed;
    events.push(
      `${attacker.name} recuperou ${healed} HP com escala de Carisma, Vitalidade e nível.`,
    );
  }
  if (move.drain > 0 && totalDamage) {
    const healed = Math.min(
      attacker.maxHp - attacker.hp,
      Math.max(1, Math.round((totalDamage * move.drain) / 100)),
    );
    attacker.hp += healed;
    events.push(`${attacker.name} drenou ${healed} HP.`);
  }
  if (move.drain < 0 && totalDamage) {
    const recoil = Math.max(
      1,
      Math.round((totalDamage * Math.abs(move.drain)) / 100),
    );
    attacker.hp = Math.max(0, attacker.hp - recoil);
    events.push(`${attacker.name} sofreu ${recoil} de recuo.`);
  }
  applyAilment(
    attacker,
    SELF_TARGETS.has(move.target) ? attacker : defender,
    move,
    random,
    events,
  );
  applyStatChanges(attacker, defender, move, random, events);
  if (move.flinchChance && rollPercent(random, move.flinchChance))
    defender.flinched = true;
}
function residual(f: LivePvpFighter, events: string[]) {
  if (f.hp <= 0) return;
  if (f.status === "burn" || f.status === "poison") {
    const damage = Math.max(
      1,
      Math.floor(f.maxHp / (f.status === "burn" ? 16 : 8)),
    );
    f.hp = Math.max(0, f.hp - damage);
    events.push(`${f.name} perdeu ${damage} HP por ${STATUS_LABEL[f.status]}.`);
  }
  if (f.status === "badly-poisoned") {
    const damage = Math.max(
      1,
      Math.floor((f.maxHp * (f.toxicCounter ?? 1)) / 16),
    );
    f.toxicCounter = (f.toxicCounter ?? 1) + 1;
    f.hp = Math.max(0, f.hp - damage);
    events.push(`${f.name} perdeu ${damage} HP por veneno grave.`);
  }
}

export function resolveLivePvpTurn(
  inputA: LivePvpFighter,
  moveA: LivePvpMove | null,
  inputB: LivePvpFighter,
  moveB: LivePvpMove | null,
  random: () => number = Math.random,
): LivePvpTurnResult {
  const fighterA = clone(inputA),
    fighterB = clone(inputB);
  fighterA.protected = false;
  fighterB.protected = false;
  fighterA.flinched = false;
  fighterB.flinched = false;
  const pA = moveA?.priority ?? -99,
    pB = moveB?.priority ?? -99;
  const first: "A" | "B" =
    pA !== pB
      ? pA > pB
        ? "A"
        : "B"
      : effectiveSpeed(fighterA) !== effectiveSpeed(fighterB)
        ? effectiveSpeed(fighterA) > effectiveSpeed(fighterB)
          ? "A"
          : "B"
        : random() < 0.5
          ? "A"
          : "B";
  const events: string[] = [];
  const act = (
    a: LivePvpFighter,
    d: LivePvpFighter,
    m: LivePvpMove | null,
    s: "A" | "B",
  ) => {
    if (!m) {
      events.push(`${a.name} perdeu a ação por tempo esgotado (${s}).`);
      return;
    }
    execute(a, d, m, random, events);
  };
  if (first === "A") {
    act(fighterA, fighterB, moveA, "A");
    act(fighterB, fighterA, moveB, "B");
  } else {
    act(fighterB, fighterA, moveB, "B");
    act(fighterA, fighterB, moveA, "A");
  }
  residual(fighterA, events);
  residual(fighterB, events);
  return {
    first,
    fighterA,
    fighterB,
    events,
    winner: fighterA.hp <= 0 ? "B" : fighterB.hp <= 0 ? "A" : null,
  };
}
