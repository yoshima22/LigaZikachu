"use server";

import { revalidatePath } from "next/cache";
import { GiftType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { defaultCombatRoleFor } from "@/lib/combat-roles";
import { runLeagueCombat, toLeagueMascot } from "@/lib/league-combat";
import { normalizeBattleDivision, validateBattleDivision } from "@/lib/battle-divisions";
import { MEGA_STONES } from "@/lib/mega-evolution";
import { DEFAULT_RUSH_REWARDS, RUSH_REWARD_PLANS, RUSH_RULE_PRESETS, RUSH_TYPES, type RushRewardBundle } from "./constants";

const PATH = "/combates/liga-rush";
const BATTLE_HOURS = [19, 19, 19];
const BATTLE_MINUTES = [0, 10, 20];

function brtDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function scheduledAtFor(date: string, slot: number) {
  // BRT é UTC-3 em todo o calendário atual.
  const hour = BATTLE_HOURS[slot - 1] ?? 20;
  const minute = BATTLE_MINUTES[slot - 1] ?? 0;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-03:00`);
}

function parseBrtAdminDate(value: string) {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}:00-03:00`);
}

async function requireContext(admin = false) {
  const session = await getAppSession();
  if (!session?.user) throw new Error("Não autenticado.");
  if (admin && !isAdmin(session.user.role)) throw new Error("Acesso restrito ao administrador.");
  const player = await getSessionPlayer(session.user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  return { session, player };
}

function parseRewards(value: unknown): RushRewardBundle[] {
  const source = Array.isArray(value) && value.every((entry) => entry && typeof entry === "object" && "rankFrom" in entry) ? value : DEFAULT_RUSH_REWARDS;
  return source.map((entry) => {
    const row = entry as Partial<RushRewardBundle>;
    return {
      key: String(row.key ?? `rank-${row.rankFrom ?? 1}`),
      rankFrom: Math.max(1, Math.trunc(Number(row.rankFrom) || 1)),
      ...(row.rankTo ? { rankTo: Math.max(1, Math.trunc(Number(row.rankTo))) } : {}),
      label: String(row.label ?? ""),
      estimatedValue: Math.min(6000, Math.max(0, Math.trunc(Number(row.estimatedValue) || 0))),
      coins: Math.max(0, Math.trunc(Number(row.coins) || 0)),
      food: Math.max(0, Math.trunc(Number(row.food) || 0)),
      sweet: Math.max(0, Math.trunc(Number(row.sweet) || 0)),
      creationDust: Math.max(0, Math.trunc(Number(row.creationDust) || 0)),
      eggs: row.eggs ?? [],
      shopItems: row.shopItems ?? [],
      randomMegaStone: Boolean(row.randomMegaStone),
    };
  }).sort((a, b) => a.rankFrom - b.rankFrom);
}

function rewardPlan(id?: string | null) {
  return RUSH_REWARD_PLANS.find((plan) => plan.id === id) ?? RUSH_REWARD_PLANS[0];
}

function ruleData(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mondayFor(date = new Date()) {
  const day = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(date) === "Sun" ? 0 : ["Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(date)) + 1);
  const current = new Date(`${brtDate(date)}T12:00:00-03:00`);
  current.setUTCDate(current.getUTCDate() - (day === 0 ? 6 : day - 1));
  return brtDate(current);
}

export async function ensureAutomaticRushLeague() {
  const open = await prisma.rushLeague.findFirst({ where: { status: { in: ["REGISTRATION", "ACTIVE"] } }, orderBy: { weekStart: "asc" } });
  if (open) {
    if (open.status === "REGISTRATION" && new Date() >= open.registrationEnds) return prisma.rushLeague.update({ where: { id: open.id }, data: { status: "ACTIVE" } });
    return open;
  }
  const monday = mondayFor();
  const weekNumber = Math.floor(new Date(`${monday}T12:00:00Z`).getTime() / 604800000);
  const preset = RUSH_RULE_PRESETS[Math.abs(weekNumber) % RUSH_RULE_PRESETS.length];
  const plan = RUSH_REWARD_PLANS[Math.abs(weekNumber) % RUSH_REWARD_PLANS.length];
  const requiredType = preset.requiredType === "ROTATING" ? RUSH_TYPES[Math.abs(weekNumber) % RUSH_TYPES.length] : preset.requiredType;
  const friday = addDaysDate(monday, 4);
  return prisma.rushLeague.upsert({ where: { weekKey: `RUSH-${monday}` }, update: {}, create: {
    name: preset.requiredType === "ROTATING" ? `${preset.name} · ${getPokemonTypeLabel(requiredType)}` : preset.name,
    weekKey: `RUSH-${monday}`, weekStart: new Date(`${monday}T00:00:00-03:00`), weekEnd: new Date(`${friday}T19:30:00-03:00`), registrationEnds: new Date(`${monday}T17:50:00-03:00`),
    division: normalizeBattleDivision("division" in preset && preset.division ? preset.division : "LIMITED"), teamSize: preset.teamSize, maxLevel: preset.maxLevel,
    requiredType: requiredType ?? null, uniqueSpecies: preset.uniqueSpecies,
    ruleJson: { preset: preset.id, rewardPlanId: plan.id, automatic: true, battlesPerDay: 3, battleTimes: ["19:00", "19:10", "19:20"], rewardTime: "19:30", freeRegistration: true },
    rewardsJson: plan.bundles as unknown as Prisma.InputJsonValue,
  } });
}

function addDaysDate(date: string, days: number) { const value = new Date(`${date}T12:00:00-03:00`); value.setUTCDate(value.getUTCDate() + days); return brtDate(value); }
function getPokemonTypeLabel(type?: string | null) { const labels: Record<string,string> = { normal:"Normal",fire:"Fogo",water:"Água",electric:"Elétrico",grass:"Planta",ice:"Gelo",fighting:"Lutador",poison:"Veneno",ground:"Terra",flying:"Voador",psychic:"Psíquico",bug:"Inseto",rock:"Pedra",ghost:"Fantasma",dragon:"Dragão",dark:"Sombrio",steel:"Aço",fairy:"Fada" }; return type ? labels[type] ?? type : "Livre"; }

export async function getRushDataAction() {
  const { session, player } = await requireContext();
  await ensureAutomaticRushLeague();
  const league = await prisma.rushLeague.findFirst({
    where: { status: { in: ["REGISTRATION", "ACTIVE"] } },
    orderBy: { weekStart: "desc" },
    include: { participants: { orderBy: [{ points: "desc" }, { wins: "desc" }, { damageDealt: "desc" }] }, dailyTeams: { where: { playerId: player.id } }, matches: { orderBy: [{ battleDate: "desc" }, { battleSlot: "asc" }] } },
  });
  const recent = await prisma.rushLeague.findMany({ where: { status: "FINISHED" }, orderBy: { weekEnd: "desc" }, take: 4 });
  if (!league) return { league: null, recent, isAdmin: isAdmin(session.user.role), presets: RUSH_RULE_PRESETS, rewardPlans: RUSH_REWARD_PLANS, divisions: [] };

  const playerIds = [...new Set(league.participants.map((p) => p.playerId).concat(league.matches.flatMap((m) => [m.playerAId, m.playerBId].filter(Boolean) as string[])))];
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, displayName: true } });
  const names = Object.fromEntries(players.map((p) => [p.id, p.displayName]));
  const joined = league.participants.some((p) => p.playerId === player.id);
  const mascots = joined ? await prisma.mascot.findMany({
    where: { playerId: player.id },
    orderBy: [{ level: "desc" }, { nickname: "asc" }],
    select: {
      id: true, pokemonId: true, nickname: true, level: true, preferredCombatRole: true,
      statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
      megaEvolvedAt: true, megaEvolvedFromPokemonId: true, primaryTypeOverride: true, secondaryTypeOverride: true,
    },
  }) : [];
  return JSON.parse(JSON.stringify({
    league,
    recent,
    isAdmin: isAdmin(session.user.role),
    playerId: player.id,
    joined,
    names,
    mascots: mascots.map((m) => ({ ...m, name: m.nickname ?? getPokemonName(m.pokemonId), types: m.primaryTypeOverride ? [m.primaryTypeOverride, m.secondaryTypeOverride].filter(Boolean) : getPokemonTypes(m.pokemonId) })),
    today: brtDate(),
    rewards: parseRewards(league.rewardsJson),
    rewardPlan: rewardPlan(String(ruleData(league.ruleJson).rewardPlanId ?? "")),
    rewardPlans: RUSH_REWARD_PLANS,
    presets: RUSH_RULE_PRESETS,
  }));
}

export async function joinRushLeagueAction(leagueId: string) {
  try {
    const { player } = await requireContext();
    const league = await prisma.rushLeague.findUnique({ where: { id: leagueId } });
    if (!league || league.status !== "REGISTRATION") return { error: "As inscrições desta edição estão encerradas." };
    if (new Date() > league.registrationEnds) return { error: "O prazo de inscrição já terminou." };
    await prisma.rushLeagueParticipant.upsert({ where: { leagueId_playerId: { leagueId, playerId: player.id } }, create: { leagueId, playerId: player.id }, update: {} });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao inscrever." }; }
}

export async function leaveRushLeagueAction(leagueId: string) {
  try {
    const { player } = await requireContext();
    const league = await prisma.rushLeague.findUnique({ where: { id: leagueId } });
    if (!league || league.status !== "REGISTRATION") return { error: "A inscrição não pode mais ser cancelada." };
    await prisma.rushLeagueParticipant.deleteMany({ where: { leagueId, playerId: player.id } });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao sair." }; }
}

export async function saveRushTeamAction(input: { leagueId: string; battleDate: string; battleSlot: number; mascotIds: string[] }) {
  try {
    const { player } = await requireContext();
    const league = await prisma.rushLeague.findUnique({ where: { id: input.leagueId }, include: { participants: { where: { playerId: player.id } } } });
    if (!league || !league.participants.length) return { error: "Você não está inscrito nesta edição." };
    if (!(["REGISTRATION", "ACTIVE"] as string[]).includes(league.status)) return { error: "Esta edição não aceita mais equipes." };
    if (input.battleSlot < 1 || input.battleSlot > 3) return { error: "Horário de combate inválido." };
    if (input.mascotIds.length !== league.teamSize || new Set(input.mascotIds).size !== league.teamSize) return { error: `Selecione exatamente ${league.teamSize} mascotes diferentes.` };
    const mascots = await prisma.mascot.findMany({ where: { id: { in: input.mascotIds }, playerId: player.id } });
    if (mascots.length !== league.teamSize) return { error: "Um ou mais mascotes não pertencem à sua conta." };
    if (league.maxLevel && mascots.some((m) => m.level > league.maxLevel!)) return { error: `Esta semana aceita apenas mascotes até o nível ${league.maxLevel}.` };
    if (league.requiredType && mascots.some((m) => !((m.primaryTypeOverride ? [m.primaryTypeOverride, m.secondaryTypeOverride].filter(Boolean) : getPokemonTypes(m.pokemonId)).includes(league.requiredType!)))) return { error: `Semana monotipo: todos precisam possuir o tipo ${league.requiredType}.` };
    const division = validateBattleDivision(mascots, normalizeBattleDivision(league.division));
    if (!division.valid) return { error: division.message };
    if (league.uniqueSpecies) {
      const otherTeams = await prisma.rushLeagueDailyTeam.findMany({ where: { leagueId: league.id, playerId: player.id }, select: { id: true, mascotIdsJson: true } });
      const current = await prisma.rushLeagueDailyTeam.findUnique({ where: { leagueId_playerId_battleDate_battleSlot: { leagueId: league.id, playerId: player.id, battleDate: input.battleDate, battleSlot: input.battleSlot } } });
      const otherIds = otherTeams.filter((t) => t.id !== current?.id).flatMap((t) => Array.isArray(t.mascotIdsJson) ? t.mascotIdsJson as string[] : []);
      const usedMascots = otherIds.length ? await prisma.mascot.findMany({ where: { id: { in: otherIds } }, select: { pokemonId: true } }) : [];
      const usedSpecies = new Set(usedMascots.map((m) => m.pokemonId));
      const repeated = mascots.find((m) => usedSpecies.has(m.pokemonId));
      if (repeated) return { error: `Semana sem repetição: ${repeated.nickname ?? getPokemonName(repeated.pokemonId)} já foi usado em outra equipe desta edição.` };
    }
    const roles = Object.fromEntries(mascots.map((m) => [m.id, m.preferredCombatRole ?? defaultCombatRoleFor(m)]));
    await prisma.rushLeagueDailyTeam.upsert({
      where: { leagueId_playerId_battleDate_battleSlot: { leagueId: league.id, playerId: player.id, battleDate: input.battleDate, battleSlot: input.battleSlot } },
      create: { leagueId: league.id, playerId: player.id, battleDate: input.battleDate, battleSlot: input.battleSlot, mascotIdsJson: input.mascotIds, rolesJson: roles, lockedAt: new Date() },
      update: { mascotIdsJson: input.mascotIds, rolesJson: roles, lockedAt: new Date() },
    });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível salvar a equipe." }; }
}

export async function adminCreateRushLeagueAction(input: { name: string; weekKey: string; weekStart: string; weekEnd: string; registrationEnds: string; division: string; teamSize: number; maxLevel?: number | null; requiredType?: string | null; uniqueSpecies: boolean; preset?: string; rewardPlanId?: string; rewards?: RushRewardBundle[] }) {
  try {
    await requireContext(true);
    if (!input.name.trim() || !input.weekKey.trim()) return { error: "Informe nome e identificador da semana." };
    const plan = rewardPlan(input.rewardPlanId);
    const rewards = parseRewards(input.rewards ?? plan.bundles);
    const league = await prisma.rushLeague.create({ data: {
      name: input.name.trim(), weekKey: input.weekKey.trim(), weekStart: parseBrtAdminDate(input.weekStart), weekEnd: parseBrtAdminDate(input.weekEnd), registrationEnds: parseBrtAdminDate(input.registrationEnds),
      division: normalizeBattleDivision(input.division), teamSize: Math.min(6, Math.max(1, Math.trunc(input.teamSize))), maxLevel: input.maxLevel ? Math.max(1, Math.trunc(input.maxLevel)) : null,
      requiredType: input.requiredType?.trim().toLowerCase() || null, uniqueSpecies: Boolean(input.uniqueSpecies), ruleJson: { preset: input.preset ?? "CUSTOM", rewardPlanId: plan.id, battlesPerDay: 3, battleTimes: ["19:00", "19:10", "19:20"], rewardTime: "19:30", freeRegistration: true }, rewardsJson: rewards as unknown as Prisma.InputJsonValue,
    } });
    revalidatePath(PATH);
    return { success: true, leagueId: league.id };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao criar a edição Rush." }; }
}

export async function adminUpdateRushLeagueAction(input: { leagueId: string; name: string; weekStart: string; weekEnd: string; registrationEnds: string; division: string; teamSize: number; maxLevel?: number | null; requiredType?: string | null; uniqueSpecies: boolean; preset?: string; rewardPlanId?: string }) {
  try {
    await requireContext(true);
    const current = await prisma.rushLeague.findUnique({ where: { id: input.leagueId } });
    if (!current) return { error: "Liga não encontrada." };
    const plan = rewardPlan(input.rewardPlanId);
    await prisma.rushLeague.update({ where: { id: input.leagueId }, data: {
      name: input.name.trim(), weekStart: parseBrtAdminDate(input.weekStart), weekEnd: parseBrtAdminDate(input.weekEnd), registrationEnds: parseBrtAdminDate(input.registrationEnds),
      division: normalizeBattleDivision(input.division), teamSize: Math.min(6, Math.max(1, Math.trunc(input.teamSize))), maxLevel: input.maxLevel ? Math.max(1, Math.trunc(input.maxLevel)) : null,
      requiredType: input.requiredType?.trim().toLowerCase() || null, uniqueSpecies: Boolean(input.uniqueSpecies),
      ruleJson: { ...ruleData(current.ruleJson), preset: input.preset ?? "CUSTOM", rewardPlanId: plan.id, battlesPerDay: 3, battleTimes: ["19:00", "19:10", "19:20"], rewardTime: "19:30", freeRegistration: true },
      rewardsJson: plan.bundles as unknown as Prisma.InputJsonValue,
    } });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao editar a edição Rush." }; }
}

function circlePairings(ids: string[], roundIndex: number) {
  const pool: (string | null)[] = [...ids];
  if (pool.length % 2) pool.push(null);
  if (pool.length < 2) return [] as Array<[string, string | null]>;
  const fixed = pool[0];
  let rest = pool.slice(1);
  for (let i = 0; i < roundIndex % Math.max(1, pool.length - 1); i++) rest = [rest[rest.length - 1], ...rest.slice(0, -1)];
  const arranged = [fixed, ...rest];
  return Array.from({ length: arranged.length / 2 }, (_, i) => [arranged[i]!, arranged[arranged.length - 1 - i]] as [string, string | null]);
}

export async function adminOpenRushLeagueAction(leagueId: string) {
  try { await requireContext(true); await prisma.rushLeague.update({ where: { id: leagueId }, data: { status: "ACTIVE" } }); revalidatePath(PATH); return { success: true }; }
  catch (error) { return { error: error instanceof Error ? error.message : "Falha ao abrir liga." }; }
}

export async function adminGenerateRushDayAction(leagueId: string, battleDate: string, automationSecret?: string) {
  try {
    if (!automationSecret || automationSecret !== process.env.CRON_SECRET) await requireContext(true);
    const league = await prisma.rushLeague.findUnique({ where: { id: leagueId }, include: { participants: { orderBy: { joinedAt: "asc" } } } });
    if (!league) return { error: "Liga não encontrada." };
    if (league.participants.length < 2) return { error: "São necessários pelo menos 2 inscritos." };
    const dayOffset = Math.max(0, Math.round((new Date(`${battleDate}T12:00:00-03:00`).getTime() - league.weekStart.getTime()) / 86400000));
    const rows: Prisma.RushLeagueMatchCreateManyInput[] = [];
    for (let slot = 1; slot <= 3; slot++) {
      const pairs = circlePairings(league.participants.map((p) => p.playerId), dayOffset * 3 + slot - 1);
      for (const [a, b] of pairs) rows.push({ leagueId, roundNumber: dayOffset * 3 + slot, battleDate, battleSlot: slot, scheduledAt: scheduledAtFor(battleDate, slot), playerAId: a, playerBId: b, status: b ? "SCHEDULED" : "BYE" });
    }
    await prisma.rushLeagueMatch.createMany({ data: rows, skipDuplicates: true });
    revalidatePath(PATH);
    return { success: true, matches: rows.length };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao gerar rodadas." }; }
}

export async function adminRunRushDayAction(leagueId: string, battleDate: string, maxSlot = 3, automationSecret?: string) {
  try {
    if (!automationSecret || automationSecret !== process.env.CRON_SECRET) await requireContext(true);
    const league = await prisma.rushLeague.findUnique({ where: { id: leagueId } });
    if (!league) return { error: "Liga não encontrada." };
    const matches = await prisma.rushLeagueMatch.findMany({ where: { leagueId, battleDate, battleSlot: { lte: Math.min(3, Math.max(1, maxSlot)) }, status: "SCHEDULED", playerBId: { not: null } }, orderBy: { battleSlot: "asc" } });
    let resolved = 0, skipped = 0;
    for (const match of matches) {
      const teams = await prisma.rushLeagueDailyTeam.findMany({ where: { leagueId, battleDate, battleSlot: match.battleSlot, playerId: { in: [match.playerAId, match.playerBId!] } } });
      const teamA = teams.find((t) => t.playerId === match.playerAId); const teamB = teams.find((t) => t.playerId === match.playerBId);
      if (!teamA || !teamB) { skipped++; continue; }
      const idsA = teamA.mascotIdsJson as string[]; const idsB = teamB.mascotIdsJson as string[];
      const mascots = await prisma.mascot.findMany({ where: { id: { in: [...idsA, ...idsB] } } });
      const map = new Map(mascots.map((m) => [m.id, m]));
      const rolesA = (teamA.rolesJson ?? {}) as Record<string, string>; const rolesB = (teamB.rolesJson ?? {}) as Record<string, string>;
      const a = idsA.map((id, i) => toLeagueMascot(map.get(id)!, i + 1, rolesA[id]));
      const b = idsB.map((id, i) => toLeagueMascot(map.get(id)!, i + 1, rolesB[id]));
      const result = runLeagueCombat(a, b);
      const winnerId = result.winner === "A" ? match.playerAId : result.winner === "B" ? match.playerBId : null;
      const loserId = winnerId ? (winnerId === match.playerAId ? match.playerBId : match.playerAId) : null;
      await prisma.$transaction(async (tx) => {
        await tx.rushLeagueMatch.update({ where: { id: match.id }, data: { status: "RESOLVED", winnerId, loserId, isDraw: result.winner === "DRAW", playerASurvivors: result.teamASurvivors, playerBSurvivors: result.teamBSurvivors, playerADamageDealt: result.teamADamageDealt, playerBDamageDealt: result.teamBDamageDealt, replayJson: result.log as unknown as Prisma.InputJsonValue, resultJson: { rounds: result.rounds, lineupA: result.lineupA, lineupB: result.lineupB } as unknown as Prisma.InputJsonValue, resolvedAt: new Date() } });
        for (const side of [{ id: match.playerAId, won: winnerId === match.playerAId, lost: loserId === match.playerAId, survivors: result.teamASurvivors, dealt: result.teamADamageDealt, taken: result.teamBDamageDealt }, { id: match.playerBId!, won: winnerId === match.playerBId, lost: loserId === match.playerBId, survivors: result.teamBSurvivors, dealt: result.teamBDamageDealt, taken: result.teamADamageDealt }]) {
          await tx.rushLeagueParticipant.update({ where: { leagueId_playerId: { leagueId, playerId: side.id } }, data: { points: { increment: side.won ? 3 : (!side.lost ? 1 : 0) }, wins: { increment: side.won ? 1 : 0 }, losses: { increment: side.lost ? 1 : 0 }, draws: { increment: !side.won && !side.lost ? 1 : 0 }, survivorsScore: { increment: side.survivors }, damageDealt: { increment: side.dealt }, damageTaken: { increment: side.taken } } });
        }
      });
      resolved++;
    }
    revalidatePath(PATH);
    return { success: true, resolved, skipped };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao executar os combates." }; }
}

export async function adminFinishRushLeagueAction(leagueId: string, automationSecret?: string) {
  try {
    if (!automationSecret || automationSecret !== process.env.CRON_SECRET) await requireContext(true);
    const league = await prisma.rushLeague.findUnique({ where: { id: leagueId }, include: { participants: true } });
    if (!league) return { error: "Liga não encontrada." };
    if (league.rewardsGrantedAt) return { error: "As recompensas desta edição já foram distribuídas." };
    const ranking = [...league.participants].sort((a, b) => b.points - a.points || b.wins - a.wins || b.survivorsScore - a.survivorsScore || b.damageDealt - a.damageDealt || a.damageTaken - b.damageTaken);
    const rewards = parseRewards(league.rewardsJson);
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < ranking.length; index++) {
        const participant = ranking[index]; const rank = index + 1; const reward = rewards.find((r) => rank >= r.rankFrom && rank <= (r.rankTo ?? r.rankFrom));
        await tx.rushLeagueParticipant.update({ where: { id: participant.id }, data: { finalRank: rank, rewardGranted: Boolean(reward) } });
        if (!reward) continue;
        const shopItems = [...(reward.shopItems ?? [])].map(({ type, quantity }) => ({ type, quantity }));
        if (reward.randomMegaStone) {
          const stone = MEGA_STONES[Math.floor(Math.random() * MEGA_STONES.length)];
          shopItems.push({ type: stone.type, quantity: 1 });
        }
        await tx.playerGift.create({ data: {
          playerId: participant.playerId,
          type: GiftType.CUSTOM,
          title: `Liga Rush · ${rank}º lugar`,
          description: reward.label,
          payload: { rewardKind: "TOURNAMENT_BOX", coins: reward.coins ?? 0, food: reward.food ?? 0, sweet: reward.sweet ?? 0, creationDust: reward.creationDust ?? 0, eggs: reward.eggs ?? [], shopItems, origin: `Liga Rush ${league.weekKey}` } as Prisma.InputJsonValue,
        } });
      }
      await tx.rushLeague.update({ where: { id: leagueId }, data: { status: "FINISHED", championPlayerId: ranking[0]?.playerId, rewardsGrantedAt: new Date() } });
    });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao encerrar a Rush." }; }
}

export async function runRushLeagueAutomation(secret: string) {
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return { error: "Unauthorized" };
  const league = await ensureAutomaticRushLeague();
  const now = new Date();
  const date = brtDate(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(now);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) || date < brtDate(league.weekStart) || date > brtDate(league.weekEnd)) return { success: true, action: "idle", leagueId: league.id };
  if (clock >= "18:55") await adminGenerateRushDayAction(league.id, date, secret);
  const maxSlot = clock >= "19:20" ? 3 : clock >= "19:10" ? 2 : clock >= "19:00" ? 1 : 0;
  const battles = maxSlot ? await adminRunRushDayAction(league.id, date, maxSlot, secret) : { success: true, resolved: 0, skipped: 0 };
  if (weekday === "Fri" && clock >= "19:30") {
    const unresolved = await prisma.rushLeagueMatch.count({ where: { leagueId: league.id, status: "SCHEDULED" } });
    if (unresolved === 0) await adminFinishRushLeagueAction(league.id, secret);
  }
  return { success: true, action: "processed", leagueId: league.id, battles };
}
