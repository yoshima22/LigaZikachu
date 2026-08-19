// Núcleo tático da Torre: resolve UMA rodada completa (movimento → posturas →
// combate), parametrizado por grid + obstáculos. Mecânica espelhada da Arena Z /
// league-combat (iniciativa por Agilidade, mobilidade por vantagem de Agilidade,
// alcance por papel, escudos, reação de Defensor, multiplicadores de papel e
// vantagem de tipo). Nada aqui importa o motor da Arena — é código independente.

import type { CombatRole } from "@/lib/combat-roles";
import { getHealerHealAmount } from "@/lib/combat-roles";
import { getTypeAdvantageMultiplier } from "@/lib/mascot-data";
import {
  manhattan,
  pathCost,
  reachableTiles,
  tileKey,
  towerRoll,
} from "./grid";
import type {
  TowerBattleEvent,
  TowerRoundInput,
  TowerRoundResult,
  TowerUnit,
} from "./types";

/** Atributo efetivo (base + buffs/debuffs ativos), mínimo 1. Espelha a Arena. */
function effectiveStat(
  unit: TowerUnit,
  stat: "force" | "agility" | "charisma" | "instinct" | "vitality",
): number {
  const base = unit[stat];
  const mod = unit.effects.reduce(
    (sum, e) =>
      e.stat === stat ? sum + (e.kind === "BUFF" ? e.value : -e.value) : sum,
    0,
  );
  return Math.max(1, Math.round(base * (1 + mod)));
}

/** Alcance de ataque por papel (mesmos valores da Arena). */
function roleRange(role: CombatRole): number {
  if (["DEFENDER", "ATTACKER", "GUARDIAN", "PROVOKER", "SURVIVOR"].includes(role)) return 1;
  if (role === "SCOUT" || role === "HEALER" || role === "ENCOURAGER") return 3;
  return 2;
}

/** Multiplicador de dano por papel atacante×alvo (espelha league-combat). */
function damageMultiplier(actor: TowerUnit, target: TowerUnit): number {
  let m = 1;
  const force = effectiveStat(actor, "force");
  const agility = effectiveStat(actor, "agility");
  const instinct = effectiveStat(actor, "instinct");
  if (actor.role === "ATTACKER") m *= 1.08 + Math.min(0.18, force / 420);
  if (actor.role === "ATTACKER" && target.role === "DEFENDER") m *= 1.15;
  if (actor.role === "FLANK") m *= 1.04 + Math.min(0.14, agility / 500);
  if (actor.role === "FLANK" && ["ENCOURAGER", "OPPORTUNIST", "HEALER"].includes(target.role)) m *= 1.12;
  if (actor.role === "OPPORTUNIST" && instinct > effectiveStat(target, "instinct")) m *= 1.1;
  if (actor.role === "DUELIST") m *= 1.06 + Math.min(0.12, (force + instinct) / 800);
  if (actor.role === "PROVOKER") m *= 0.92;
  if (actor.role === "SCOUT") m *= 0.95;
  if (actor.role === "GUARDIAN") m *= 0.9;
  if (actor.role === "HEALER") m *= 0.8;
  const tVit = effectiveStat(target, "vitality");
  if (target.role === "DEFENDER") m *= 1 - Math.min(0.35, 0.08 + tVit / 240);
  if (target.role === "GUARDIAN") m *= 1 - Math.min(0.2, 0.05 + tVit / 300);
  if (target.role === "SURVIVOR") m *= 1 - Math.min(0.15, tVit / 400);
  return m;
}

function shieldForRole(role: CombatRole): number {
  return role === "DEFENDER" ? 0.45 : role === "GUARDIAN" ? 0.38 : 0.32;
}

/** Resolve UMA rodada. Retorna novo array de unidades (imutável) + eventos. */
export function resolveTowerRound(input: TowerRoundInput): TowerRoundResult {
  const { grid, orders, round, seed } = input;
  const units = input.units.map((u) => ({ ...u, effects: u.effects.map((e) => ({ ...e })) }));
  const events: TowerBattleEvent[] = [];
  const byId = new Map(units.map((u) => [u.id, u]));
  const alive = () => units.filter((u) => u.hp > 0);
  const occupied = new Set(alive().map((u) => tileKey(u.x, u.y)));

  // ── 1) MOVIMENTO — por time, iniciativa (Agilidade desc) ──────────────────
  for (const team of ["ALLY", "ENEMY"] as const) {
    const teamUnits = alive()
      .filter((u) => u.team === team)
      .sort((a, b) => effectiveStat(b, "agility") - effectiveStat(a, "agility"));
    const enemies = () => alive().filter((u) => u.team !== team);
    for (const unit of teamUnits) {
      const order = orders.get(unit.id);
      if (!order || (order.type !== "MOVE" && order.x === undefined)) continue;
      const destX = order.x ?? unit.x;
      const destY = order.y ?? unit.y;
      if (destX === unit.x && destY === unit.y) continue;

      const foes = enemies();
      const enemyAvg = foes.length
        ? foes.reduce((s, e) => s + effectiveStat(e, "agility"), 0) / foes.length
        : effectiveStat(unit, "agility");
      const adv = effectiveStat(unit, "agility") - enemyAvg;
      const mobility = 2 + (adv >= 140 ? 2 : adv >= 60 ? 1 : 0);
      const leavingControl =
        unit.role !== "FLANK" && foes.some((e) => manhattan(unit, e) === 1) ? 1 : 0;

      // Sai da própria casa da lista de ocupadas para calcular o caminho.
      occupied.delete(tileKey(unit.x, unit.y));
      const direct = pathCost(grid, unit, { x: destX, y: destY }, occupied, mobility + leavingControl + 4);
      const from = { x: unit.x, y: unit.y };
      let moved = false;
      if (direct !== null && direct + leavingControl <= mobility) {
        unit.x = destX;
        unit.y = destY;
        moved = true;
      } else {
        // Fallback: casa livre alcançável mais próxima do destino desejado.
        const reach = reachableTiles(grid, unit, mobility - leavingControl, occupied);
        let best: { x: number; y: number; d: number } | null = null;
        for (const key of reach.keys()) {
          const [x, y] = key.split(":").map(Number);
          const d = Math.abs(x - destX) + Math.abs(y - destY);
          if (!best || d < best.d) best = { x, y, d };
        }
        if (best && (best.x !== unit.x || best.y !== unit.y)) {
          unit.x = best.x;
          unit.y = best.y;
          moved = true;
        }
      }
      occupied.add(tileKey(unit.x, unit.y));
      if (moved) {
        events.push({
          unitId: unit.id,
          kind: "MOVE",
          text: `${unit.name} moveu-se.`,
          fromX: from.x,
          fromY: from.y,
          toX: unit.x,
          toY: unit.y,
        });
      } else {
        events.push({ unitId: unit.id, kind: "BLOCK", text: `${unit.name} não conseguiu avançar.` });
      }
    }
  }

  // ── 2) POSTURAS / ESCUDOS ─────────────────────────────────────────────────
  for (const unit of units) unit.shield = 0;
  for (const unit of alive()) {
    if (orders.get(unit.id)?.type !== "DEFEND") continue;
    unit.shield = shieldForRole(unit.role);
    events.push({
      unitId: unit.id,
      targetId: unit.id,
      kind: "DEFEND",
      text: `${unit.name} preparou ${Math.round(unit.shield * 100)}% de defesa.`,
      amount: Math.round(unit.shield * 100),
    });
  }

  // ── 3) COMBATE — iniciativa (Agilidade desc; desempate determinístico) ─────
  const actors = [...alive()].sort(
    (a, b) =>
      effectiveStat(b, "agility") - effectiveStat(a, "agility") ||
      towerRoll(seed, round, a.id) - towerRoll(seed, round, b.id),
  );
  for (const actor of actors) {
    if (actor.hp <= 0) continue;
    const enemies = alive().filter((u) => u.team !== actor.team);
    const allies = alive().filter((u) => u.team === actor.team);
    if (!enemies.length) break;
    const order = orders.get(actor.id);
    const action = order?.type ?? "AUTO";
    if (action === "WAIT" || action === "DEFEND") continue;

    // Cuidador em AUTO cura o aliado mais ferido a até 3 casas.
    if (actor.role === "HEALER" && action === "AUTO") {
      const wounded = allies
        .filter((a) => a.id !== actor.id && a.hp > 0 && a.hp < a.maxHp && manhattan(actor, a) <= 3)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (wounded) {
        const amount = getHealerHealAmount({
          charisma: effectiveStat(actor, "charisma"),
          vitality: effectiveStat(actor, "vitality"),
          level: actor.level,
        });
        wounded.hp = Math.min(wounded.maxHp, wounded.hp + amount);
        events.push({ unitId: actor.id, targetId: wounded.id, kind: "HEAL", text: `${actor.name} curou ${wounded.name}.`, amount });
        continue;
      }
    }

    const range = roleRange(actor.role);
    let candidates = enemies.filter((e) => manhattan(actor, e) <= range);
    if (!candidates.length) continue;
    if (actor.role === "FLANK" || actor.role === "SCOUT")
      candidates = candidates.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    else if (actor.role === "ATTACKER")
      candidates = candidates.sort((a, b) => effectiveStat(b, "force") - effectiveStat(a, "force"));
    else if (actor.role === "OPPORTUNIST")
      candidates = candidates.sort((a, b) => effectiveStat(a, "instinct") - effectiveStat(b, "instinct"));

    let target =
      (action === "ATTACK" && order?.targetId
        ? candidates.find((u) => u.id === order.targetId)
        : null) ?? candidates[0];
    const originalTarget = target;

    // Reação do Defensor: a até 2 casas do alvo pode redirecionar o ataque para si.
    const defender = enemies.find(
      (u) => u.role === "DEFENDER" && u.id !== target.id && u.hp > 0 && manhattan(u, target) <= 2,
    );
    if (defender) {
      if (actor.role === "FLANK") {
        const bypass = Math.min(0.82, 0.35 + effectiveStat(actor, "agility") / 530);
        if (towerRoll(seed, round, actor.id, defender.id, "flank") >= bypass) {
          target = defender;
        } else {
          events.push({ unitId: actor.id, targetId: defender.id, kind: "BYPASS", text: `${actor.name} flanqueou a zona de ${defender.name}.` });
        }
      } else {
        const base = actor.role === "ATTACKER" ? 0.62 : 0.78;
        const chance = Math.min(0.95, base + (orders.get(defender.id)?.type === "DEFEND" ? 0.2 : 0));
        if (towerRoll(seed, round, actor.id, defender.id) < chance) {
          target = defender;
          events.push({ unitId: defender.id, targetId: originalTarget.id, kind: "REDIRECT", text: `${defender.name} redirecionou o ataque que iria em ${originalTarget.name}.` });
        }
      }
    }

    // Dano.
    const base = effectiveStat(actor, "force") * 0.7 + actor.level * 1.2 + 8;
    const typeMult = getTypeAdvantageMultiplier(actor.types, target.types);
    const variance = 0.9 + towerRoll(seed, round, actor.id, target.id, "dmg") * 0.2;
    let dmg = Math.max(1, Math.round(base * damageMultiplier(actor, target) * typeMult * variance));
    dmg = Math.round(dmg * (1 - target.shield));
    target.shield = 0;

    const before = target.hp;
    let after = Math.max(0, before - dmg);
    // Sobrevivente resiste a um golpe fatal, uma vez.
    if (after <= 0 && target.role === "SURVIVOR" && !target.survivorUsed) {
      target.survivorUsed = true;
      after = 1;
      events.push({ unitId: target.id, kind: "SURVIVE", text: `${target.name} resistiu ao golpe fatal!` });
    }
    target.hp = after;
    events.push({ unitId: actor.id, targetId: target.id, kind: "ATTACK", text: `${actor.name} atacou ${target.name} (${dmg}).`, amount: dmg });
    if (before > 0 && after <= 0) {
      events.push({ unitId: actor.id, targetId: target.id, kind: "KO", text: `${target.name} foi derrotado.` });
    }
  }

  // ── 4) Duração dos efeitos ────────────────────────────────────────────────
  for (const unit of units) {
    unit.effects = unit.effects
      .map((e) => ({ ...e, duration: e.duration - 1 }))
      .filter((e) => e.duration > 0);
  }

  return { units, events };
}

/** Fim do encounter? true quando um dos lados não tem mais unidades vivas. */
export function isEncounterOver(units: TowerUnit[]): boolean {
  const allies = units.some((u) => u.team === "ALLY" && u.hp > 0);
  const enemies = units.some((u) => u.team === "ENEMY" && u.hp > 0);
  return !allies || !enemies;
}
