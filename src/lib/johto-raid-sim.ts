// Raid dos Líderes de Johto: dados, recompensas e simulação (sem banco). O combate usa o motor oficial da Liga (runLeagueCombat).
import { getCombatRoleLabel, normalizeCombatRole, type CombatRole } from "@/lib/combat-roles";
import { runLeagueCombat, type LeagueBattleResult, type LeagueMascot } from "@/lib/league-combat";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";

export const JOHTO_EVENT_SLUG = "raid-lideres-johto";
export const JOHTO_VISIBLE_KEY = "johto_raid_visible";
export const JOHTO_LEADER_HP = 2_500_000;
export const JOHTO_MASCOTS_PER_LEADER = 6;
export const JOHTO_DEFAULT_COOLDOWN_MIN = 20;
export const JOHTO_DEFAULT_DAMAGE_SCALE = 1;
export const JOHTO_DEFAULT_LEADER_DAYS = 5;
export const JOHTO_REPLAY_HISTORY = 20;

// ── Combo de ataque em grupo ─────────────────────────────────────────────────
/** Quem ataca com outros treinadores que atacaram nos últimos 30 minutos ganha +2% em todos os status por treinador (máx. 4 = +8%). */
export const COMBO_WINDOW_MS = 30 * 60_000;
export const COMBO_STEP_PCT = 2;
export const COMBO_MAX_STACKS = 4;
export const comboBonusPct = (stacks: number) => Math.max(0, Math.min(COMBO_MAX_STACKS, Math.floor(stacks))) * COMBO_STEP_PCT;

/**
 * O combo é uma sequência única: todo ataque dentro da janela adiciona um degrau
 * (até quatro) e renova o prazo inteiro a partir do ataque mais recente. Depois
 * de 30 minutos sem um novo ataque, a sequência toda expira.
 */
export function getComboWindowState(attackTimes: Date[], now = new Date()) {
  const latestFirst = [...attackTimes].sort((a, b) => b.getTime() - a.getTime());
  const latest = latestFirst[0];
  if (!latest || now.getTime() >= latest.getTime() + COMBO_WINDOW_MS) return { stacks: 0, bonusPct: 0, nextDropAt: null };

  let stacks = 0;
  let previous = latest;
  for (const attackedAt of latestFirst) {
    if (previous.getTime() - attackedAt.getTime() >= COMBO_WINDOW_MS) break;
    stacks++;
    previous = attackedAt;
  }
  return { stacks: Math.min(COMBO_MAX_STACKS, stacks), bonusPct: comboBonusPct(stacks), nextDropAt: new Date(latest.getTime() + COMBO_WINDOW_MS).toISOString() };
}

/** Aplica o bônus do combo (em %) a todos os status e à vida de combate dos mascotes do jogador. */
export function applyComboBonus(team: LeagueMascot[], bonusPct: number): LeagueMascot[] {
  if (bonusPct <= 0) return team;
  const k = 1 + bonusPct / 100;
  return team.map((m) => ({
    ...m, force: Math.round(m.force * k), agility: Math.round(m.agility * k), instinct: Math.round(m.instinct * k),
    vitality: Math.round(m.vitality * k), charisma: Math.round(m.charisma * k), hp: Math.round(m.hp * k),
  }));
}

export type JohtoRosterEntry = { pokemonId: number; role: CombatRole; personality: string };
export type JohtoLeaderDef = {
  key: string; name: string; city: string; badge: string; type: string; quote: string; image: string; roster: JohtoRosterEntry[];
};

/** Imagens no Storage do Supabase (bucket assets, junto com as demais), com cache de 1 ano. */
const LEADER_IMAGE_BASE = "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/JohtoLeaders";

const roster = (entries: Array<[number, CombatRole, string]>): JohtoRosterEntry[] => entries.map(([pokemonId, role, personality]) => ({ pokemonId, role, personality }));

/** Ordem de combate: Violet → Azalea → Goldenrod → Ecruteak → Cianwood → Olivine → Mahogany → Blackthorn. */
export const JOHTO_LEADERS: JohtoLeaderDef[] = [
  { key: "falkner", name: "Falkner", city: "Violet City", badge: "Insígnia Zephyr", type: "flying", quote: "Meus pássaros dominam o céu!", image: `${LEADER_IMAGE_BASE}/falkner.png`,
    roster: roster([[18, "FLANK", "ELECTRIC"], [22, "ATTACKER", "COMPETITIVE"], [85, "OPPORTUNIST", "MISCHIEVOUS"], [164, "HEALER", "SERENE"], [227, "DEFENDER", "LAZY"], [430, "DUELIST", "PROUD"]]) },
  { key: "bugsy", name: "Bugsy", city: "Azalea Town", badge: "Insígnia Hive", type: "bug", quote: "Minha pesquisa sobre insetos vai te surpreender!", image: `${LEADER_IMAGE_BASE}/bugsy.png`,
    roster: roster([[123, "FLANK", "ELECTRIC"], [212, "DEFENDER", "LAZY"], [214, "ATTACKER", "COMPETITIVE"], [168, "OPPORTUNIST", "CURIOUS"], [12, "HEALER", "SERENE"], [469, "DUELIST", "PROUD"]]) },
  { key: "whitney", name: "Whitney", city: "Goldenrod City", badge: "Insígnia Plain", type: "normal", quote: "Não vou perder! Buááá!", image: `${LEADER_IMAGE_BASE}/whitney.png`,
    roster: roster([[241, "ATTACKER", "COMPETITIVE"], [36, "ENCOURAGER", "PLAYFUL"], [143, "DEFENDER", "GLUTTON"], [242, "HEALER", "SERENE"], [217, "DUELIST", "PROUD"], [115, "GUARDIAN", "LOYAL"]]) },
  { key: "morty", name: "Morty", city: "Ecruteak City", badge: "Insígnia Fog", type: "ghost", quote: "Enxergo o que ninguém mais vê.", image: `${LEADER_IMAGE_BASE}/morty.png`,
    roster: roster([[94, "OPPORTUNIST", "MISCHIEVOUS"], [429, "HEALER", "SERENE"], [477, "DEFENDER", "LAZY"], [354, "SABOTEUR", "TIMID"], [426, "GUARDIAN", "LOYAL"], [302, "FLANK", "CURIOUS"]]) },
  { key: "chuck", name: "Chuck", city: "Cianwood City", badge: "Insígnia Storm", type: "fighting", quote: "Treino debaixo de cachoeiras!", image: `${LEADER_IMAGE_BASE}/chuck.png`,
    roster: roster([[62, "DEFENDER", "GLUTTON"], [68, "ATTACKER", "COMPETITIVE"], [106, "FLANK", "ELECTRIC"], [107, "DUELIST", "PROUD"], [297, "GUARDIAN", "LOYAL"], [448, "OPPORTUNIST", "CURIOUS"]]) },
  { key: "jasmine", name: "Jasmine", city: "Olivine City", badge: "Insígnia Mineral", type: "steel", quote: "...Eu... vou dar o meu melhor.", image: `${LEADER_IMAGE_BASE}/jasmine.png`,
    roster: roster([[208, "DEFENDER", "LAZY"], [462, "OPPORTUNIST", "CURIOUS"], [437, "HEALER", "SERENE"], [306, "ATTACKER", "PROUD"], [376, "DUELIST", "COMPETITIVE"], [205, "GUARDIAN", "LOYAL"]]) },
  { key: "pryce", name: "Pryce", city: "Mahogany Town", badge: "Insígnia Glacier", type: "ice", quote: "Vi mais invernos do que você anos.", image: `${LEADER_IMAGE_BASE}/pryce.png`,
    roster: roster([[473, "ATTACKER", "COMPETITIVE"], [87, "HEALER", "SERENE"], [362, "DEFENDER", "LAZY"], [461, "FLANK", "ELECTRIC"], [131, "GUARDIAN", "LOYAL"], [91, "SABOTEUR", "MISCHIEVOUS"]]) },
  { key: "clair", name: "Clair", city: "Blackthorn City", badge: "Insígnia Rising", type: "dragon", quote: "Eu sou a maior treinadora de dragões!", image: `${LEADER_IMAGE_BASE}/clair.png`,
    roster: roster([[230, "OPPORTUNIST", "CURIOUS"], [149, "ATTACKER", "COMPETITIVE"], [373, "DUELIST", "PROUD"], [445, "FLANK", "ELECTRIC"], [334, "HEALER", "SERENE"], [130, "DEFENDER", "GLUTTON"]]) },
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
export type RewardTier = "TOP1" | "TOP2" | "TOP3" | "PARTICIPANT" | "FINAL_BLOW" | "MOST_ATTACKS";
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
  const mostAttacks = active[0] ? [...active].sort((a, b) => b.attackCount - a.attackCount || b.damage - a.damage || a.playerId.localeCompare(b.playerId))[0] : null;
  if (mostAttacks) rows.push({ playerId: mostAttacks.playerId, tier: "MOST_ATTACKS", zc: 0, mascotLevel: 0, egg: true });
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


/**
 * Time do líder para UMA luta: só os mascotes que ainda têm vida global, cada um com a **vida global real** (ex.: 5.833.333),
 * que persiste entre as lutas de todos os jogadores. Os atributos de ataque/defesa vêm da média do time atacante, com o
 * atributo principal da postura em +15%, os demais em −5% e +2% por ginásio avançado (`position`).
 */
export type JohtoAliveMascot = { slot: number; hpMax: number; hpCurrent: number };
export function buildLeaderTeam(def: JohtoLeaderDef, alive: JohtoAliveMascot[], playerTeam: LeagueMascot[], position: number): LeagueMascot[] {
  const n = Math.max(1, playerTeam.length);
  const avg = (pick: (m: LeagueMascot) => number) => playerTeam.reduce((sum, m) => sum + pick(m), 0) / n;
  const base = { force: avg((m) => m.force), agility: avg((m) => m.agility), instinct: avg((m) => m.instinct), vitality: avg((m) => m.vitality), charisma: avg((m) => m.charisma) };
  const level = Math.max(1, Math.round(avg((m) => m.level)));
  const ramp = 1 + position * 0.02;
  return alive.map(({ slot, hpMax }) => {
    const entry = def.roster[slot];
    const mains = ROLE_MAIN_STATS[entry.role];
    const stat = (key: keyof typeof base) => Math.max(1, Math.round(base[key] * (mains.includes(key) ? 1.15 : 0.95) * ramp));
    const vitality = stat("vitality");
    return {
      id: `johto:${def.key}:${slot}`, ownerId: `johto:${def.key}`, pokemonId: entry.pokemonId, types: getPokemonTypes(entry.pokemonId),
      name: getPokemonName(entry.pokemonId), level, force: stat("force"), agility: stat("agility"), instinct: stat("instinct"), vitality,
      charisma: stat("charisma"), hp: hpMax, combatRole: normalizeCombatRole(entry.role), personality: entry.personality, slot,
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
export function analyzeLeagueBattle(lineups: LeagueMascot[], log: LeagueBattleResult["log"], startingHp?: Map<string, number>): BattleAnalysis {
  const hp = new Map<string, number>();
  const max = new Map<string, number>();
  const guardians = new Map<string, string>();
  for (const m of lineups) {
    hp.set(m.id, Math.min(m.hp, startingHp?.get(m.id) ?? m.hp)); max.set(m.id, m.hp);
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
  /** Vida com que cada mascote do líder entrou na luta (dano persistente). */
  startingHp: Map<string, number>;
  win: boolean;
  /** Dano causado a cada mascote do líder em HP de combate e já convertido para a vida global. */
  perSlot: Array<{ slot: number; pokemonId: number; name: string; battleDamage: number; globalDamage: number; fellInBattle: boolean }>;
  totalGlobalDamage: number;
  playerFallenIds: string[];
  playerKos: Array<{ targetId: string; killerId: string }>;
  rounds: number;
};

/** Uma investida: time do jogador (6) contra os mascotes vivos do líder, convertendo o dano para a vida global. */
export function runJohtoBattle(playerTeam: LeagueMascot[], def: JohtoLeaderDef, position: number, alive: JohtoAliveMascot[], damageScale: number, comboPct = 0): JohtoBattleOutcome {
  // O líder escala pelo time SEM o bônus do combo (senão o bônus seria anulado). A luta vai até um dos lados cair (sem limite prático de rodadas).
  const leaderTeam = buildLeaderTeam(def, alive, playerTeam, position);
  // Cada mascote do líder entra com a vida global que ainda tem (o dano é persistente entre as lutas).
  const startingHp = new Map(leaderTeam.map((m) => [m.id, alive.find((a) => a.slot === m.slot)?.hpCurrent ?? m.hp]));
  const battle = runLeagueCombat(applyComboBonus(playerTeam, comboPct), leaderTeam, null, [], [], { maxRounds: 1000, startingHp });
  const analysis = analyzeLeagueBattle([...battle.lineupA, ...battle.lineupB], battle.log, startingHp);
  const perSlot = leaderTeam.map((m) => {
    const battleDamage = Math.round(analysis.damageTaken.get(m.id) ?? 0);
    return { slot: m.slot, pokemonId: m.pokemonId, name: m.name, battleDamage, globalDamage: Math.round(battleDamage * damageScale), fellInBattle: (analysis.hpEnd.get(m.id) ?? 0) <= 0 };
  });
  const playerIds = new Set(playerTeam.map((m) => m.id));
  return {
    battle, leaderTeam, startingHp, win: battle.winner === "A", perSlot,
    totalGlobalDamage: perSlot.reduce((sum, p) => sum + p.globalDamage, 0),
    playerFallenIds: playerTeam.filter((m) => (analysis.hpEnd.get(m.id) ?? 0) <= 0).map((m) => m.id),
    playerKos: analysis.kos.filter((k) => playerIds.has(k.targetId)),
    rounds: battle.rounds,
  };
}

/** Escalação no formato que o replay da Liga espera. */
export function toReplayLineup(team: LeagueMascot[], startingHp?: Map<string, number>) {
  return team.map((m) => ({ id: m.id, name: m.name, pokemonId: m.pokemonId, level: m.level, ownerId: m.ownerId, role: getCombatRoleLabel(m.combatRole), maxHp: m.hp, ...(startingHp?.has(m.id) ? { startHp: Math.min(m.hp, startingHp.get(m.id)!) } : {}) }));
}
