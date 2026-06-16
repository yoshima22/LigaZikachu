import { prisma } from "@/lib/prisma";
import { getPokemonElement, getTypeAdvantageMultiplier, getPokemonName } from "@/lib/mascot-data";
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

export interface ModEffect {
  type: string;
  value: number;
  targetStat?: string;
}

interface BattleOutput {
  result: SyncMatchResult;
  teamADamage: number;
  teamBDamage: number;
  survivingA: number;
  survivingB: number;
  replayJson: object;
}

function mascotScore(m: {
  statForce: number;
  statAgility: number;
  statVitality: number;
  happiness: number;
  mood: string;
  pokemonId: number;
}, opponentPokemonId: number): number {
  const elemSelf = getPokemonElement(m.pokemonId);
  const elemOpp  = getPokemonElement(opponentPokemonId);
  const typeMult = getTypeAdvantageMultiplier(elemSelf, elemOpp);
  const base = m.statForce * 0.4 + m.statAgility * 0.3 + m.statVitality * 0.3;
  const mood  = m.mood === "CONFIDENT" ? 10 : m.mood === "ANGRY" ? 5 : 0;
  return (base + m.happiness / 10 + mood + Math.random() * 15) * typeMult;
}

export async function loadModEffect(modifierId: string | null): Promise<ModEffect | null> {
  if (!modifierId) return null;
  const mod = await prisma.syncEventModifier.findUnique({ where: { id: modifierId }, select: { effectJson: true } });
  if (mod?.effectJson && typeof mod.effectJson === "object" && !Array.isArray(mod.effectJson)) {
    return mod.effectJson as unknown as ModEffect;
  }
  return null;
}

export async function runSyncBattle(params: {
  teamA: TeamInput;
  teamB: TeamInput;
  selections: SelectionInput[];
  modifierId: string | null;
  modEffect?: ModEffect | null;
}): Promise<BattleOutput> {
  const { teamA, teamB, selections, modifierId } = params;
  // Accept pre-loaded modEffect to avoid an extra DB query per confronto
  const modEffect = params.modEffect !== undefined ? params.modEffect : await loadModEffect(modifierId);

  const getTeamMascotIds = (teamId: string) =>
    selections.filter((s) => s.teamId === teamId).flatMap((s) => s.mascotIds);

  const mascotIdsA = getTeamMascotIds(teamA.id);
  const mascotIdsB = getTeamMascotIds(teamB.id);

  const [mascotsA, mascotsB] = await Promise.all([
    prisma.mascot.findMany({ where: { id: { in: mascotIdsA } } }),
    prisma.mascot.findMany({ where: { id: { in: mascotIdsB } } }),
  ]);

  type MascotRow = (typeof mascotsA)[0];
  const applyMod = (m: MascotRow): MascotRow => {
    if (!modEffect || modEffect.type !== "STAT_BOOST" || !modEffect.targetStat) return m;
    const stat = modEffect.targetStat as keyof MascotRow;
    const cur = m[stat];
    if (typeof cur !== "number") return m;
    return { ...m, [stat]: Math.floor(cur * (1 + modEffect.value)) };
  };

  const boostedA = mascotsA.map(applyMod);
  const boostedB = mascotsB.map(applyMod);

  const logEntries: object[] = [];
  let teamADamage = 0;
  let teamBDamage = 0;
  let survivingA  = 0;
  let survivingB  = 0;

  const paired = Math.min(boostedA.length, boostedB.length);
  for (let i = 0; i < paired; i++) {
    const a = boostedA[i];
    const b = boostedB[i];
    const scoreA = mascotScore(a, b.pokemonId);
    const scoreB = mascotScore(b, a.pokemonId);
    const aWins  = scoreA > scoreB;
    teamADamage += Math.round(scoreA);
    teamBDamage += Math.round(scoreB);
    if (aWins) survivingA++; else survivingB++;
    logEntries.push({
      slot: i + 1,
      nameA: a.nickname ?? getPokemonName(a.pokemonId),
      nameB: b.nickname ?? getPokemonName(b.pokemonId),
      scoreA: Math.round(scoreA),
      scoreB: Math.round(scoreB),
      winner: aWins ? "A" : "B",
    });
  }

  let result: SyncMatchResult;
  if (survivingA > survivingB) result = "TEAM_A_WIN";
  else if (survivingB > survivingA) result = "TEAM_B_WIN";
  else result = teamADamage >= teamBDamage ? "TEAM_A_WIN" : "TEAM_B_WIN";

  return {
    result,
    teamADamage,
    teamBDamage,
    survivingA,
    survivingB,
    replayJson: { rounds: logEntries, modifierId },
  };
}
