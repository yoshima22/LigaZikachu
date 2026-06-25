import type { ArenaTurnLog } from "./arena-z";
import { getPokemonElement, getPokemonTypes, getTypeAdvantageMultiplier, getPokemonName } from "./mascot-data";
import { normalizeCombatRole, getCombatRoleLabel, type CombatRole } from "./combat-roles";
import type { WeeklyModifier, LeagueItemDef } from "@/app/(app)/combates/liga-semanal/constants";

// ── Types ──────────────────────────────────────────────────────────────────

export type LeagueMascot = {
  id: string;
  ownerId: string;
  pokemonId: number;
  name: string;
  level: number;
  force: number;
  agility: number;
  instinct: number;
  vitality: number;
  charisma: number;
  hp: number;
  combatRole: CombatRole;
  slot: number;
};

export type LeagueBattleResult = {
  winner: "A" | "B" | "DRAW";
  teamASurvivors: number;
  teamBSurvivors: number;
  teamADamageDealt: number;
  teamBDamageDealt: number;
  teamADamageTaken: number;
  teamBDamageTaken: number;
  log: ArenaTurnLog[];
  rounds: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function alive(team: LeagueMascot[], hp: Map<string, number>) {
  return team.filter(m => (hp.get(m.id) ?? 0) > 0);
}

// ── Build mascot from DB data ──────────────────────────────────────────────

export function toLeagueMascot(m: {
  id: string;
  playerId: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statForce: number;
  statAgility: number;
  statInstinct: number;
  statVitality: number;
  statCharisma: number;
}, slot: number, role?: string | null): LeagueMascot {
  const combatRole = normalizeCombatRole(role);
  return {
    id: m.id,
    ownerId: m.playerId,
    pokemonId: m.pokemonId,
    name: m.nickname || getPokemonName(m.pokemonId),
    level: m.level,
    force: m.statForce,
    agility: m.statAgility,
    instinct: m.statInstinct,
    vitality: m.statVitality,
    charisma: m.statCharisma,
    hp: Math.max(10, Math.round(55 + m.level * 6 + m.statVitality * 4)),
    combatRole,
    slot,
  };
}

// ── Apply modifier ─────────────────────────────────────────────────────────

export function applyModifier(team: LeagueMascot[], mod: WeeklyModifier | null): LeagueMascot[] {
  if (!mod || mod.effectType === "CLEAN_FIGHT") return team;
  return team.map(m => {
    const types = getPokemonElement(m.pokemonId).split("/");
    const copy = { ...m };

    const statMap: Record<string, keyof LeagueMascot> = {
      force: "force", agility: "agility", instinct: "instinct",
      vitality: "vitality", charisma: "charisma",
    };

    if (mod.effectType === "STAT_BOOST" && mod.affectedStats) {
      for (const s of mod.affectedStats) {
        const key = statMap[s];
        if (key && typeof copy[key] === "number" && (copy[key] as number) >= 30) {
          (copy as unknown as Record<string, number>)[key as string] = Math.round((copy[key] as number) * (1 + mod.bonusPct / 100));
        }
      }
    }

    if (mod.effectType === "TYPE_BOOST" && mod.affectedTypes && mod.affectedStats) {
      const match = mod.affectedTypes.some(t => types.includes(t));
      if (match) {
        for (const s of mod.affectedStats) {
          const key = statMap[s];
          if (key && typeof copy[key] === "number") {
            (copy as unknown as Record<string, number>)[key as string] = Math.round((copy[key] as number) * (1 + mod.bonusPct / 100));
          }
        }
      }
    }

    if (mod.effectType === "LEVEL_BOOST" && m.level <= 20) {
      copy.force = Math.round(m.force * (1 + mod.bonusPct / 100));
      copy.agility = Math.round(m.agility * (1 + mod.bonusPct / 100));
      copy.instinct = Math.round(m.instinct * (1 + mod.bonusPct / 100));
      copy.vitality = Math.round(m.vitality * (1 + mod.bonusPct / 100));
      copy.charisma = Math.round(m.charisma * (1 + mod.bonusPct / 100));
    }

    copy.hp = Math.max(10, Math.round(55 + copy.level * 6 + copy.vitality * 4));
    return copy;
  });
}

// ── Apply items ────────────────────────────────────────────────────────────

export function applyItems(
  team: LeagueMascot[],
  opponentTeam: LeagueMascot[],
  selfItems: LeagueItemDef[],
  opponentItems: LeagueItemDef[],
): { team: LeagueMascot[]; opponentTeam: LeagueMascot[] } {
  let t = team.map(m => ({ ...m }));
  let o = opponentTeam.map(m => ({ ...m }));

  for (const item of selfItems) {
    switch (item.effectCode) {
      case "CAPTAIN_BAND": {
        const slot1 = t.find(m => m.slot === 1);
        if (slot1) {
          slot1.force = Math.round(slot1.force * 1.04);
          slot1.agility = Math.round(slot1.agility * 1.04);
          slot1.instinct = Math.round(slot1.instinct * 1.04);
          slot1.vitality = Math.round(slot1.vitality * 1.04);
          slot1.charisma = Math.round(slot1.charisma * 1.04);
          slot1.hp = Math.max(10, Math.round(55 + slot1.level * 6 + slot1.vitality * 4));
        }
        break;
      }
      case "FORMATION_WHISTLE":
        for (const m of t) m.agility = Math.round(m.agility * 1.05);
        break;
      case "BENCH_SHIELD":
        for (const m of t.filter(x => x.slot >= 5)) m.vitality = Math.round(m.vitality * 1.06);
        break;
      case "CHEER_FLAG":
        for (const m of t.filter(x => x.charisma >= Math.max(x.force, x.agility, x.instinct, x.vitality)))
          m.charisma = Math.round(m.charisma * 1.05);
        break;
      case "ANALYSIS_LANTERN":
        for (const m of t.filter(x => ["OPPORTUNIST", "SCOUT", "SABOTEUR"].includes(x.combatRole)))
          m.instinct = Math.round(m.instinct * 1.05);
        break;
      case "ROUND_BOOTS":
        for (const m of t.filter(x => x.agility >= 25)) {
          m.agility = Math.round(m.agility * 1.05);
        }
        break;
      case "LOCKER_TONIC":
        for (const m of t) m.hp = Math.round(m.hp * 1.05);
        break;
      case "ENGUICA_STRATEGY":
        // Handled at modifier level — reduces penalty impact by 20%
        // (applied in applyModifier if penalty flag is set; here we mark the team)
        break;
    }
  }

  for (const item of opponentItems) {
    switch (item.effectCode) {
      case "CONFUSION_SPRAY":
        for (const m of o) m.agility = Math.round(m.agility * 0.95);
        break;
      case "FIELD_SAND":
        for (const m of o) m.agility = Math.round(m.agility * 0.95);
        break;
      case "ANNOYING_WHISTLE":
        for (const m of o.filter(x => ["ENCOURAGER", "HEALER", "PROVOKER"].includes(x.combatRole)))
          m.charisma = Math.round(m.charisma * 0.95);
        break;
      case "EMBARRASSING_TAPE": {
        const target = pick(o);
        if (target) target.agility = Math.round(target.agility * 0.94);
        break;
      }
      case "PROVOCATION_TICKET": {
        const strongest = [...o].sort((a, b) => b.force - a.force)[0];
        if (strongest) {
          strongest.force = Math.round(strongest.force * 1.04);
          strongest.vitality = Math.round(strongest.vitality * 0.94);
          strongest.hp = Math.max(10, Math.round(55 + strongest.level * 6 + strongest.vitality * 4));
        }
        break;
      }
      case "WRONG_SIGN": {
        const slot1 = o.find(m => m.slot === 1);
        if (slot1) slot1.instinct = Math.round(slot1.instinct * 0.92);
        break;
      }
      case "EVIL_EYE":
        for (const m of o) m.instinct = Math.round(m.instinct * 0.95);
        break;
      case "CROWD_NOISE":
        for (const m of o) {
          m.agility = Math.round(m.agility * 0.96);
          m.instinct = Math.round(m.instinct * 0.96);
        }
        break;
    }
  }

  return { team: t, opponentTeam: o };
}

// ── Main combat simulation ─────────────────────────────────────────────────

export function runLeagueCombat(
  teamA: LeagueMascot[],
  teamB: LeagueMascot[],
  modifier: WeeklyModifier | null = null,
  itemsA: LeagueItemDef[] = [],
  itemsB: LeagueItemDef[] = [],
): LeagueBattleResult {
  let a = applyModifier(teamA, modifier);
  let b = applyModifier(teamB, modifier);

  const appliedA = applyItems(a, b, itemsA, itemsB);
  a = appliedA.team;
  b = appliedA.opponentTeam;
  const appliedB = applyItems(b, a, itemsB, itemsA);
  b = appliedB.team;

  const hp = new Map<string, number>();
  for (const m of [...a, ...b]) hp.set(m.id, m.hp);

  const log: ArenaTurnLog[] = [];
  const debuffs = new Map<string, Partial<Record<"force" | "agility" | "instinct" | "vitality", number>>>();
  const healCount = new Map<string, number>();
  const survivorUsed = new Set<string>();
  const duelistLock = new Map<string, string>();
  let round = 1;
  let actionNum = 1;
  let totalDmgA = 0;
  let totalDmgB = 0;

  while (alive(a, hp).length > 0 && alive(b, hp).length > 0 && round <= 150) {
    const aAlive = alive(a, hp);
    const bAlive = alive(b, hp);
    const all = [
      ...aAlive.map(m => ({ mascot: m, side: "A" as const })),
      ...bAlive.map(m => ({ mascot: m, side: "B" as const })),
    ];
    all.sort((x, y) => y.mascot.agility - x.mascot.agility + rand(-3, 3));

    for (const entry of all) {
      if ((hp.get(entry.mascot.id) ?? 0) <= 0) continue;
      const opponents = entry.side === "A" ? alive(b, hp) : alive(a, hp);
      const allies = entry.side === "A" ? a : b;
      if (opponents.length === 0) break;

      const actor = entry.mascot;

      // HEALER action
      if (actor.combatRole === "HEALER") {
        const count = healCount.get(actor.id) ?? 0;
        if (count < 2) {
          const wounded = allies.filter(m => m.id !== actor.id && (hp.get(m.id) ?? 0) > 0 && (hp.get(m.id) ?? 0) < m.hp);
          if (wounded.length > 0) {
            wounded.sort((x, y) => (hp.get(x.id) ?? 0) - (hp.get(y.id) ?? 0));
            const target = wounded[0];
            const heal = Math.max(5, Math.round(actor.charisma * 0.3 + actor.vitality * 0.2));
            hp.set(target.id, Math.min(target.hp, (hp.get(target.id) ?? 0) + heal));
            healCount.set(actor.id, count + 1);
            log.push({
              turn: actionNum, actorId: actor.id, actorName: actor.name, actorOwnerId: actor.ownerId, actorPokemonId: actor.pokemonId,
              targetId: target.id, targetName: target.name, targetOwnerId: target.ownerId, targetPokemonId: target.pokemonId,
              action: "DEFEND", damage: 0,
              attackerType: getPokemonElement(actor.pokemonId), defenderType: getPokemonElement(target.pokemonId),
              multiplier: 1, advantageApplied: false,
              actorRole: getCombatRoleLabel(actor.combatRole), targetRole: getCombatRoleLabel(target.combatRole),
              effect: `Cuidador ${actor.name} curou ${target.name} em ${heal} HP.`,
            });
            actionNum++;
            continue;
          }
        }
      }

      // Target selection
      let target: LeagueMascot;
      if (actor.combatRole === "DUELIST" && duelistLock.has(actor.id)) {
        const locked = opponents.find(m => m.id === duelistLock.get(actor.id));
        target = locked ?? selectTarget(actor, opponents, hp);
      } else {
        target = selectTarget(actor, opponents, hp);
      }
      if (actor.combatRole === "DUELIST") duelistLock.set(actor.id, target.id);

      // PROVOKER redirect
      const provokers = opponents.filter(m => m.combatRole === "PROVOKER" && m.id !== target.id && (hp.get(m.id) ?? 0) > 0);
      let provoked = false;
      if (provokers.length > 0) {
        const p = provokers[0];
        const chance = Math.min(0.55, 0.2 + p.charisma / 300 + p.instinct / 400);
        if (Math.random() < chance) { target = p; provoked = true; }
      }

      const attackerType = getPokemonElement(actor.pokemonId);
      const defenderType = getPokemonElement(target.pokemonId);
      const multiplier = getTypeAdvantageMultiplier(getPokemonTypes(actor.pokemonId), getPokemonTypes(target.pokemonId));

      const force = getStat(actor, debuffs, "force");
      const instinct = getStat(actor, debuffs, "instinct");
      const vitality = getStat(target, debuffs, "vitality");

      const encourage = aliveEncourageBonus(allies, hp, opponents);
      const scoutBonus = aliveScoutBonus(allies, hp);
      const duelistMult = actor.combatRole === "DUELIST" && duelistLock.get(actor.id) === target.id ? 1.12 : 1;
      const survivorDmg = actor.combatRole === "SURVIVOR" && ((hp.get(actor.id) ?? 0) / actor.hp) < 0.3 ? 1.15 : 1;
      const survivorDef = target.combatRole === "SURVIVOR" && ((hp.get(target.id) ?? 0) / target.hp) < 0.3 ? 0.75 : 1;

      const roleMult = roleDamageMult(actor, target);
      const raw = (force * 1.8 + actor.level * 2 + instinct * 0.7 + rand(0, 12))
        * (1 + encourage + scoutBonus) * roleMult * duelistMult * survivorDmg;
      const mitigation = vitality * 0.8 + target.level;
      let damage = Math.max(1, Math.round((raw * multiplier - mitigation) * survivorDef));
      if (provoked) damage = Math.round(damage * 0.92);

      // GUARDIAN intercept
      const guardians = (entry.side === "A" ? b : a).filter(m => m.combatRole === "GUARDIAN" && m.id !== target.id && (hp.get(m.id) ?? 0) > 0);
      let guardianEffect: string | null = null;
      if (guardians.length > 0) {
        const g = guardians[0];
        const absorbPct = Math.min(0.40, 0.15 + (g.vitality + g.charisma) / 600);
        const absorbed = Math.round(damage * absorbPct);
        damage -= absorbed;
        hp.set(g.id, Math.max(0, (hp.get(g.id) ?? 0) - absorbed));
        guardianEffect = `Guardião ${g.name} absorveu ${absorbed} de dano.`;
      }

      // SURVIVOR last stand
      let survivorEffect: string | null = null;
      if (target.combatRole === "SURVIVOR" && !survivorUsed.has(target.id)) {
        const cur = hp.get(target.id) ?? 0;
        if (cur - damage <= 0) {
          damage = cur - 1;
          survivorUsed.add(target.id);
          survivorEffect = `Sobrevivente ${target.name} resistiu ao golpe fatal!`;
        }
      }

      const newHp = Math.max(0, (hp.get(target.id) ?? 0) - damage);
      hp.set(target.id, newHp);
      if (entry.side === "A") totalDmgA += damage; else totalDmgB += damage;

      // Opportunist debuff
      let debuffEffect: string | null = null;
      if (actor.combatRole === "OPPORTUNIST") {
        const chance = Math.min(0.62, 0.22 + actor.instinct / 220);
        if (Math.random() < chance) {
          const amount = Math.min(0.25, 0.08 + actor.instinct / 500);
          const stats: Array<"force" | "agility" | "instinct" | "vitality"> = ["force", "agility", "instinct", "vitality"];
          const stat = stats[rand(0, 3)];
          const cur = debuffs.get(target.id) ?? {};
          debuffs.set(target.id, { ...cur, [stat]: Math.max(cur[stat] ?? 0, amount) });
          debuffEffect = `Oportunista reduziu ${stat} de ${target.name} em ${Math.round(amount * 100)}%.`;
        }
      }

      const effects = [
        encourage > 0 ? `Encorajador: +${Math.round(encourage * 100)}%.` : null,
        scoutBonus > 0 ? `Batedor: +${Math.round(scoutBonus * 100)}%.` : null,
        debuffEffect, guardianEffect, survivorEffect,
        provoked ? `Provocador desviou o ataque!` : null,
      ].filter(Boolean).join(" ") || undefined;

      log.push({
        turn: actionNum, actorId: actor.id, actorName: actor.name, actorOwnerId: actor.ownerId, actorPokemonId: actor.pokemonId,
        targetId: target.id, targetName: target.name, targetOwnerId: target.ownerId, targetPokemonId: target.pokemonId,
        action: "ATTACK", damage, attackerType, defenderType, multiplier, advantageApplied: multiplier > 1,
        actorRole: getCombatRoleLabel(actor.combatRole), targetRole: getCombatRoleLabel(target.combatRole),
        effect: effects,
      });
      actionNum++;
    }
    round++;
  }

  const aSurvivors = alive(a, hp).length;
  const bSurvivors = alive(b, hp).length;
  const aHpTotal = alive(a, hp).reduce((s, m) => s + (hp.get(m.id) ?? 0), 0);
  const bHpTotal = alive(b, hp).reduce((s, m) => s + (hp.get(m.id) ?? 0), 0);
  const winner = aHpTotal === bHpTotal ? "DRAW" as const : aHpTotal > bHpTotal ? "A" as const : "B" as const;

  return {
    winner,
    teamASurvivors: aSurvivors,
    teamBSurvivors: bSurvivors,
    teamADamageDealt: totalDmgA,
    teamBDamageDealt: totalDmgB,
    teamADamageTaken: totalDmgB,
    teamBDamageTaken: totalDmgA,
    log,
    rounds: round - 1,
  };
}

// ── Internal combat helpers ────────────────────────────────────────────────

function getStat(m: LeagueMascot, debuffs: Map<string, Partial<Record<string, number>>>, stat: string) {
  const pct = debuffs.get(m.id)?.[stat] ?? 0;
  return Math.max(1, Math.round((m as unknown as Record<string, number>)[stat] * (1 - pct)));
}

function selectTarget(actor: LeagueMascot, opponents: LeagueMascot[], hp: Map<string, number>) {
  const lowestHp = [...opponents].sort((a, b) => (hp.get(a.id) ?? 0) - (hp.get(b.id) ?? 0))[0];
  const defenders = opponents.filter(m => m.combatRole === "DEFENDER");

  if (actor.combatRole === "FLANK" || actor.combatRole === "SCOUT") {
    const slip = Math.min(0.82, 0.35 + actor.agility / 150);
    if (Math.random() < slip) return lowestHp ?? pick(opponents);
  }
  if (defenders.length > 0) {
    const pull = actor.combatRole === "ATTACKER" ? 0.62 : 0.78;
    if (Math.random() < pull) return [...defenders].sort((a, b) => b.vitality - a.vitality)[0];
  }
  if (actor.combatRole === "ATTACKER" || actor.combatRole === "DUELIST" || actor.combatRole === "PROVOKER")
    return [...opponents].sort((a, b) => b.force - a.force)[0] ?? pick(opponents);
  if (actor.combatRole === "OPPORTUNIST")
    return [...opponents].sort((a, b) => a.instinct - b.instinct)[0] ?? pick(opponents);
  if (actor.combatRole === "SABOTEUR") {
    const supp = opponents.filter(m => ["ENCOURAGER", "HEALER"].includes(m.combatRole));
    if (supp.length > 0) return pick(supp);
  }
  return pick(opponents);
}

function roleDamageMult(actor: LeagueMascot, target: LeagueMascot) {
  let mult = 1;
  if (actor.combatRole === "ATTACKER") mult *= 1.08 + Math.min(0.18, actor.force / 420);
  if (actor.combatRole === "ATTACKER" && target.combatRole === "DEFENDER") mult *= 1.15;
  if (actor.combatRole === "FLANK") mult *= 1.04 + Math.min(0.14, actor.agility / 500);
  if (actor.combatRole === "FLANK" && ["ENCOURAGER", "OPPORTUNIST", "HEALER"].includes(target.combatRole)) mult *= 1.12;
  if (actor.combatRole === "OPPORTUNIST" && actor.instinct > target.instinct) mult *= 1.1;
  if (actor.combatRole === "DUELIST") mult *= 1.06 + Math.min(0.12, (actor.force + actor.instinct) / 800);
  if (actor.combatRole === "SPECIALIST") {
    const max = Math.max(actor.force, actor.agility, actor.instinct, actor.vitality, actor.charisma);
    mult *= 1.06 + Math.min(0.14, max / 500);
  }
  if (actor.combatRole === "PROVOKER") mult *= 0.92;
  if (actor.combatRole === "SCOUT") mult *= 0.95;
  if (actor.combatRole === "GUARDIAN") mult *= 0.90;
  if (actor.combatRole === "HEALER") mult *= 0.80;
  if (target.combatRole === "DEFENDER") mult *= 1 - Math.min(0.35, 0.08 + target.vitality / 240);
  if (target.combatRole === "GUARDIAN") mult *= 1 - Math.min(0.20, 0.05 + target.vitality / 300);
  if (target.combatRole === "SURVIVOR") mult *= 1 - Math.min(0.15, target.vitality / 400);
  return mult;
}

function aliveEncourageBonus(team: LeagueMascot[], hp: Map<string, number>, opponents: LeagueMascot[]) {
  const enc = team.filter(m => m.combatRole === "ENCOURAGER" && (hp.get(m.id) ?? 0) > 0);
  if (enc.length === 0) return 0;
  const charisma = enc.reduce((s, m) => s + m.charisma, 0);
  const saboteurs = opponents.filter(m => m.combatRole === "SABOTEUR" && (hp.get(m.id) ?? 0) > 0);
  const bestSaboteur = saboteurs.sort((a, b) => (b.instinct + b.agility) - (a.instinct + a.agility))[0];
  const suppression = bestSaboteur ? Math.min(0.40, 0.15 + (bestSaboteur.instinct + bestSaboteur.agility) / 800) : 0;
  return Math.min(0.18, 0.04 + charisma / 650) * (1 - suppression);
}

function aliveScoutBonus(team: LeagueMascot[], hp: Map<string, number>) {
  const scouts = team.filter(m => m.combatRole === "SCOUT" && (hp.get(m.id) ?? 0) > 0);
  if (scouts.length === 0) return 0;
  const best = scouts[0];
  return Math.min(0.08, best.agility / 400 + best.instinct / 500);
}
