import { prisma } from "@/lib/prisma";
import { type CombatRole } from "@/lib/combat-roles";
import { runLeagueCombat, toLeagueMascot } from "@/lib/league-combat";
import { pokemonGeneration } from "@/lib/sync-round-modifiers";
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
  playerId?: string;
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
  charismaSumA: number;
  charismaSumB: number;
  forceSumA: number;
  forceSumB: number;
  randomBoostMascotIdA: string | null;
  randomBoostMascotIdB: string | null;
};

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
      const aIsLower = modContext.teamALevelSum <= modContext.teamBLevelSum;
      if ((side === "A" && aIsLower) || (side === "B" && !aIsLower)) {
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
      const topId = modContext.topTotalStatsIdPerPlayer.get(side);
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

    default:
      return m;
  }
}

export async function loadModEffect(modifierId: string | null): Promise<ModEffect | null> {
  if (!modifierId) return null;
  const mod = await prisma.syncEventModifier.findUnique({ where: { id: modifierId }, select: { effectJson: true } });
  if (mod?.effectJson && typeof mod.effectJson === "object" && !Array.isArray(mod.effectJson)) {
    const effect = mod.effectJson as unknown as ModEffect;
    if (effect.type === "CHARISMA_WINS") return { type: "TEAM_STAT_ADVANTAGE", stat: "statCharisma", value: 0.08 };
    if (effect.type === "FORCE_TEAM_AHEAD") return { type: "TEAM_STAT_ADVANTAGE", stat: "statForce", value: 0.08 };
    return effect;
  }
  return null;
}

export async function runSyncBattle(params: {
  teamA: TeamInput;
  teamB: TeamInput;
  selections: SelectionInput[];
  modifierId: string | null;
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

  // Compute cross-team context for complex modifiers
  const modContext = computeModContext(mascotsA, mascotsB, modEffect);

  // Apply stat modifiers before the battle loop
  const boostedA = mascotsA.map((m) => applyModToMascot(m, modEffect, modContext, "A"));
  const boostedB = mascotsB.map((m) => applyModToMascot(m, modEffect, modContext, "B"));

  const lineupA = boostedA.map((m, index) => toLeagueMascot({ ...m, playerId: teamA.id }, index + 1, m.combatRole));
  const lineupB = boostedB.map((m, index) => toLeagueMascot({ ...m, playerId: teamB.id }, index + 1, m.combatRole));
  if (lineupA.length !== 6 || lineupB.length !== 6) {
    throw new Error(`Cada dupla precisa levar exatamente 6 mascotes ao combate (3 por jogador). Recebidos: ${lineupA.length} x ${lineupB.length}.`);
  }

  const battle = runLeagueCombat(lineupA, lineupB, null, [], []);
  const result: SyncMatchResult = battle.winner === "A" ? "TEAM_A_WIN" : battle.winner === "B" ? "TEAM_B_WIN" : "DRAW";
  const serializeLineup = (lineup: typeof battle.lineupA) => lineup.map((m) => ({
    id: m.id, name: m.name, pokemonId: m.pokemonId, level: m.level,
    ownerId: m.ownerId, role: m.combatRole, maxHp: m.hp,
  }));

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
    },
  };
}
