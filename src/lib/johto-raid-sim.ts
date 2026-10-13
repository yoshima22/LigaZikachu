// Raid dos Líderes de Johto: dados e simulação pura (sem banco), reaproveitando as regras de postura da raid da Ordem.
import {
  getAttackerDamageBonus, getCombatActionsPerRound, getDuelistDamageBonus, getEncouragerBonus, getFlankDamageBonus,
  getHealerHealAmount, getScoutBonus, getSpecialistDamageBonus, normalizeCombatRole, scaleCombatRoleEffect, type CombatRole,
} from "@/lib/combat-roles";
import { getPokemonName, getPokemonTypes, getTypeAdvantageMultiplier } from "@/lib/mascot-data";

export const JOHTO_EVENT_SLUG = "raid-lideres-johto";
export const JOHTO_VISIBLE_KEY = "johto_raid_visible";
export const JOHTO_LEADER_HP = 100_000_000;
export const JOHTO_DEFAULT_COOLDOWN_MIN = 30;

export type JohtoLeaderDef = { key: string; name: string; city: string; badge: string; type: string; pokemonId: number; quote: string };

/** Ordem de combate: Violet → Azalea → Goldenrod → Ecruteak → Cianwood → Olivine → Mahogany → Blackthorn. */
export const JOHTO_LEADERS: JohtoLeaderDef[] = [
  { key: "falkner", name: "Falkner", city: "Violet City", badge: "Insígnia Zephyr", type: "flying", pokemonId: 18, quote: "Meus pássaros dominam o céu!" },
  { key: "bugsy", name: "Bugsy", city: "Azalea Town", badge: "Insígnia Hive", type: "bug", pokemonId: 123, quote: "Minha pesquisa sobre insetos vai te surpreender!" },
  { key: "whitney", name: "Whitney", city: "Goldenrod City", badge: "Insígnia Plain", type: "normal", pokemonId: 241, quote: "Não vou perder! Buááá!" },
  { key: "morty", name: "Morty", city: "Ecruteak City", badge: "Insígnia Fog", type: "ghost", pokemonId: 94, quote: "Enxergo o que ninguém mais vê." },
  { key: "chuck", name: "Chuck", city: "Cianwood City", badge: "Insígnia Storm", type: "fighting", pokemonId: 62, quote: "Treino debaixo de cachoeiras!" },
  { key: "jasmine", name: "Jasmine", city: "Olivine City", badge: "Insígnia Mineral", type: "steel", pokemonId: 208, quote: "...Eu... vou dar o meu melhor." },
  { key: "pryce", name: "Pryce", city: "Mahogany Town", badge: "Insígnia Glacier", type: "ice", pokemonId: 473, quote: "Vi mais invernos do que você anos." },
  { key: "clair", name: "Clair", city: "Blackthorn City", badge: "Insígnia Rising", type: "dragon", pokemonId: 230, quote: "Eu sou a maior treinadora de dragões!" },
];

export function getJohtoLeader(key: string) {
  return JOHTO_LEADERS.find((leader) => leader.key === key) ?? null;
}

export type JohtoRewardConfig = {
  participationZc: number;
  participationEgg: boolean;
  topDamageZc: [number, number, number];
  biggestHitZc: number;
  mostAttacksZc: number;
  mostLeadersZc: number;
  finalBlowZc: number;
  eggOrigin: string;
};

/** Valores padrão; o admin pode sobrescrever em rewardConfigJson. Prêmios exclusivos (itens) entram aqui quando definidos. */
export const DEFAULT_JOHTO_REWARDS: JohtoRewardConfig = {
  participationZc: 2000,
  participationEgg: true,
  topDamageZc: [15000, 10000, 6000],
  biggestHitZc: 5000,
  mostAttacksZc: 5000,
  mostLeadersZc: 3000,
  finalBlowZc: 2500,
  eggOrigin: "Raid dos Líderes de Johto",
};

export function readRewardConfig(value: unknown): JohtoRewardConfig {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<JohtoRewardConfig> : {};
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);
  const top = Array.isArray(raw.topDamageZc) && raw.topDamageZc.length === 3
    ? raw.topDamageZc.map((v, i) => num(v, DEFAULT_JOHTO_REWARDS.topDamageZc[i])) as [number, number, number]
    : DEFAULT_JOHTO_REWARDS.topDamageZc;
  return {
    participationZc: num(raw.participationZc, DEFAULT_JOHTO_REWARDS.participationZc),
    participationEgg: typeof raw.participationEgg === "boolean" ? raw.participationEgg : DEFAULT_JOHTO_REWARDS.participationEgg,
    topDamageZc: top,
    biggestHitZc: num(raw.biggestHitZc, DEFAULT_JOHTO_REWARDS.biggestHitZc),
    mostAttacksZc: num(raw.mostAttacksZc, DEFAULT_JOHTO_REWARDS.mostAttacksZc),
    mostLeadersZc: num(raw.mostLeadersZc, DEFAULT_JOHTO_REWARDS.mostLeadersZc),
    finalBlowZc: num(raw.finalBlowZc, DEFAULT_JOHTO_REWARDS.finalBlowZc),
    eggOrigin: typeof raw.eggOrigin === "string" && raw.eggOrigin.trim() ? raw.eggOrigin.trim().slice(0, 80) : DEFAULT_JOHTO_REWARDS.eggOrigin,
  };
}

// ── Conquistas e prêmios (puro, testável) ────────────────────────────────────

export type RankingRow = {
  playerId: string; totalDamage: number; attackCount: number; highestSingleDamage: number;
  finalBlows: number; leaders: number; lastAttackAt?: Date | string | null;
};
export type JohtoAward = { playerId: string; zc: number; egg: boolean; lines: string[] };

/** Calcula os prêmios de cada jogador que atacou ao menos uma vez. Desempates: dano total, depois quem atacou primeiro. */
export function computeJohtoAwards(rows: RankingRow[], config: JohtoRewardConfig): { awards: JohtoAward[]; badges: Record<string, string[]> } {
  const awards = new Map<string, JohtoAward>();
  const badges: Record<string, string[]> = {};
  const give = (playerId: string, zc: number, line: string, badge?: string) => {
    const award = awards.get(playerId)!;
    award.zc += zc;
    award.lines.push(zc > 0 ? `${line}: +${zc.toLocaleString("pt-BR")} ZC` : line);
    if (badge) (badges[playerId] ??= []).push(badge);
  };
  for (const row of rows) {
    if (row.attackCount <= 0) continue;
    awards.set(row.playerId, { playerId: row.playerId, zc: 0, egg: config.participationEgg, lines: [] });
    give(row.playerId, config.participationZc, "Participação na vitória do servidor");
  }
  const active = rows.filter((row) => row.attackCount > 0);
  const by = (value: (r: RankingRow) => number) => [...active].sort((a, b) => value(b) - value(a) || b.totalDamage - a.totalDamage || a.playerId.localeCompare(b.playerId));
  by((r) => r.totalDamage).slice(0, 3).forEach((row, index) => {
    const medal = ["🥇", "🥈", "🥉"][index];
    give(row.playerId, config.topDamageZc[index], `${medal} ${index + 1}º maior dano total`, `${medal} ${index + 1}º em dano`);
  });
  const hit = by((r) => r.highestSingleDamage)[0];
  if (hit && hit.highestSingleDamage > 0) give(hit.playerId, config.biggestHitZc, "💥 Maior dano em um único ataque", "💥 Maior golpe");
  const attacks = by((r) => r.attackCount)[0];
  if (attacks) give(attacks.playerId, config.mostAttacksZc, "⚔️ Mais ataques", "⚔️ Mais ataques");
  const presence = by((r) => r.leaders)[0];
  if (presence) give(presence.playerId, config.mostLeadersZc, "🧭 Enfrentou mais líderes", "🧭 Presença");
  for (const row of active.filter((r) => r.finalBlows > 0)) {
    give(row.playerId, config.finalBlowZc * row.finalBlows, `🎯 Golpe final em ${row.finalBlows} líder${row.finalBlows > 1 ? "es" : ""}`, `🎯 ${row.finalBlows}x golpe final`);
  }
  return { awards: [...awards.values()], badges };
}

// ── Simulação de batalha ─────────────────────────────────────────────────────

export type JohtoMascotInput = {
  id: string; pokemonId: number; nickname: string | null; level: number;
  statForce: number; statAgility: number; statInstinct: number; statVitality: number; statCharisma: number;
};
export type JohtoLeaderInput = { name: string; pokemonId: number; type: string; position: number; hpRemaining: number; hpMax: number };

export type JohtoBattleOutput = {
  log: Array<Record<string, unknown>>;
  rawDamage: number;
  team: Array<{ id: string; pokemonId: number; name: string; level: number; combatRole: CombatRole; maxHp: number; remainingHp: number; damage: number; defeated: boolean }>;
  defeatedIds: string[];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const ROLE_DAMAGE: Record<CombatRole, number> = {
  ATTACKER: 1.12, FLANK: 1.08, OPPORTUNIST: 1.06, ENCOURAGER: 0.82, GUARDIAN: 0.88, DUELIST: 1.1, SABOTEUR: 1.04,
  HEALER: 0.78, SCOUT: 0.95, PROVOKER: 0.92, SPECIALIST: 1.08, SURVIVOR: 0.98, DEFENDER: 0.9,
};
const ROLE_DEFENSE: Record<CombatRole, number> = {
  DEFENDER: 0.74, GUARDIAN: 0.8, SURVIVOR: 0.82, PROVOKER: 0.9, SCOUT: 0.92, HEALER: 0.94, ENCOURAGER: 0.96,
  FLANK: 0.96, DUELIST: 0.98, SPECIALIST: 0.97, ATTACKER: 1, OPPORTUNIST: 1, SABOTEUR: 1,
};

/**
 * Uma investida contra o líder atual: 6 mascotes, até 80 turnos. Mesma base da raid da Ordem, com o
 * tipo do ginásio: vantagem de tipo dá até +30% de dano ao mascote; o líder acerta mais forte
 * contra os tipos que ele domina. A força do líder cresce a cada ginásio. `rng` é injetável nos testes.
 */
export function simulateJohtoBattle(
  mascots: JohtoMascotInput[],
  roles: Record<string, string>,
  leader: JohtoLeaderInput,
  powerOf: (m: JohtoMascotInput) => number,
  rng: () => number = Math.random,
): JohtoBattleOutput {
  const int = (min: number, max?: number) => (max === undefined ? Math.floor(rng() * min) : min + Math.floor(rng() * (max - min)));
  const leaderTypes = [leader.type];
  const states = mascots.map((mascot) => {
    const power = powerOf(mascot);
    const combatRole = normalizeCombatRole(roles[mascot.id]);
    const hp = Math.max(120, Math.round(mascot.statVitality * 9 + mascot.level * 16 + power * 0.8));
    const types = getPokemonTypes(mascot.pokemonId);
    const offense = clamp(getTypeAdvantageMultiplier(types, leaderTypes), 0.75, 1.3);
    const defense = clamp(getTypeAdvantageMultiplier(leaderTypes, types), 0.85, 1.25);
    return { ...mascot, combatRole, name: mascot.nickname ?? getPokemonName(mascot.pokemonId), power, hp, maxHp: hp, damage: 0, defeated: false, survivorUsed: false, offense, defense };
  });
  const alive = () => states.filter((m) => !m.defeated);
  const aura = () => clamp(
    Math.max(0, ...alive().filter((m) => m.combatRole === "ENCOURAGER").map((m) => getEncouragerBonus(m.statCharisma)))
    + Math.max(0, ...alive().filter((m) => m.combatRole === "SCOUT").map((m) => getScoutBonus(m.statAgility, m.statInstinct))), 0, 0.26);
  const sabotage = Math.max(0, ...states.filter((m) => m.combatRole === "SABOTEUR").map((m) => scaleCombatRoleEffect((m.statInstinct + m.statAgility) / 2, 0.03, 0.12)));
  const hpPct = leader.hpMax > 0 ? clamp(leader.hpRemaining / leader.hpMax, 0, 1) : 1;
  const advantage = 0.1 + (1 - hpPct) * 0.1 + leader.position * 0.02;
  const averagePower = states.reduce((sum, m) => sum + m.power, 0) / Math.max(1, states.length);
  const bossPower = Math.max(180, Math.round(averagePower * (1 + advantage - sabotage)));
  const log: Array<Record<string, unknown>> = [];
  let rawDamage = 0;
  let lastTurn = 0;

  for (let turn = 1; turn <= 80 && states.some((m) => !m.defeated); turn++) {
    lastTurn = turn;
    for (const mascot of alive()) {
      const profile = getCombatActionsPerRound(mascot.statAgility, alive().filter((x) => x.id !== mascot.id).map((x) => x.statAgility));
      for (let action = 0; action < profile.actions; action++) {
        const variance = int(85, 121) / 100;
        const critChance = Math.min(38, 4 + Math.floor(mascot.statInstinct / 8) + (mascot.combatRole === "OPPORTUNIST" ? 10 : 0));
        const crit = int(100) < critChance ? (mascot.combatRole === "DUELIST" ? 1.7 : 1.55) : 1;
        const lowHp = mascot.hp / mascot.maxHp <= 0.3 && mascot.combatRole === "SURVIVOR" ? 1.15 : 1;
        const attribute: Record<CombatRole, number> = {
          ATTACKER: 1 + getAttackerDamageBonus(mascot.statForce),
          FLANK: 1 + getFlankDamageBonus(mascot.statAgility),
          OPPORTUNIST: 1 + scaleCombatRoleEffect(mascot.statInstinct, 0.05, 0.28),
          ENCOURAGER: 1, GUARDIAN: 0.9,
          DUELIST: 1 + getDuelistDamageBonus(mascot.statForce, mascot.statInstinct),
          SABOTEUR: 1 + scaleCombatRoleEffect((mascot.statInstinct + mascot.statAgility) / 2, 0.02, 0.12),
          HEALER: 0.8, SCOUT: 0.95 + getScoutBonus(mascot.statAgility, mascot.statInstinct), PROVOKER: 0.92,
          SPECIALIST: 1 + getSpecialistDamageBonus(Math.max(mascot.statForce, mascot.statAgility, mascot.statInstinct, mascot.statVitality, mascot.statCharisma)),
          SURVIVOR: lowHp, DEFENDER: 0.9,
        };
        const currentAura = aura();
        const damage = Math.max(1, Math.round(mascot.power * variance * crit * ROLE_DAMAGE[mascot.combatRole] * attribute[mascot.combatRole] * mascot.offense * (1 + currentAura)));
        mascot.damage += damage;
        rawDamage += damage;
        log.push({ turn, actor: mascot.name, actorId: mascot.id, actorPokemonId: mascot.pokemonId, actorRole: mascot.combatRole, action: "ATTACK", damage, crit: crit > 1, bossHp: Math.max(0, leader.hpRemaining - rawDamage), teamAura: Math.round(currentAura * 100), typeMultiplier: mascot.offense, extraActionByAgility: action > 0 });
      }
    }
    for (const healer of alive().filter((m) => m.combatRole === "HEALER")) {
      const wounded = alive().filter((m) => m.hp < m.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (wounded && int(100) < clamp(35 + Math.floor((healer.statCharisma + healer.statVitality) / 8), 35, 78)) {
        const heal = getHealerHealAmount({ charisma: healer.statCharisma, vitality: healer.statVitality, level: healer.level });
        wounded.hp = Math.min(wounded.maxHp, wounded.hp + heal);
        log.push({ turn, actor: healer.name, actorId: healer.id, actorPokemonId: healer.pokemonId, actorRole: healer.combatRole, action: "HEAL", target: wounded.name, targetId: wounded.id, amount: heal, targetHp: wounded.hp });
      }
    }
    const living = alive();
    if (living.length === 0) break;
    const tanks = living.filter((m) => m.combatRole === "DEFENDER" || m.combatRole === "PROVOKER");
    const target = tanks.length > 0 && int(100) < 72 ? tanks[int(tanks.length)] : living[int(living.length)];
    const soak = Math.round(target.statVitality * 1.4 + target.statAgility * 0.4);
    const minimumHit = Math.max(20, Math.round(target.maxHp * 0.14));
    const guardian = target.combatRole !== "GUARDIAN"
      ? living.filter((m) => m.combatRole === "GUARDIAN" && m.id !== target.id).sort((a, b) => (b.statVitality + b.statCharisma) - (a.statVitality + a.statCharisma))[0]
      : null;
    const bossDamage = Math.max(minimumHit, Math.round(bossPower * (int(90, 121) / 100) * ROLE_DEFENSE[target.combatRole] * target.defense) - soak);
    const guarded = guardian && int(100) < clamp(20 + Math.floor((guardian.statVitality + guardian.statCharisma) / 8), 20, 58) ? Math.round(bossDamage * 0.62) : bossDamage;
    const intercepted = bossDamage - guarded;
    if (guardian && intercepted > 0) {
      guardian.hp = Math.max(0, guardian.hp - intercepted);
      log.push({ turn, actor: guardian.name, actorId: guardian.id, actorPokemonId: guardian.pokemonId, actorRole: guardian.combatRole, action: "GUARD", target: target.name, damage: intercepted, targetHp: guardian.hp });
      if (guardian.hp <= 0) { guardian.defeated = true; log.push({ turn, actor: guardian.name, actorId: guardian.id, action: "KO" }); }
    }
    target.hp = Math.max(0, target.hp - guarded);
    if (target.hp <= 0 && target.combatRole === "SURVIVOR" && !target.survivorUsed) {
      target.survivorUsed = true;
      target.hp = 1;
      log.push({ turn, actor: target.name, actorId: target.id, actorPokemonId: target.pokemonId, actorRole: target.combatRole, action: "SURVIVE", targetHp: 1 });
    }
    log.push({ turn, actor: leader.name, action: "BOSS_ATTACK", target: target.name, targetId: target.id, targetPokemonId: target.pokemonId, targetRole: target.combatRole, damage: guarded, targetHp: target.hp });
    if (target.hp <= 0) { target.defeated = true; log.push({ turn, actor: target.name, actorId: target.id, action: "KO" }); }
  }
  if (states.some((m) => !m.defeated)) {
    const turn = lastTurn + 1;
    for (const target of states.filter((m) => !m.defeated)) {
      const damage = target.hp;
      target.hp = 0;
      target.defeated = true;
      log.push({ turn, actor: leader.name, action: "BOSS_ATTACK", target: target.name, targetId: target.id, targetPokemonId: target.pokemonId, targetRole: target.combatRole, damage, targetHp: 0 });
      log.push({ turn, actor: target.name, actorId: target.id, action: "KO" });
    }
  }
  return {
    log,
    rawDamage,
    team: states.map((m) => ({ id: m.id, pokemonId: m.pokemonId, name: m.name, level: m.level, combatRole: m.combatRole, maxHp: m.maxHp, remainingHp: m.hp, damage: m.damage, defeated: m.defeated })),
    defeatedIds: states.filter((m) => m.defeated).map((m) => m.id),
  };
}
