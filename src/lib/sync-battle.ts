import { prisma } from "@/lib/prisma";
import { type CombatRole } from "@/lib/combat-roles";
import { runLeagueCombat, toLeagueMascot } from "@/lib/league-combat";
import { pokemonGeneration } from "@/lib/sync-round-modifiers";
import { mascotTypes } from "@/lib/mascot-data";
import type { SyncMatchResult } from "@prisma/client";

interface TeamInput {
  id: string;
  playerAId: string;
  playerBId: string | null;
}

interface SelectionInput {
  teamId: string;
  playerId: string;
  mascotIds: string[];
}

export type ModEffect =
  | { type: "STAT_BOOST"; targetStat: string; value: number }
  | { type: "FIXED_STATS"; value: number }
  | { type: "LEVEL_BOOST_LOW"; maxLevel: number; value: number }
  | { type: "LEVEL_PENALTY_HIGH"; minLevel: number; targetStat: string; value: number }
  | { type: "AGILITY_THRESHOLD_BOOST"; threshold: number; value: number }
  | { type: "TOP_STAT_BOOST_PER_TEAM"; stat: string; value: number }
  | { type: "HIGHEST_FORCE_PENALTY"; value: number }
  | { type: "LOWEST_TEAM_LEVEL_BOOST"; value: number }
  | { type: "EQUALIZE_EXTREMES"; topPenalty: number; bottomBonus: number }
  | { type: "HIGHEST_LEVEL_AGILITY_PENALTY"; value: number }
  | { type: "RANDOM_MASCOT_BOOST"; value: number }
  | { type: "GENERATION_STAT_BOOST"; selectedGeneration: number; value: number }
  | { type: "STAT_SWAP_TOP"; stat: string; swapTo: string }
  | { type: "TOP_TOTAL_STATS_NERF"; value: number }
  | { type: "TEAM_STAT_ADVANTAGE"; stat: "statCharisma" | "statForce"; value: number }
  | { type: "TEAM_CHARISMA_SHIELD"; value: number }
  | { type: "LOWEST_VITALITY_DEFENSE"; value: number }
  | { type: "FIRST_EVENT_USE_BOOST"; value: number }
  | { type: "TEAM_TYPE_UNIQUE_BOOST"; value: number }
  | { type: "TEAM_TYPE_REPEAT_PENALTY"; value: number }
  | { type: "SAME_TYPE_PLAYERS_PENALTY"; value: number }
  | { type: "HIGH_LEVEL_LIMIT_SOFT"; maxAboveLevel: number; level: number }
  | { type: "EQUIPPED_MASCOT_NERF"; value: number }
  | { type: "TYPE_MODIFIER"; boostType: string; penaltyType: string; boost: number; penalty: number }
  | { type: "TEAM_AGILITY_PRIORITY" }
  | { type: "LAST_MASCOT_VITALITY"; value: number }
  | { type: "INSTINCT_CHAOS" }
  | { type: "LOWEST_LEVEL_PRIORITY"; tieBreak?: string }
  | { type: "MID_BATTLE_REROLL" }
  | { type: "CHARISMA_WINS" }
  | { type: "FORCE_TEAM_AHEAD" }
  | { type: string };

interface BattleOutput {
  result: SyncMatchResult;
  teamADamage: number;
  teamBDamage: number;
  survivingA: number;
  survivingB: number;
  replayJson: object;
}

type MascotRow = {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statForce: number;
  statAgility: number;
  statVitality: number;
  statCharisma: number;
  statInstinct: number;
  happiness: number;
  mood: string;
  combatRole?: CombatRole | string | null;
  personality?: string | null;
  playerId?: string;
  primaryTypeOverride?: string | null;
  secondaryTypeOverride?: string | null;
  [key: string]: unknown;
};

export type SyntheticSyncMascot = MascotRow;

type ModContext = {
  highestForceId: string | null;
  highestLevelIdPerTeam: { a: string | null; b: string | null };
  topInstinctIdPerTeam: { a: string | null; b: string | null };
  topTotalStatsIdPerPlayer: Map<string, string>;
  teamALevelSum: number;
  teamBLevelSum: number;
  teamATotalStats?: number;
  teamBTotalStats?: number;
  charismaSumA: number;
  charismaSumB: number;
  forceSumA: number;
  forceSumB: number;
  randomBoostMascotIdA: string | null;
  randomBoostMascotIdB: string | null;
  lowestVitalityIdPerTeam?: { a: string | null; b: string | null };
  lowestLevelIdPerTeam?: { a: string | null; b: string | null };
  agilitySumA?: number;
  agilitySumB?: number;
  uniqueTypesA?: boolean;
  uniqueTypesB?: boolean;
  repeatedTypesA?: boolean;
  repeatedTypesB?: boolean;
  sharedPlayerTypesA?: boolean;
  sharedPlayerTypesB?: boolean;
  highLevelPenaltyIds?: Set<string>;
  firstUseMascotIds?: Set<string>;
};

const totalStats = (m: MascotRow) => m.statForce + m.statAgility + m.statVitality + m.statCharisma + m.statInstinct;

function computeModContext(mascotsA: MascotRow[], mascotsB: MascotRow[], _modEffect: ModEffect | null): ModContext {
  const allMascots = [...mascotsA, ...mascotsB];

  // highestForceId — across both teams
  let highestForceId: string | null = null;
  let highestForce = -Infinity;
  for (const m of allMascots) {
    if (m.statForce > highestForce) {
      highestForce = m.statForce;
      highestForceId = m.id;
    }
  }

  // highestLevelIdPerTeam
  const highestLevelId = (mascots: MascotRow[]) => {
    let id: string | null = null;
    let maxLvl = -Infinity;
    for (const m of mascots) {
      if (m.level > maxLvl) { maxLvl = m.level; id = m.id; }
    }
    return id;
  };

  // topInstinctIdPerTeam
  const topInstinctId = (mascots: MascotRow[]) => {
    let id: string | null = null;
    let maxInst = -Infinity;
    for (const m of mascots) {
      if (m.statInstinct > maxInst) { maxInst = m.statInstinct; id = m.id; }
    }
    return id;
  };

  // topTotalStatsIdPerPlayer — need player ownership; we don't have it here so we skip (handled separately)
  // For TOP_TOTAL_STATS_NERF we track per mascot total and apply per-team
  // We store it as: for teamA side → the mascot with highest total in mascotsA; same for B
  const topTotalStatsIdPerPlayer = new Map<string, string>();
  // Use "A" and "B" as pseudo-player keys for teams
  const topTotalA = mascotsA.reduce<MascotRow | null>((best, m) => {
    const total = m.statForce + m.statAgility + m.statVitality + m.statCharisma + m.statInstinct;
    if (!best) return m;
    const bestTotal = best.statForce + best.statAgility + best.statVitality + best.statCharisma + best.statInstinct;
    return total > bestTotal ? m : best;
  }, null);
  const topTotalB = mascotsB.reduce<MascotRow | null>((best, m) => {
    const total = m.statForce + m.statAgility + m.statVitality + m.statCharisma + m.statInstinct;
    if (!best) return m;
    const bestTotal = best.statForce + best.statAgility + best.statVitality + best.statCharisma + best.statInstinct;
    return total > bestTotal ? m : best;
  }, null);
  if (topTotalA) topTotalStatsIdPerPlayer.set("A", topTotalA.id);
  if (topTotalB) topTotalStatsIdPerPlayer.set("B", topTotalB.id);

  const teamALevelSum = mascotsA.reduce((s, m) => s + m.level, 0);
  const teamBLevelSum = mascotsB.reduce((s, m) => s + m.level, 0);
  const charismaSumA = mascotsA.reduce((s, m) => s + m.statCharisma, 0);
  const charismaSumB = mascotsB.reduce((s, m) => s + m.statCharisma, 0);
  const forceSumA = mascotsA.reduce((s, m) => s + m.statForce, 0);
  const forceSumB = mascotsB.reduce((s, m) => s + m.statForce, 0);

  const randomBoostMascotIdA = mascotsA.length > 0 ? mascotsA[Math.floor(Math.random() * mascotsA.length)].id : null;
  const randomBoostMascotIdB = mascotsB.length > 0 ? mascotsB[Math.floor(Math.random() * mascotsB.length)].id : null;

  return {
    highestForceId,
    highestLevelIdPerTeam: { a: highestLevelId(mascotsA), b: highestLevelId(mascotsB) },
    topInstinctIdPerTeam: { a: topInstinctId(mascotsA), b: topInstinctId(mascotsB) },
    topTotalStatsIdPerPlayer,
    teamALevelSum,
    teamBLevelSum,
    charismaSumA,
    charismaSumB,
    forceSumA,
    forceSumB,
    randomBoostMascotIdA,
    randomBoostMascotIdB,
  };
}

function computeExecutableModContext(mascotsA: MascotRow[], mascotsB: MascotRow[], modEffect: ModEffect | null, firstUseMascotIds?: Set<string>): ModContext {
  const context = computeModContext(mascotsA, mascotsB, modEffect);
  const allMascots = [...mascotsA, ...mascotsB];
  const lowestLevelId = (mascots: MascotRow[]) => [...mascots].sort((a, b) => a.level - b.level || totalStats(a) - totalStats(b) || a.id.localeCompare(b.id))[0]?.id ?? null;
  const lowestVitalityId = (mascots: MascotRow[]) => [...mascots].sort((a, b) => a.statVitality - b.statVitality || totalStats(a) - totalStats(b))[0]?.id ?? null;

  context.topTotalStatsIdPerPlayer.clear();
  for (const mascot of allMascots) {
    const owner = mascot.playerId ?? "unknown";
    const currentId = context.topTotalStatsIdPerPlayer.get(owner);
    const current = currentId ? allMascots.find((candidate) => candidate.id === currentId) : null;
    if (!current || totalStats(mascot) > totalStats(current)) context.topTotalStatsIdPerPlayer.set(owner, mascot.id);
  }

  const primaryTypes = (mascots: MascotRow[]) => mascots.map((m) => mascotTypes(m)[0] ?? "normal");
  const typesA = primaryTypes(mascotsA);
  const typesB = primaryTypes(mascotsB);
  const repeated = (types: string[]) => Math.max(...[...new Set(types)].map((type) => types.filter((entry) => entry === type).length), 0) >= 3;
  const playersShareTypes = (mascots: MascotRow[]) => {
    const owners = [...new Set(mascots.map((m) => m.playerId).filter((id): id is string => Boolean(id)))];
    if (owners.length < 2) return false;
    const first = new Set(mascots.filter((m) => m.playerId === owners[0]).flatMap((m) => mascotTypes(m)));
    return mascots.filter((m) => m.playerId === owners[1]).some((m) => mascotTypes(m).some((type) => first.has(type)));
  };
  const highLevelPenaltyIds = new Set<string>();
  for (const team of [mascotsA, mascotsB]) {
    const owners = [...new Set(team.map((m) => m.playerId).filter((id): id is string => Boolean(id)))];
    for (const owner of owners) {
      team.filter((m) => m.playerId === owner && m.level > 30).sort((a, b) => totalStats(b) - totalStats(a)).slice(1).forEach((m) => highLevelPenaltyIds.add(m.id));
    }
  }
  return {
    ...context,
    lowestLevelIdPerTeam: { a: lowestLevelId(mascotsA), b: lowestLevelId(mascotsB) },
    lowestVitalityIdPerTeam: { a: lowestVitalityId(mascotsA), b: lowestVitalityId(mascotsB) },
    agilitySumA: mascotsA.reduce((sum, m) => sum + m.statAgility, 0),
    agilitySumB: mascotsB.reduce((sum, m) => sum + m.statAgility, 0),
    teamATotalStats: mascotsA.reduce((sum, m) => sum + totalStats(m), 0),
    teamBTotalStats: mascotsB.reduce((sum, m) => sum + totalStats(m), 0),
    uniqueTypesA: new Set(typesA).size === typesA.length,
    uniqueTypesB: new Set(typesB).size === typesB.length,
    repeatedTypesA: repeated(typesA),
    repeatedTypesB: repeated(typesB),
    sharedPlayerTypesA: playersShareTypes(mascotsA),
    sharedPlayerTypesB: playersShareTypes(mascotsB),
    highLevelPenaltyIds,
    firstUseMascotIds,
  };
}

function clamp(v: number): number {
  return Math.max(1, Math.floor(v));
}

function applyModToMascot(m: MascotRow, modEffect: ModEffect | null, modContext: ModContext, side: "A" | "B"): MascotRow {
  if (!modEffect) return m;

  const allStats = (val: number) => ({
    statForce: clamp(m.statForce + val),
    statAgility: clamp(m.statAgility + val),
    statVitality: clamp(m.statVitality + val),
    statCharisma: clamp(m.statCharisma + val),
    statInstinct: clamp(m.statInstinct + val),
  });

  const scaleAll = (factor: number) => ({
    statForce: clamp(m.statForce * factor),
    statAgility: clamp(m.statAgility * factor),
    statVitality: clamp(m.statVitality * factor),
    statCharisma: clamp(m.statCharisma * factor),
    statInstinct: clamp(m.statInstinct * factor),
  });

  switch (modEffect.type) {
    case "STAT_BOOST": {
      const e = modEffect as { type: "STAT_BOOST"; targetStat: string; value: number };
      const cur = m[e.targetStat];
      if (typeof cur !== "number") return m;
      return { ...m, [e.targetStat]: clamp(cur * (1 + e.value)) };
    }

    case "FIXED_STATS": {
      const e = modEffect as { type: "FIXED_STATS"; value: number };
      return {
        ...m,
        statForce: e.value,
        statAgility: e.value,
        statVitality: e.value,
        statCharisma: e.value,
        statInstinct: e.value,
      };
    }

    case "LEVEL_BOOST_LOW": {
      const e = modEffect as { type: "LEVEL_BOOST_LOW"; maxLevel: number; value: number };
      if (m.level < e.maxLevel) return { ...m, ...allStats(e.value) };
      return m;
    }

    case "LEVEL_PENALTY_HIGH": {
      const e = modEffect as { type: "LEVEL_PENALTY_HIGH"; minLevel: number; targetStat: string; value: number };
      if (m.level > e.minLevel) {
        const cur = m[e.targetStat];
        if (typeof cur !== "number") return m;
        return { ...m, [e.targetStat]: clamp(cur * (1 + e.value)) };
      }
      return m;
    }

    case "AGILITY_THRESHOLD_BOOST": {
      const e = modEffect as { type: "AGILITY_THRESHOLD_BOOST"; threshold: number; value: number };
      if (m.statAgility > e.threshold) {
        return { ...m, statAgility: clamp(m.statAgility * (1 + e.value)) };
      }
      return m;
    }

    case "TOP_STAT_BOOST_PER_TEAM": {
      const e = modEffect as { type: "TOP_STAT_BOOST_PER_TEAM"; stat: string; value: number };
      const topId = side === "A" ? modContext.topInstinctIdPerTeam.a : modContext.topInstinctIdPerTeam.b;
      if (m.id === topId) return { ...m, ...allStats(e.value) };
      return m;
    }

    case "HIGHEST_FORCE_PENALTY": {
      const e = modEffect as { type: "HIGHEST_FORCE_PENALTY"; value: number };
      if (m.id === modContext.highestForceId) return { ...m, ...scaleAll(1 - e.value) };
      return m;
    }

    case "LOWEST_TEAM_LEVEL_BOOST": {
      const e = modEffect as { type: "LOWEST_TEAM_LEVEL_BOOST"; value: number };
      const aIsLower = modContext.teamALevelSum < modContext.teamBLevelSum
        || (modContext.teamALevelSum === modContext.teamBLevelSum && (modContext.teamATotalStats ?? 0) < (modContext.teamBTotalStats ?? 0));
      const bIsLower = modContext.teamBLevelSum < modContext.teamALevelSum
        || (modContext.teamALevelSum === modContext.teamBLevelSum && (modContext.teamBTotalStats ?? 0) < (modContext.teamATotalStats ?? 0));
      if ((side === "A" && aIsLower) || (side === "B" && bIsLower)) {
        return { ...m, ...allStats(e.value) };
      }
      return m;
    }

    case "EQUALIZE_EXTREMES": {
      const e = modEffect as { type: "EQUALIZE_EXTREMES"; topPenalty: number; bottomBonus: number };
      const stats: [keyof MascotRow, number][] = [
        ["statForce", m.statForce],
        ["statAgility", m.statAgility],
        ["statVitality", m.statVitality],
        ["statCharisma", m.statCharisma],
        ["statInstinct", m.statInstinct],
      ];
      stats.sort((a, b) => b[1] - a[1]);
      const [topKey, topVal] = stats[0];
      const [botKey, botVal] = stats[stats.length - 1];
      return {
        ...m,
        [topKey]: clamp(topVal * (1 - e.topPenalty)),
        [botKey]: clamp(botVal * (1 + e.bottomBonus)),
      };
    }

    case "HIGHEST_LEVEL_AGILITY_PENALTY": {
      const e = modEffect as { type: "HIGHEST_LEVEL_AGILITY_PENALTY"; value: number };
      const topId = side === "A" ? modContext.highestLevelIdPerTeam.a : modContext.highestLevelIdPerTeam.b;
      if (m.id === topId) return { ...m, statAgility: clamp(m.statAgility * e.value) };
      return m;
    }

    case "RANDOM_MASCOT_BOOST": {
      const e = modEffect as { type: "RANDOM_MASCOT_BOOST"; value: number };
      const targetId = side === "A" ? modContext.randomBoostMascotIdA : modContext.randomBoostMascotIdB;
      if (m.id === targetId) return { ...m, ...allStats(e.value) };
      return m;
    }

    case "GENERATION_STAT_BOOST": {
      const e = modEffect as { type: "GENERATION_STAT_BOOST"; selectedGeneration: number; value: number };
      if (pokemonGeneration(m.pokemonId) === e.selectedGeneration) return { ...m, ...allStats(e.value) };
      return m;
    }

    case "STAT_SWAP_TOP": {
      const e = modEffect as { type: "STAT_SWAP_TOP"; stat: string; swapTo: string };
      if (m.id === modContext.highestForceId && e.stat === "statForce") {
        const fromVal = m[e.stat as keyof MascotRow] as number;
        const toVal = m[e.swapTo as keyof MascotRow] as number;
        return { ...m, [e.stat]: toVal, [e.swapTo]: fromVal };
      }
      return m;
    }

    case "TOP_TOTAL_STATS_NERF": {
      const e = modEffect as { type: "TOP_TOTAL_STATS_NERF"; value: number };
      const topId = modContext.topTotalStatsIdPerPlayer.get(m.playerId ?? side);
      if (m.id === topId) {
        return {
          ...m,
          statForce: e.value,
          statAgility: e.value,
          statVitality: e.value,
          statCharisma: e.value,
          statInstinct: e.value,
        };
      }
      return m;
    }

    case "TEAM_STAT_ADVANTAGE": {
      const e = modEffect as { type: "TEAM_STAT_ADVANTAGE"; stat: "statCharisma" | "statForce"; value: number };
      const sumA = e.stat === "statCharisma" ? modContext.charismaSumA : modContext.forceSumA;
      const sumB = e.stat === "statCharisma" ? modContext.charismaSumB : modContext.forceSumB;
      if ((side === "A" && sumA > sumB) || (side === "B" && sumB > sumA)) {
        return { ...m, ...scaleAll(1 + e.value) };
      }
      return m;
    }

    case "TEAM_CHARISMA_SHIELD": {
      const e = modEffect as { type: "TEAM_CHARISMA_SHIELD"; value: number };
      const wins = side === "A" ? modContext.charismaSumA > modContext.charismaSumB : modContext.charismaSumB > modContext.charismaSumA;
      return wins ? { ...m, statVitality: clamp(m.statVitality * (1 + e.value)) } : m;
    }
    case "LOWEST_VITALITY_DEFENSE": {
      const id = side === "A" ? modContext.lowestVitalityIdPerTeam?.a : modContext.lowestVitalityIdPerTeam?.b;
      return m.id === id ? { ...m, statVitality: clamp(m.statVitality + (modEffect as { value: number }).value) } : m;
    }
    case "FIRST_EVENT_USE_BOOST":
      return modContext.firstUseMascotIds?.has(m.id) !== false
        ? { ...m, ...allStats((modEffect as { value: number }).value) }
        : m;
    case "TEAM_TYPE_UNIQUE_BOOST": {
      const unique = side === "A" ? modContext.uniqueTypesA : modContext.uniqueTypesB;
      return unique ? { ...m, ...allStats((modEffect as { value: number }).value) } : m;
    }
    case "TEAM_TYPE_REPEAT_PENALTY": {
      const repeated = side === "A" ? modContext.repeatedTypesA : modContext.repeatedTypesB;
      return repeated ? { ...m, ...scaleAll(1 - (modEffect as { value: number }).value) } : m;
    }
    case "SAME_TYPE_PLAYERS_PENALTY": {
      const shared = side === "A" ? modContext.sharedPlayerTypesA : modContext.sharedPlayerTypesB;
      return shared ? { ...m, ...scaleAll(1 - (modEffect as { value: number }).value) } : m;
    }
    case "HIGH_LEVEL_LIMIT_SOFT": {
      if (!modContext.highLevelPenaltyIds?.has(m.id)) return m;
      const level = (modEffect as { level: number }).level;
      return { ...m, ...scaleAll(Math.min(1, level / Math.max(level, m.level))) };
    }
    case "EQUIPPED_MASCOT_NERF": {
      if (!m.isEquipped) return m;
      const value = (modEffect as { value: number }).value;
      return { ...m, statForce: value, statAgility: value, statVitality: value, statCharisma: value, statInstinct: value };
    }
    case "TYPE_MODIFIER": {
      const e = modEffect as { type: "TYPE_MODIFIER"; boostType: string; penaltyType: string; boost: number; penalty: number };
      const types = mascotTypes(m);
      if (types.includes(e.boostType)) return { ...m, ...scaleAll(1 + e.boost) };
      if (types.includes(e.penaltyType)) return { ...m, ...scaleAll(1 - e.penalty) };
      return m;
    }
    default:
      return m;
  }
}

export async function loadModEffect(modifierId: string | null): Promise<ModEffect | null> {
  if (!modifierId) return null;
  const mod = await prisma.syncEventModifier.findUnique({ where: { id: modifierId }, select: { key: true, effectJson: true } });
  if (mod?.effectJson && typeof mod.effectJson === "object" && !Array.isArray(mod.effectJson)) {
    const effect = mod.effectJson as unknown as ModEffect;
    if (effect.type === "CHARISMA_WINS") return { type: "TEAM_STAT_ADVANTAGE", stat: "statCharisma", value: 0.08 };
    if (effect.type === "FORCE_TEAM_AHEAD") return { type: "TEAM_STAT_ADVANTAGE", stat: "statForce", value: 0.08 };
    if (mod.key === "ENERGIA_SINCRONIZADA" && effect.type === "REWARD_WINNER") {
      return { ...(effect as unknown as Record<string, unknown>), recipient: "RANDOM_WINNER" } as unknown as ModEffect;
    }
    // Compatibilidade com rodadas criadas antes de os modificadores visuais ganharem efeito real.
    if (effect.type === "DISPLAY_ONLY") {
      const upgraded: Record<string, ModEffect> = {
        CARISMA_DE_PALCO: { type: "TEAM_CHARISMA_SHIELD", value: 0.2 },
        FRAQUEZA_EXPOSTA: { type: "LOWEST_VITALITY_DEFENSE", value: 60 },
        TREINO_RELAMPAGO: { type: "FIRST_EVENT_USE_BOOST", value: 15 },
        CORRIDA_DE_AGILIDADE: { type: "TEAM_AGILITY_PRIORITY" },
        UNIAO_PERFEITA: { type: "TEAM_TYPE_UNIQUE_BOOST", value: 10 },
        TIME_DESAJUSTADO: { type: "TEAM_TYPE_REPEAT_PENALTY", value: 0.1 },
        VIRADA_FINAL: { type: "LAST_MASCOT_VITALITY", value: 20 },
        INSTINTO_CONFUSO: { type: "INSTINCT_CHAOS" },
        TATICA_INVERTIDA: { type: "LOWEST_LEVEL_PRIORITY" },
        PANE_NA_ARENA: { type: "MID_BATTLE_REROLL" },
        DUPLA_DESAFINADA: { type: "SAME_TYPE_PLAYERS_PENALTY", value: 0.15 },
        HARMONIA_TOTAL: { type: "TEAM_TYPE_UNIQUE_BOOST", value: 15 },
        BAIXA_ROTACAO: { type: "HIGH_LEVEL_LIMIT_SOFT", maxAboveLevel: 1, level: 30 },
        SEM_MASCOTE_PRINCIPAL: { type: "EQUIPPED_MASCOT_NERF", value: 20 },
      };
      return upgraded[mod.key] ?? effect;
    }
    return effect;
  }
  return null;
}

export async function runSyncBattle(params: {
  teamA: TeamInput;
  teamB: TeamInput;
  selections: SelectionInput[];
  modifierId: string | null;
  roundId?: string;
  modEffect?: ModEffect | null;
  syntheticMascotsB?: SyntheticSyncMascot[];
}): Promise<BattleOutput> {
  const { teamA, teamB, selections, modifierId } = params;
  const modEffect = params.modEffect !== undefined ? params.modEffect : await loadModEffect(modifierId);

  const getTeamMascotIds = (team: TeamInput) => {
    const result: string[] = [];
    for (const playerId of [team.playerAId, team.playerBId].filter(Boolean) as string[]) {
      const selection = selections.find((s) => s.teamId === team.id && s.playerId === playerId);
      if (selection) result.push(...selection.mascotIds);
    }
    return result;
  };

  const mascotIdsA = getTeamMascotIds(teamA);
  const mascotIdsB = params.syntheticMascotsB?.map((m) => m.id) ?? getTeamMascotIds(teamB);

  const [rawA, rawB] = await Promise.all([
    prisma.mascot.findMany({ where: { id: { in: mascotIdsA } } }),
    params.syntheticMascotsB
      ? Promise.resolve(params.syntheticMascotsB)
      : prisma.mascot.findMany({ where: { id: { in: mascotIdsB } } }),
  ]);

  const lineupRoles = await prisma.syncEventLineup.findMany({
    where: { teamId: { in: [teamA.id, teamB.id] }, mascotId: { in: [...mascotIdsA, ...mascotIdsB] } },
    select: { mascotId: true, combatRole: true },
  });
  const roleByMascot = new Map(lineupRoles.map((entry) => [entry.mascotId, entry.combatRole]));

  const orderMascots = (raw: MascotRow[], ids: string[]) => {
    const byId = new Map(raw.map((m) => [m.id, m]));
    return ids.map((id) => byId.get(id)).filter((m): m is MascotRow => Boolean(m));
  };
  const mascotsA = orderMascots(rawA as MascotRow[], mascotIdsA).map((m) => ({ ...m, combatRole: roleByMascot.get(m.id) ?? m.combatRole ?? "ATTACKER" }));
  const mascotsB = orderMascots(rawB as MascotRow[], mascotIdsB).map((m) => ({ ...m, combatRole: roleByMascot.get(m.id) ?? m.combatRole ?? "ATTACKER" }));

  let firstUseMascotIds: Set<string> | undefined;
  if (modEffect?.type === "FIRST_EVENT_USE_BOOST" && params.roundId) {
    const currentRound = await prisma.syncEventRound.findUnique({ where: { id: params.roundId }, select: { roomId: true, roundNumber: true } });
    if (currentRound) {
      const previous = await prisma.syncRoundSelection.findMany({
        where: { round: {
          roomId: currentRound.roomId,
          ...(currentRound.roundNumber === 0 ? { roundNumber: { gt: 0 } } : { roundNumber: { lt: currentRound.roundNumber } }),
        } },
        select: { mascotIds: true },
      });
      const used = new Set(previous.flatMap((selection) => selection.mascotIds));
      firstUseMascotIds = new Set([...mascotIdsA, ...mascotIdsB].filter((id) => !used.has(id)));
    }
  }

  // Compute cross-team context for complex modifiers
  const modContext = computeExecutableModContext(mascotsA, mascotsB, modEffect, firstUseMascotIds);

  // Apply stat modifiers before the battle loop
  const boostedA = mascotsA.map((m) => applyModToMascot(m, modEffect, modContext, "A"));
  const boostedB = mascotsB.map((m) => applyModToMascot(m, modEffect, modContext, "B"));

  const lineupA = boostedA.map((m, index) => toLeagueMascot({ ...m, playerId: teamA.id }, index + 1, m.combatRole));
  const lineupB = boostedB.map((m, index) => toLeagueMascot({ ...m, playerId: teamB.id }, index + 1, m.combatRole));
  if (lineupA.length !== 6 || lineupB.length !== 6) {
    throw new Error(`Cada dupla precisa levar exatamente 6 mascotes ao combate (3 por jogador). Recebidos: ${lineupA.length} x ${lineupB.length}.`);
  }

  const initiativeTeam = modEffect?.type === "TEAM_AGILITY_PRIORITY"
    ? (modContext.agilitySumA ?? 0) === (modContext.agilitySumB ?? 0) ? null : (modContext.agilitySumA ?? 0) > (modContext.agilitySumB ?? 0) ? "A" : "B"
    : null;
  const initiativeMascotIds = modEffect?.type === "LOWEST_LEVEL_PRIORITY"
    ? [modContext.lowestLevelIdPerTeam?.a, modContext.lowestLevelIdPerTeam?.b].filter((id): id is string => Boolean(id))
    : [];
  const battle = runLeagueCombat(lineupA, lineupB, null, [], [], {
    initiativeTeam,
    initiativeMascotIds,
    instinctChaos: modEffect?.type === "INSTINCT_CHAOS",
    midBattleReroll: modEffect?.type === "MID_BATTLE_REROLL",
    lastMascotVitalityBonus: modEffect?.type === "LAST_MASCOT_VITALITY" ? Number((modEffect as Record<string, unknown>).value ?? 20) : undefined,
  });
  const result: SyncMatchResult = battle.winner === "A" ? "TEAM_A_WIN" : battle.winner === "B" ? "TEAM_B_WIN" : "DRAW";
  const serializeLineup = (lineup: typeof battle.lineupA) => lineup.map((m) => ({
    id: m.id, name: m.name, pokemonId: m.pokemonId, level: m.level,
    ownerId: m.ownerId, role: m.combatRole, maxHp: m.hp,
  }));
  const modifierApplications = [...mascotsA.map((before, index) => ({ before, after: boostedA[index], side: "A" as const })), ...mascotsB.map((before, index) => ({ before, after: boostedB[index], side: "B" as const }))]
    .map(({ before, after, side }) => {
      const changes = (["statForce", "statAgility", "statVitality", "statCharisma", "statInstinct"] as const)
        .map((stat) => ({ stat, delta: after[stat] - before[stat] }))
        .filter((change) => change.delta !== 0);
      return changes.length ? { mascotId: before.id, name: before.nickname ?? `#${before.pokemonId}`, side, changes } : null;
    })
    .filter(Boolean);

  return {
    result,
    teamADamage: battle.teamADamageDealt,
    teamBDamage: battle.teamBDamageDealt,
    survivingA: battle.teamASurvivors,
    survivingB: battle.teamBSurvivors,
    replayJson: {
      version: 2,
      engine: "STANDARD_COMBAT",
      modifierId,
      combatRounds: battle.rounds,
      log: battle.log,
      lineupA: serializeLineup(battle.lineupA),
      lineupB: serializeLineup(battle.lineupB),
      modifierApplications,
      modifierRule: modEffect?.type ?? null,
    },
  };
}
