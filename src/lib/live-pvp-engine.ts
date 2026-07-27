import { getTypeAdvantageMultiplier } from "@/lib/mascot-data";
import type { LivePvpMove } from "@/lib/live-pvp-moves";

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
};

export type LivePvpTurnResult = {
  first: "A" | "B";
  fighterA: LivePvpFighter;
  fighterB: LivePvpFighter;
  events: string[];
  winner: "A" | "B" | null;
};

function clone(fighter: LivePvpFighter): LivePvpFighter {
  return { ...fighter, types: [...fighter.types] };
}

function attackStat(fighter: LivePvpFighter, move: LivePvpMove) {
  return move.damageClass === "physical"
    ? fighter.force
    : Math.round((fighter.instinct + fighter.charisma) / 2);
}

function defenseStat(fighter: LivePvpFighter, move: LivePvpMove) {
  return move.damageClass === "physical"
    ? fighter.vitality
    : Math.round((fighter.vitality + fighter.charisma) / 2);
}

function execute(
  attacker: LivePvpFighter,
  defender: LivePvpFighter,
  move: LivePvpMove,
  random: () => number,
  events: string[],
) {
  if (attacker.hp <= 0 || defender.hp <= 0) return;
  if (move.slug === "transform") {
    const originalName = attacker.transformedFromName ?? attacker.name;
    attacker.pokemonId = defender.pokemonId;
    attacker.spriteUrl = defender.spriteUrl;
    attacker.name = `${originalName} transformado em ${defender.transformedFromName ?? defender.name}`;
    attacker.types = [...defender.types];
    attacker.force = defender.force;
    attacker.agility = defender.agility;
    attacker.charisma = defender.charisma;
    attacker.instinct = defender.instinct;
    attacker.vitality = defender.vitality;
    attacker.transformedFromName = originalName;
    events.push(
      `${originalName} usou Transform e copiou a forma, os tipos, os atributos e os golpes atuais de ${defender.name}. Seu HP foi preservado.`,
    );
    return;
  }
  if (move.accuracy != null && random() * 100 >= move.accuracy) {
    events.push(`${attacker.name} usou ${move.name}, mas errou.`);
    return;
  }
  if (move.damageClass === "status" || !move.power) {
    events.push(
      `${attacker.name} usou ${move.name}. Efeitos avançados ainda não estão habilitados neste protótipo.`,
    );
    return;
  }

  const levelFactor = (2 * attacker.level) / 5 + 2;
  const raw =
    (levelFactor * move.power * Math.max(1, attackStat(attacker, move))) /
      Math.max(1, defenseStat(defender, move)) /
      50 +
    2;
  const stab = attacker.types.includes(move.type) ? 1.2 : 1;
  const typeMultiplier = getTypeAdvantageMultiplier(move.type, defender.types);
  const variance = 0.9 + random() * 0.1;
  const damage = Math.max(
    1,
    Math.round(raw * stab * typeMultiplier * variance),
  );
  defender.hp = Math.max(0, defender.hp - damage);
  const effectiveness =
    typeMultiplier > 1
      ? " Foi super efetivo!"
      : typeMultiplier < 1
        ? " Não foi muito efetivo."
        : "";
  events.push(
    `${attacker.name} usou ${move.name} e causou ${damage} de dano.${effectiveness}`,
  );
}

export function resolveLivePvpTurn(
  inputA: LivePvpFighter,
  moveA: LivePvpMove | null,
  inputB: LivePvpFighter,
  moveB: LivePvpMove | null,
  random: () => number = Math.random,
): LivePvpTurnResult {
  const fighterA = clone(inputA);
  const fighterB = clone(inputB);
  const priorityA = moveA?.priority ?? -99;
  const priorityB = moveB?.priority ?? -99;
  const first: "A" | "B" =
    priorityA !== priorityB
      ? priorityA > priorityB
        ? "A"
        : "B"
      : fighterA.agility !== fighterB.agility
        ? fighterA.agility > fighterB.agility
          ? "A"
          : "B"
        : random() < 0.5
          ? "A"
          : "B";
  const events: string[] = [];
  const act = (
    attacker: LivePvpFighter,
    defender: LivePvpFighter,
    move: LivePvpMove | null,
    side: "A" | "B",
  ) => {
    if (!move) {
      events.push(
        `${attacker.name} perdeu a ação por tempo esgotado (${side}).`,
      );
      return;
    }
    execute(attacker, defender, move, random, events);
  };

  if (first === "A") {
    act(fighterA, fighterB, moveA, "A");
    act(fighterB, fighterA, moveB, "B");
  } else {
    act(fighterB, fighterA, moveB, "B");
    act(fighterA, fighterB, moveA, "A");
  }

  return {
    first,
    fighterA,
    fighterB,
    events,
    winner: fighterA.hp <= 0 ? "B" : fighterB.hp <= 0 ? "A" : null,
  };
}
