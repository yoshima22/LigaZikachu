// Raid dos Líderes de Johto: dados, recompensas e simulação (sem banco). O combate usa o motor oficial da Liga (runLeagueCombat).
import { getCombatRoleLabel, normalizeCombatRole, type CombatRole } from "@/lib/combat-roles";
import { runLeagueCombat, type LeagueBattleResult, type LeagueMascot } from "@/lib/league-combat";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";

export const JOHTO_EVENT_SLUG = "raid-lideres-johto";
export const JOHTO_VISIBLE_KEY = "johto_raid_visible";
export const JOHTO_LEADER_HP = 100_000_000;
export const JOHTO_MASCOTS_PER_LEADER = 6;
export const JOHTO_DEFAULT_COOLDOWN_MIN = 30;
export const JOHTO_DEFAULT_DAMAGE_SCALE = 10;
export const JOHTO_DEFAULT_LEADER_DAYS = 5;
export const JOHTO_REPLAY_HISTORY = 20;

export type JohtoRosterEntry = { pokemonId: number; role: CombatRole };
export type JohtoLeaderDef = {
  key: string; name: string; city: string; badge: string; type: string; quote: string; image: string; roster: JohtoRosterEntry[];
};

const roster = (entries: Array<[number, CombatRole]>): JohtoRosterEntry[] => entries.map(([pokemonId, role]) => ({ pokemonId, role }));

/** Ordem de combate: Violet → Azalea → Goldenrod → Ecruteak → Cianwood → Olivine → Mahogany → Blackthorn. */
export const JOHTO_LEADERS: JohtoLeaderDef[] = [
  { key: "falkner", name: "Falkner", city: "Violet City", badge: "Insígnia Zephyr", type: "flying", quote: "Meus pássaros dominam o céu!", image: "/johto-leaders/falkner.png",
    roster: roster([[18, "FLANK"], [22, "ATTACKER"], [85, "OPPORTUNIST"], [164, "HEALER"], [227, "DEFENDER"], [430, "DUELIST"]]) },
  { key: "bugsy", name: "Bugsy", city: "Azalea Town", badge: "Insígnia Hive", type: "bug", quote: "Minha pesquisa sobre insetos vai te surpreender!", image: "/johto-leaders/bugsy.png",
    roster: roster([[123, "FLANK"], [212, "DEFENDER"], [214, "ATTACKER"], [168, "OPPORTUNIST"], [12, "HEALER"], [469, "DUELIST"]]) },
  { key: "whitney", name: "Whitney", city: "Goldenrod City", badge: "Insígnia Plain", type: "normal", quote: "Não vou perder! Buááá!", image: "/johto-leaders/whitney.png",
    roster: roster([[241, "ATTACKER"], [36, "ENCOURAGER"], [143, "DEFENDER"], [242, "HEALER"], [217, "DUELIST"], [115, "GUARDIAN"]]) },
  { key: "morty", name: "Morty", city: "Ecruteak City", badge: "Insígnia Fog", type: "ghost", quote: "Enxergo o que ninguém mais vê.", image: "/johto-leaders/morty.png",
    roster: roster([[94, "OPPORTUNIST"], [429, "HEALER"], [477, "DEFENDER"], [354, "SABOTEUR"], [426, "GUARDIAN"], [302, "FLANK"]]) },
  { key: "chuck", name: "Chuck", city: "Cianwood City", badge: "Insígnia Storm", type: "fighting", quote: "Treino debaixo de cachoeiras!", image: "/johto-leaders/chuck.png",
    roster: roster([[62, "DEFENDER"], [68, "ATTACKER"], [106, "FLANK"], [107, "DUELIST"], [297, "GUARDIAN"], [448, "OPPORTUNIST"]]) },
  { key: "jasmine", name: "Jasmine", city: "Olivine City", badge: "Insígnia Mineral", type: "steel", quote: "...Eu... vou dar o meu melhor.", image: "/johto-leaders/jasmine.png",
    roster: roster([[208, "DEFENDER"], [462, "OPPORTUNIST"], [437, "HEALER"], [306, "ATTACKER"], [376, "DUELIST"], [205, "GUARDIAN"]]) },
  { key: "pryce", name: "Pryce", city: "Mahogany Town", badge: "Insígnia Glacier", type: "ice", quote: "Vi mais invernos do que você anos.", image: "/johto-leaders/pryce.png",
    roster: roster([[473, "ATTACKER"], [87, "HEALER"], [362, "DEFENDER"], [461, "FLANK"], [131, "GUARDIAN"], [91, "SABOTEUR"]]) },
  { key: "clair", name: "Clair", city: "Blackthorn City", badge: "Insígnia Rising", type: "dragon", quote: "Eu sou a maior treinadora de dragões!", image: "/johto-leaders/clair.png",
    roster: roster([[230, "OPPORTUNIST"], [149, "ATTACKER"], [373, "DUELIST"], [445, "FLANK"], [334, "HEALER"], [130, "DEFENDER"]]) },
];

export function getJohtoLeader(key: string) {
  return JOHTO_LEADERS.find((leader) => leader.key === key) ?? null;
}

// ── Recompensas por líder ────────────────────────────────────────────────────

export type JohtoRewardConfig = {
  participantZc: number;
  participantLevel: number;
  top: [{ zc: number; level: number }, { zc: number; level: number }, { zc: number; level: number }];
  finalBlowEggBonusPct: number;
  finalBlowEggType: "SPECIAL" | "RARE" | "EVENT";
  eggOrigin: string;
};

export const DEFAULT_JOHTO_REWARDS: JohtoRewardConfig = {
  participantZc: 2500,
  participantLevel: 55,
  top: [{ zc: 10000, level: 85 }, { zc: 8000, level: 75 }, { zc: 6500, level: 65 }],
  finalBlowEggBonusPct: 15,
  finalBlowEggType: "SPECIAL",
  eggOrigin: "Raid dos Líderes de Johto",
};

export function readRewardConfig(value: unknown): JohtoRewardConfig {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const num = (v: unknown, fallback: number, max = 1_000_000) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : fallback);
  const top = Array.isArray(raw.top) && raw.top.length === 3
    ? raw.top.map((entry, i) => {
      const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
      return { zc: num(e.zc, DEFAULT_JOHTO_REWARDS.top[i].zc), level: Math.max(1, num(e.level, DEFAULT_JOHTO_REWARDS.top[i].level, 100)) };
    }) as JohtoRewardConfig["top"]
    : DEFAULT_JOHTO_REWARDS.top;
  const eggType = raw.finalBlowEggType === "RARE" || raw.finalBlowEggType === "EVENT" || raw.finalBlowEggType === "SPECIAL" ? raw.finalBlowEggType : DEFAULT_JOHTO_REWARDS.finalBlowEggType;
  return {
    participantZc: num(raw.participantZc, DEFAULT_JOHTO_REWARDS.participantZc),
    participantLevel: Math.max(1, num(raw.participantLevel, DEFAULT_JOHTO_REWARDS.participantLevel, 100)),
    top, finalBlowEggBonusPct: num(raw.finalBlowEggBonusPct, DEFAULT_JOHTO_REWARDS.finalBlowEggBonusPct, 100), finalBlowEggType: eggType,
    eggOrigin: typeof raw.eggOrigin === "string" && raw.eggOrigin.trim() ? raw.eggOrigin.trim().slice(0, 80) : DEFAULT_JOHTO_REWARDS.eggOrigin,
  };
}

export type LeaderStatRow = { playerId: string; damage: number; attackCount: number };
export type RewardTier = "TOP1" | "TOP2" | "TOP3" | "PARTICIPANT" | "FINAL_BLOW";
export type RewardRow = { playerId: string; tier: RewardTier; zc: number; mascotLevel: number; egg: boolean };

/**
 * Prêmios de UM líder derrotado. Top 3 em dano levam o valor do pódio (e não o de participante).
 * Quem deu o golpe final ganha o bônus de participante + ovo especial: se já era só participante, o ovo vem
 * no mesmo prêmio; se estava no pódio, recebe também uma linha FINAL_BLOW com o bônus de participante.
 */
export function computeLeaderRewards(stats: LeaderStatRow[], finalBlowPlayerId: string | null, config: JohtoRewardConfig): RewardRow[] {
  const active = stats.filter((s) => s.attackCount > 0)
    .sort((a, b) => b.damage - a.damage || b.attackCount - a.attackCount || a.playerId.localeCompare(b.playerId));
  const rows: RewardRow[] = [];
  active.forEach((s, index) => {
    if (index < 3) rows.push({ playerId: s.playerId, tier: (["TOP1", "TOP2", "TOP3"] as const)[index], zc: config.top[index].zc, mascotLevel: config.top[index].level, egg: false });
    else rows.push({ playerId: s.playerId, tier: "PARTICIPANT", zc: config.participantZc, mascotLevel: config.participantLevel, egg: false });
  });
  if (finalBlowPlayerId && active.some((s) => s.playerId === finalBlowPlayerId)) {
    const own = rows.find((r) => r.playerId === finalBlowPlayerId)!;
    if (own.tier === "PARTICIPANT") own.egg = true;
    else rows.push({ playerId: finalBlowPlayerId, tier: "FINAL_BLOW", zc: config.participantZc, mascotLevel: config.participantLevel, egg: true });
  }
  return rows;
}

// ── Combate ──────────────────────────────────────────────────────────────────

const ROLE_MAIN_STATS: Record<CombatRole, Array<"force" | "agility" | "instinct" | "vitality" | "charisma">> = {
  ATTACKER: ["force"], FLANK: ["agility"], DEFENDER: ["vitality"], HEALER: ["charisma"], GUARDIAN: ["vitality", "charisma"],
  OPPORTUNIST: ["instinct"], DUELIST: ["force", "instinct"], ENCOURAGER: ["charisma"], SCOUT: ["agility", "instinct"],
  SABOTEUR: ["instinct", "agility"], PROVOKER: ["charisma", "instinct"], SPECIALIST: ["force"], SURVIVOR: ["vitality"],
};

const leaderHp = (level: number, vitality: number) => Math.max(10, Math.round(55 + level * 6 + vitality * 4));

/**
 * Time do líder para UMA luta: só os mascotes que ainda têm vida global. Os atributos vêm da média do time
 * atacante (luta equilibrada), com o atributo principal da postura em +15%, os demais em −5% e +2% de força
 * por ginásio avançado (`position`).
 */
export function buildLeaderTeam(def: JohtoLeaderDef, aliveSlots: number[], playerTeam: LeagueMascot[], position: number): LeagueMascot[] {
  const n = Math.max(1, playerTeam.length);
  const avg = (pick: (m: LeagueMascot) => number) => playerTeam.reduce((sum, m) => sum + pick(m), 0) / n;
  const base = { force: avg((m) => m.force), agility: avg((m) => m.agility), instinct: avg((m) => m.instinct), vitality: avg((m) => m.vitality), charisma: avg((m) => m.charisma) };
  const level = Math.max(1, Math.round(avg((m) => m.level)));
  const ramp = 1 + position * 0.02;
  return aliveSlots.map((slot) => {
    const entry = def.roster[slot];
    const mains = ROLE_MAIN_STATS[entry.role];
    const stat = (key: keyof typeof base) => Math.max(1, Math.round(base[key] * (mains.includes(key) ? 1.15 : 0.95) * ramp));
    const vitality = stat("vitality");
    return {
      id: `johto:${def.key}:${slot}`, ownerId: `johto:${def.key}`, pokemonId: entry.pokemonId, types: getPokemonTypes(entry.pokemonId),
      name: getPokemonName(entry.pokemonId), level, force: stat("force"), agility: stat("agility"), instinct: stat("instinct"), vitality,
      charisma: stat("charisma"), hp: leaderHp(level, vitality), combatRole: normalizeCombatRole(entry.role), slot,
    };
  });
}

export type BattleAnalysis = {
  hpEnd: Map<string, number>;
  /** Dano efetivo recebido (sem overkill), inclusive o absorvido por Guardiões. */
  damageTaken: Map<string, number>;
  kos: Array<{ targetId: string; killerId: string }>;
};

/** Reconstrói HP final, dano efetivo e KOs a partir do log (a Liga não devolve o HP). Considera curas e Guardião. */
export function analyzeLeagueBattle(lineups: LeagueMascot[], log: LeagueBattleResult["log"]): BattleAnalysis {
  const hp = new Map<string, number>();
  const max = new Map<string, number>();
  const guardians = new Map<string, string>();
  for (const m of lineups) {
    hp.set(m.id, m.hp); max.set(m.id, m.hp);
    if (m.combatRole === "GUARDIAN") guardians.set(`${m.ownerId}|${m.name}`, m.id);
  }
  const damageTaken = new Map<string, number>();
  const kos: BattleAnalysis["kos"] = [];
  const hit = (targetId: string, amount: number, killerId: string) => {
    const before = hp.get(targetId) ?? 0;
    const effective = Math.max(0, Math.min(amount, before));
    hp.set(targetId, before - amount);
    damageTaken.set(targetId, (damageTaken.get(targetId) ?? 0) + effective);
    if (before > 0 && before - amount <= 0) kos.push({ targetId, killerId });
  };
  for (const t of log) {
    if (t.action === "HEAL") {
      hp.set(t.targetId, Math.min(max.get(t.targetId) ?? Infinity, (hp.get(t.targetId) ?? 0) + t.damage));
      continue;
    }
    if (t.action !== "ATTACK" || t.damage <= 0) continue;
    const guard = /Guardião (.+?) absorveu (\d+) de dano/.exec(t.effect ?? "");
    const guardId = guard ? guardians.get(`${t.targetOwnerId}|${guard[1]}`) : undefined;
    if (guard && guardId) hit(guardId, Number(guard[2]), t.actorId);
    hit(t.targetId, t.damage, t.actorId);
  }
  return { hpEnd: hp, damageTaken, kos };
}

export type JohtoBattleOutcome = {
  battle: LeagueBattleResult;
  leaderTeam: LeagueMascot[];
  win: boolean;
  /** Dano causado a cada mascote do líder em HP de combate e já convertido para a vida global. */
  perSlot: Array<{ slot: number; pokemonId: number; name: string; battleDamage: number; globalDamage: number; fellInBattle: boolean }>;
  totalGlobalDamage: number;
  playerFallenIds: string[];
  playerKos: Array<{ targetId: string; killerId: string }>;
  rounds: number;
};

/** Uma investida: time do jogador (6) contra os mascotes vivos do líder, convertendo o dano para a vida global. */
export function runJohtoBattle(playerTeam: LeagueMascot[], def: JohtoLeaderDef, position: number, aliveSlots: number[], damageScale: number): JohtoBattleOutcome {
  const leaderTeam = buildLeaderTeam(def, aliveSlots, playerTeam, position);
  const battle = runLeagueCombat(playerTeam, leaderTeam);
  const analysis = analyzeLeagueBattle([...battle.lineupA, ...battle.lineupB], battle.log);
  const perSlot = leaderTeam.map((m) => {
    const battleDamage = Math.round(analysis.damageTaken.get(m.id) ?? 0);
    return { slot: m.slot, pokemonId: m.pokemonId, name: m.name, battleDamage, globalDamage: Math.round(battleDamage * damageScale), fellInBattle: (analysis.hpEnd.get(m.id) ?? 0) <= 0 };
  });
  const playerIds = new Set(playerTeam.map((m) => m.id));
  return {
    battle, leaderTeam, win: battle.winner === "A", perSlot,
    totalGlobalDamage: perSlot.reduce((sum, p) => sum + p.globalDamage, 0),
    playerFallenIds: playerTeam.filter((m) => (analysis.hpEnd.get(m.id) ?? 0) <= 0).map((m) => m.id),
    playerKos: analysis.kos.filter((k) => playerIds.has(k.targetId)),
    rounds: battle.rounds,
  };
}

/** Escalação no formato que o replay da Liga espera. */
export function toReplayLineup(team: LeagueMascot[]) {
  return team.map((m) => ({ id: m.id, name: m.name, pokemonId: m.pokemonId, level: m.level, ownerId: m.ownerId, role: getCombatRoleLabel(m.combatRole), maxHp: m.hp }));
}
