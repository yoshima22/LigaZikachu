"use server";

import { revalidatePath } from "next/cache";
import { GiftType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isStaff } from "@/lib/auth/permissions";
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

function validateRushWeek(startValue: string, endValue: string) {
  const start = parseBrtAdminDate(startValue); const end = parseBrtAdminDate(endValue);
  const startDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(start);
  const endDay = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(end);
  if (startDay !== "Mon" || endDay !== "Fri") return { error: "A Liga Rush deve começar em uma segunda-feira e terminar na sexta-feira da mesma semana." };
  const days = Math.round((new Date(`${brtDate(end)}T12:00:00-03:00`).getTime() - new Date(`${brtDate(start)}T12:00:00-03:00`).getTime()) / 86400000);
  if (days !== 4) return { error: "Escolha a sexta-feira imediatamente posterior à segunda-feira inicial." };
  return { start, end, registrationEnds: new Date(`${brtDate(start)}T07:50:00-03:00`) };
}

async function requireContext(admin = false) {
  const session = await getAppSession();
  if (!session?.user) throw new Error("Não autenticado.");
  if (admin && !isStaff(session.user.role)) throw new Error("Acesso restrito à equipe de administração.");
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
      estimatedValue: Math.max(0, Math.trunc(Number(row.estimatedValue) || 0)),
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

type RushRepeatMode = "WEEKLY_UNIQUE" | "DAILY_UNIQUE" | "UNRESTRICTED";
function repeatMode(rules: Record<string, unknown>, legacyUnique: boolean): RushRepeatMode {
  const value = String(rules.repeatMode ?? "");
  if (value === "DAILY_UNIQUE" || value === "UNRESTRICTED" || value === "WEEKLY_UNIQUE") return value;
  return legacyUnique ? "WEEKLY_UNIQUE" : "UNRESTRICTED";
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
    const bracketAt = new Date(`${brtDate(open.weekStart)}T08:00:00-03:00`);
    if (open.status === "REGISTRATION" && new Date() >= bracketAt) {
      const participants = await prisma.rushLeagueParticipant.count({ where: { leagueId: open.id } });
      if (participants < 4) return prisma.rushLeague.update({ where: { id: open.id }, data: { status: "CANCELLED", ruleJson: { ...ruleData(open.ruleJson), cancellationReason: `Edição cancelada: eram necessários pelo menos 4 inscritos, mas houve apenas ${participants}.`, cancelledAutomatically: true } } });
      return prisma.rushLeague.update({ where: { id: open.id }, data: { status: "ACTIVE" } });
    }
    return open;
  }
  let monday = mondayFor();
  const currentDeadline = new Date(`${monday}T07:50:00-03:00`);
  if (new Date() > currentDeadline) monday = addDaysDate(monday, 7);
  const weekNumber = Math.floor(new Date(`${monday}T12:00:00Z`).getTime() / 604800000);
  const preset = RUSH_RULE_PRESETS[Math.abs(weekNumber) % RUSH_RULE_PRESETS.length];
  const plan = RUSH_REWARD_PLANS[Math.abs(weekNumber) % RUSH_REWARD_PLANS.length];
  const settings = await prisma.siteContent.findUnique({ where: { id: "rush-settings" }, select: { data: true } });
  const configuredCap = Number(ruleData(settings?.data).defaultRewardCap) || 6000;
  const requiredType = preset.requiredType === "ROTATING" ? RUSH_TYPES[Math.abs(weekNumber) % RUSH_TYPES.length] : preset.requiredType;
  const monotype = Boolean(requiredType);
  const teamSize = monotype && weekNumber % 3 !== 0 ? Math.min(2, preset.teamSize) : preset.teamSize;
  const automaticRepeatMode: RushRepeatMode = monotype && weekNumber % 4 !== 0 ? "UNRESTRICTED" : preset.uniqueSpecies ? "WEEKLY_UNIQUE" : weekNumber % 3 === 0 ? "DAILY_UNIQUE" : "UNRESTRICTED";
  const personalities = ["LOYAL", "PROUD", "MISCHIEVOUS", "LAZY", "COMPETITIVE", "DRAMATIC", "PLAYFUL", "ELECTRIC", "TIMID", "CHAOTIC"];
  const requiredPersonality = Math.abs(weekNumber) % 7 === 0 ? personalities[Math.abs(weekNumber) % personalities.length] : null;
  const friday = addDaysDate(monday, 4);
  return prisma.rushLeague.upsert({ where: { weekKey: `RUSH-${monday}` }, update: {}, create: {
    name: preset.requiredType === "ROTATING" ? `${preset.name} · ${getPokemonTypeLabel(requiredType)}` : preset.name,
    weekKey: `RUSH-${monday}`, weekStart: new Date(`${monday}T00:00:00-03:00`), weekEnd: new Date(`${friday}T19:30:00-03:00`), registrationEnds: new Date(`${monday}T07:50:00-03:00`),
    division: normalizeBattleDivision(preset.maxLevel <= 45 ? "UNLIMITED" : ("division" in preset && preset.division ? preset.division : "LIMITED")), teamSize, maxLevel: preset.maxLevel,
    requiredType: requiredType ?? null, uniqueSpecies: automaticRepeatMode === "WEEKLY_UNIQUE",
    ruleJson: { preset: preset.id, rewardPlanId: plan.id, rewardCap: configuredCap, repeatMode: automaticRepeatMode, requiredPersonality, automatic: true, automaticRuleNotes: "Semanas monotipo tendem a ter equipes menores e repetição mais flexível; a combinação não é obrigatória.", battlesPerDay: 3, battleTimes: ["19:00", "19:10", "19:20"], rewardTime: "19:30", bracketRevealTime: "08:00", freeRegistration: true },
    rewardsJson: scaleRewardPlan(plan.id, configuredCap) as unknown as Prisma.InputJsonValue,
  } });
}

function addDaysDate(date: string, days: number) { const value = new Date(`${date}T12:00:00-03:00`); value.setUTCDate(value.getUTCDate() + days); return brtDate(value); }
function getPokemonTypeLabel(type?: string | null) { const labels: Record<string,string> = { normal:"Normal",fire:"Fogo",water:"Água",electric:"Elétrico",grass:"Planta",ice:"Gelo",fighting:"Lutador",poison:"Veneno",ground:"Terra",flying:"Voador",psychic:"Psíquico",bug:"Inseto",rock:"Pedra",ghost:"Fantasma",dragon:"Dragão",dark:"Sombrio",steel:"Aço",fairy:"Fada" }; return type ? labels[type] ?? type : "Livre"; }

export async function getRushDataAction() {
  const { session, player } = await requireContext();
  await ensureAutomaticRushLeague();
  const league = await prisma.rushLeague.findFirst({
    where: { status: { in: ["REGISTRATION", "ACTIVE"] } },
    orderBy: { weekStart: "asc" },
    include: { participants: { orderBy: [{ points: "desc" }, { wins: "desc" }, { survivorsScore: "desc" }, { damageDealt: "desc" }, { damageTaken: "asc" }] }, dailyTeams: { where: { playerId: player.id } }, matches: { orderBy: [{ battleDate: "desc" }, { battleSlot: "asc" }] } },
  });
  const recent = await prisma.rushLeague.findMany({ where: { status: "FINISHED" }, orderBy: { weekEnd: "desc" }, take: 4 });
  const cancellation = await prisma.rushLeague.findFirst({ where: { status: "CANCELLED" }, orderBy: { updatedAt: "desc" }, select: { name: true, weekKey: true, ruleJson: true, updatedAt: true } });
  if (!league) return { league: null, recent, cancellation, isAdmin: isStaff(session.user.role), presets: RUSH_RULE_PRESETS, rewardPlans: RUSH_REWARD_PLANS, divisions: [] };

  const playerIds = [...new Set(league.participants.map((p) => p.playerId).concat(league.matches.flatMap((m) => [m.playerAId, m.playerBId].filter(Boolean) as string[])))];
  const players = await prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, displayName: true } });
  const names = Object.fromEntries(players.map((p) => [p.id, p.displayName]));
  const joined = league.participants.some((p) => p.playerId === player.id);
  const staff = isStaff(session.user.role);
  const mascots = joined || staff ? await prisma.mascot.findMany({
    where: { playerId: player.id },
    orderBy: [{ level: "desc" }, { nickname: "asc" }],
    select: {
      id: true, pokemonId: true, nickname: true, level: true, preferredCombatRole: true,
      personality: true,
      statForce: true, statAgility: true, statInstinct: true, statVitality: true, statCharisma: true,
      megaEvolvedAt: true, megaEvolvedFromPokemonId: true, primaryTypeOverride: true, secondaryTypeOverride: true,
    },
  }) : [];
  const weekHighlights = buildRushHighlights(league.matches, names);
  const currentDate = brtDate();
  const firstBattleDate = brtDate(league.weekStart);
  const lastBattleDate = brtDate(league.weekEnd);
  const teamDate = currentDate < firstBattleDate ? firstBattleDate : currentDate > lastBattleDate ? lastBattleDate : currentDate;
  return JSON.parse(JSON.stringify({
    league,
    recent,
    isAdmin: staff,
    playerId: player.id,
    joined,
    names,
    mascots: mascots.map((m) => ({ ...m, name: m.nickname ?? getPokemonName(m.pokemonId), types: m.primaryTypeOverride ? [m.primaryTypeOverride, m.secondaryTypeOverride].filter(Boolean) : getPokemonTypes(m.pokemonId) })),
    today: teamDate,
    rewards: parseRewards(league.rewardsJson),
    rewardPlan: rewardPlan(String(ruleData(league.ruleJson).rewardPlanId ?? "")),
    rewardPlans: RUSH_REWARD_PLANS,
    presets: RUSH_RULE_PRESETS,
    cancellation,
    weekHighlights,
  }));
}

function buildRushHighlights(matches: Array<{ replayJson: unknown; resultJson: unknown; winnerId: string | null }>, names: Record<string,string>) {
  type Stat = { id:string; name:string; pokemonId:number; ownerId:string; ownerName:string; role:string; damageDealt:number; damageTaken:number; kosDealt:number; heals:number; attackActions:number; matches:number; wins:number };
  const stats = new Map<string,Stat>();
  const blank = (turn:any, actor=true):Stat => ({ id:actor?turn.actorId:turn.targetId,name:actor?turn.actorName:turn.targetName,pokemonId:(actor?turn.actorPokemonId:turn.targetPokemonId)??0,ownerId:(actor?turn.actorOwnerId:turn.targetOwnerId)??"",ownerName:names[(actor?turn.actorOwnerId:turn.targetOwnerId)??""]??"Jogador",role:(actor?turn.actorRole:turn.targetRole)??"",damageDealt:0,damageTaken:0,kosDealt:0,heals:0,attackActions:0,matches:0,wins:0});
  for (const match of matches) { if (!Array.isArray(match.replayJson)) continue; const seen=new Set<string>(); const hp=new Map<string,number>(); const result=ruleData(match.resultJson); for(const fighter of [...(Array.isArray(result.lineupA)?result.lineupA:[]),...(Array.isArray(result.lineupB)?result.lineupB:[])] as any[])if(fighter?.id)hp.set(fighter.id,Number(fighter.hp)||0); for(const turn of match.replayJson as any[]){ if(!turn?.actorId||!turn?.targetId)continue; const actor=stats.get(turn.actorId)??blank(turn,true); const target=stats.get(turn.targetId)??blank(turn,false); seen.add(turn.actorId);seen.add(turn.targetId); if(turn.action==="ATTACK"){actor.attackActions++;const damage=Math.max(0,Number(turn.damage)||0);actor.damageDealt+=damage;target.damageTaken+=damage;const before=hp.get(turn.targetId)??0;const after=Math.max(0,before-damage);hp.set(turn.targetId,after);if(before>0&&after<=0)actor.kosDealt++;} if((turn.action==="HEAL"||turn.action==="DEFEND")&&String(turn.effect??"").toLowerCase().includes("cur"))actor.heals++; stats.set(actor.id,actor);stats.set(target.id,target);} for(const id of seen){const stat=stats.get(id);if(stat){stat.matches++;if(stat.ownerId===match.winnerId)stat.wins++;}} }
  return [...stats.values()];
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
    if (input.mascotIds.length < 1 || input.mascotIds.length > league.teamSize || new Set(input.mascotIds).size !== input.mascotIds.length) return { error: `Selecione entre 1 e ${league.teamSize} mascotes diferentes.` };
    const mascots = await prisma.mascot.findMany({ where: { id: { in: input.mascotIds }, playerId: player.id } });
    if (mascots.length !== input.mascotIds.length) return { error: "Um ou mais mascotes não pertencem à sua conta." };
    if (league.maxLevel && mascots.some((m) => m.level > league.maxLevel!)) return { error: `Esta semana aceita apenas mascotes até o nível ${league.maxLevel}.` };
    if (league.requiredType && mascots.some((m) => !((m.primaryTypeOverride ? [m.primaryTypeOverride, m.secondaryTypeOverride].filter(Boolean) : getPokemonTypes(m.pokemonId)).includes(league.requiredType!)))) return { error: `Semana monotipo: todos precisam possuir o tipo ${league.requiredType}.` };
    const division = validateBattleDivision(mascots, normalizeBattleDivision(league.division));
    if (!division.valid) return { error: division.message };
    const rules = ruleData(league.ruleJson);
    const requiredPersonality = typeof rules.requiredPersonality === "string" && rules.requiredPersonality ? rules.requiredPersonality : null;
    if (requiredPersonality && mascots.some((m) => m.personality !== requiredPersonality)) return { error: `Esta semana aceita apenas mascotes de personalidade ${requiredPersonality}.` };
    const repetition = repeatMode(rules, league.uniqueSpecies);
    if (repetition !== "UNRESTRICTED") {
      const otherTeams = await prisma.rushLeagueDailyTeam.findMany({ where: { leagueId: league.id, playerId: player.id, ...(repetition === "DAILY_UNIQUE" ? { battleDate: input.battleDate } : {}) }, select: { id: true, mascotIdsJson: true } });
      const current = await prisma.rushLeagueDailyTeam.findUnique({ where: { leagueId_playerId_battleDate_battleSlot: { leagueId: league.id, playerId: player.id, battleDate: input.battleDate, battleSlot: input.battleSlot } } });
      const otherIds = otherTeams.filter((t) => t.id !== current?.id).flatMap((t) => Array.isArray(t.mascotIdsJson) ? t.mascotIdsJson as string[] : []);
      const usedMascotIds = new Set(otherIds);
      const repeated = mascots.find((m) => usedMascotIds.has(m.id));
      if (repeated) return { error: `${repetition === "DAILY_UNIQUE" ? "Sem repetição no dia" : "Sem repetição na semana"}: ${repeated.nickname ?? getPokemonName(repeated.pokemonId)} já foi usado em outra equipe.` };
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

export async function adminCreateRushLeagueAction(input: { name: string; weekKey: string; weekStart: string; weekEnd: string; registrationEnds: string; division: string; teamSize: number; maxLevel?: number | null; requiredType?: string | null; uniqueSpecies: boolean; repeatMode?: RushRepeatMode; requiredPersonality?: string | null; preset?: string; rewardPlanId?: string; rewardCap?: number; rewards?: RushRewardBundle[] }) {
  try {
    await requireContext(true);
    if (!input.name.trim() || !input.weekKey.trim()) return { error: "Informe nome e identificador da semana." };
    const dates = validateRushWeek(input.weekStart, input.weekEnd); if ("error" in dates) return dates;
    const plan = rewardPlan(input.rewardPlanId);
    const rewards = parseRewards(input.rewards ?? plan.bundles);
    const league = await prisma.rushLeague.create({ data: {
      name: input.name.trim(), weekKey: input.weekKey.trim(), weekStart: dates.start, weekEnd: dates.end, registrationEnds: dates.registrationEnds,
      division: normalizeBattleDivision(input.division), teamSize: Math.min(6, Math.max(1, Math.trunc(input.teamSize))), maxLevel: input.maxLevel ? Math.max(1, Math.trunc(input.maxLevel)) : null,
      requiredType: input.requiredType?.trim().toLowerCase() || null, uniqueSpecies: input.repeatMode === "WEEKLY_UNIQUE" || Boolean(input.uniqueSpecies), ruleJson: { preset: input.preset ?? "CUSTOM", rewardPlanId: plan.id, rewardCap: Math.max(1000, input.rewardCap ?? 6000), repeatMode: input.repeatMode ?? (input.uniqueSpecies ? "WEEKLY_UNIQUE" : "UNRESTRICTED"), requiredPersonality: input.requiredPersonality || null, battlesPerDay: 3, battleTimes: ["19:00", "19:10", "19:20"], rewardTime: "19:30", bracketRevealTime: "08:00", freeRegistration: true }, rewardsJson: rewards as unknown as Prisma.InputJsonValue,
    } });
    revalidatePath(PATH);
    return { success: true, leagueId: league.id };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao criar a edição Rush." }; }
}

export async function adminUpdateRushLeagueAction(input: { leagueId: string; name: string; weekStart: string; weekEnd: string; registrationEnds: string; division: string; teamSize: number; maxLevel?: number | null; requiredType?: string | null; uniqueSpecies: boolean; repeatMode?: RushRepeatMode; requiredPersonality?: string | null; preset?: string; rewardPlanId?: string; rewardCap?: number }) {
  try {
    await requireContext(true);
    const current = await prisma.rushLeague.findUnique({ where: { id: input.leagueId } });
    if (!current) return { error: "Liga não encontrada." };
    const dates = validateRushWeek(input.weekStart, input.weekEnd); if ("error" in dates) return dates;
    const plan = rewardPlan(input.rewardPlanId);
    await prisma.rushLeague.update({ where: { id: input.leagueId }, data: {
      name: input.name.trim(), weekStart: dates.start, weekEnd: dates.end, registrationEnds: dates.registrationEnds,
      division: normalizeBattleDivision(input.division), teamSize: Math.min(6, Math.max(1, Math.trunc(input.teamSize))), maxLevel: input.maxLevel ? Math.max(1, Math.trunc(input.maxLevel)) : null,
      requiredType: input.requiredType?.trim().toLowerCase() || null, uniqueSpecies: input.repeatMode === "WEEKLY_UNIQUE" || Boolean(input.uniqueSpecies),
      ruleJson: { ...ruleData(current.ruleJson), preset: input.preset ?? "CUSTOM", rewardPlanId: plan.id, rewardCap: Math.max(1000, input.rewardCap ?? 6000), repeatMode: input.repeatMode ?? (input.uniqueSpecies ? "WEEKLY_UNIQUE" : "UNRESTRICTED"), requiredPersonality: input.requiredPersonality || null, battlesPerDay: 3, battleTimes: ["19:00", "19:10", "19:20"], rewardTime: "19:30", bracketRevealTime: "08:00", freeRegistration: true },
      rewardsJson: plan.bundles as unknown as Prisma.InputJsonValue,
    } });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao editar a edição Rush." }; }
}

function scaleRewardPlan(planId: string | undefined, cap: number) {
  const plan = rewardPlan(planId); const safeCap = Math.max(1000, Math.trunc(cap)); const base = Math.max(...plan.bundles.map((b) => b.estimatedValue), 1); const factor = safeCap / base;
  return plan.bundles.map((bundle) => { const coins=bundle.coins?Math.round(bundle.coins*factor):undefined; const label=coins&&bundle.coins?bundle.label.replace(`${bundle.coins.toLocaleString("pt-BR")} ZC`,`${coins.toLocaleString("pt-BR")} ZC`):bundle.label; return { ...bundle,label,estimatedValue:Math.round(bundle.estimatedValue*factor),coins }; });
}

export async function adminSaveRushRewardsAction(leagueId: string, rewards: RushRewardBundle[], rewardCap: number, saveAsDefault = false) {
  try {
    const { session } = await requireContext(true); const league = await prisma.rushLeague.findUnique({ where: { id: leagueId } }); if (!league) return { error: "Liga não encontrada." };
    const parsed = parseRewards(rewards); const rules = ruleData(league.ruleJson);
    await prisma.rushLeague.update({ where: { id: leagueId }, data: { rewardsJson: parsed as unknown as Prisma.InputJsonValue, ruleJson: { ...rules, rewardCap: Math.max(1000, Math.trunc(rewardCap)) } } });
    if (saveAsDefault) await prisma.siteContent.upsert({ where: { id: "rush-settings" }, create: { id: "rush-settings", data: { defaultRewardCap: Math.max(1000, Math.trunc(rewardCap)) }, updatedBy: session.user.id }, update: { data: { defaultRewardCap: Math.max(1000, Math.trunc(rewardCap)) }, updatedBy: session.user.id } });
    revalidatePath(PATH); return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao salvar recompensas." }; }
}

export async function adminRegenerateRushRewardsAction(leagueId: string, planId: string, rewardCap: number) {
  try { await requireContext(true); const league = await prisma.rushLeague.findUnique({ where: { id: leagueId } }); if (!league) return { error: "Liga não encontrada." }; const rules = ruleData(league.ruleJson); const rewards=scaleRewardPlan(planId,rewardCap); await prisma.rushLeague.update({ where: { id: leagueId }, data: { rewardsJson: rewards as unknown as Prisma.InputJsonValue, ruleJson: { ...rules, rewardPlanId: planId, rewardCap: Math.max(1000, Math.trunc(rewardCap)) } } }); revalidatePath(PATH); return { success: true, rewards }; }
  catch (error) { return { error: error instanceof Error ? error.message : "Falha ao gerar recompensas." }; }
}

export async function adminRerollRushRulesAction(leagueId: string) {
  try {
    await requireContext(true); const league = await prisma.rushLeague.findUnique({ where: { id: leagueId } }); if (!league) return { error: "Liga não encontrada." };
    const currentPreset = String(ruleData(league.ruleJson).preset ?? "");
    const alternatives = RUSH_RULE_PRESETS.filter((candidate) => candidate.id !== currentPreset);
    const pool = alternatives.length ? alternatives : RUSH_RULE_PRESETS;
    const preset = pool[Math.floor(Math.random() * pool.length)]; const requiredType = preset.requiredType === "ROTATING" ? RUSH_TYPES[Math.floor(Math.random() * RUSH_TYPES.length)] : preset.requiredType;
    const monotype = Boolean(requiredType); const teamSize = monotype && Math.random() < .7 ? Math.min(2, preset.teamSize) : preset.teamSize; const repetition: RushRepeatMode = monotype && Math.random() < .7 ? "UNRESTRICTED" : preset.uniqueSpecies ? "WEEKLY_UNIQUE" : Math.random() < .35 ? "DAILY_UNIQUE" : "UNRESTRICTED";
    const rules = ruleData(league.ruleJson); await prisma.rushLeague.update({ where: { id: leagueId }, data: { name: requiredType ? `${preset.name} · ${getPokemonTypeLabel(requiredType)}` : preset.name, maxLevel: preset.maxLevel, teamSize, division: preset.maxLevel <= 45 ? "UNLIMITED" : normalizeBattleDivision("division" in preset && preset.division ? preset.division : "LIMITED"), requiredType: requiredType ?? null, uniqueSpecies: repetition === "WEEKLY_UNIQUE", ruleJson: { ...rules, preset: preset.id, repeatMode: repetition, requiredPersonality: null, automaticRuleNotes: "Semanas monotipo tendem a ter equipes menores e repetição mais flexível; a combinação não é obrigatória." } } });
    const updated=await prisma.rushLeague.findUnique({where:{id:leagueId}}); revalidatePath(PATH); return { success: true, league: updated };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao sortear novas regras." }; }
}

export async function adminDebugRushTeamAction(leagueId:string, mascotIds:string[]) {
  try {
    const { player }=await requireContext(true); const league=await prisma.rushLeague.findUnique({where:{id:leagueId}}); if(!league)return{error:"Liga não encontrada."};
    const mascots=await prisma.mascot.findMany({where:{id:{in:mascotIds},playerId:player.id}}); const rules=ruleData(league.ruleJson); const checks:Array<{label:string;valid:boolean;detail:string}>=[];
    checks.push({label:"Quantidade",valid:mascots.length>=1&&mascots.length<=league.teamSize,detail:`${mascots.length}/${league.teamSize} mascotes. Equipes incompletas são válidas a partir de 1.`});
    checks.push({label:"Propriedade",valid:mascots.length===mascotIds.length,detail:mascots.length===mascotIds.length?"Todos pertencem à conta de teste.":"Há mascote inválido ou de outra conta."});
    checks.push({label:"Nível",valid:!league.maxLevel||mascots.every(m=>m.level<=league.maxLevel!),detail:league.maxLevel?`Limite Nv.${league.maxLevel}.`:"Sem limite de nível."});
    checks.push({label:"Tipo",valid:!league.requiredType||mascots.every(m=>(m.primaryTypeOverride?[m.primaryTypeOverride,m.secondaryTypeOverride].filter(Boolean):getPokemonTypes(m.pokemonId)).includes(league.requiredType!)),detail:league.requiredType?`Todos precisam possuir ${getPokemonTypeLabel(league.requiredType)}.`:"Todos os tipos permitidos."});
    const personality=String(rules.requiredPersonality??""); checks.push({label:"Personalidade",valid:!personality||mascots.every(m=>m.personality===personality),detail:personality?`Obrigatória: ${personality}.`:"Todas permitidas."});
    const division=validateBattleDivision(mascots,normalizeBattleDivision(league.division));checks.push({label:"Divisão",valid:division.valid,detail:division.message??`${division.megaCount} Mega(s); ${division.maxMegas===null?"sem limite":`máximo ${division.maxMegas}`}.`});
    return {success:true,valid:checks.every(c=>c.valid),checks};
  } catch(error){return{error:error instanceof Error?error.message:"Falha no debug da equipe."};}
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
  if (league.status === "CANCELLED") return { success: true, action: "cancelled", leagueId: league.id, reason: String(ruleData(league.ruleJson).cancellationReason ?? "Menos de 4 inscritos.") };
  const now = new Date();
  const date = brtDate(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(now);
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  if (!["Mon", "Tue", "Wed", "Thu", "Fri"].includes(weekday) || date < brtDate(league.weekStart) || date > brtDate(league.weekEnd)) return { success: true, action: "idle", leagueId: league.id };
  if (clock >= "08:00") await adminGenerateRushDayAction(league.id, date, secret);
  const maxSlot = clock >= "19:20" ? 3 : clock >= "19:10" ? 2 : clock >= "19:00" ? 1 : 0;
  const battles = maxSlot ? await adminRunRushDayAction(league.id, date, maxSlot, secret) : { success: true, resolved: 0, skipped: 0 };
  if (weekday === "Fri" && clock >= "19:30") {
    const unresolved = await prisma.rushLeagueMatch.count({ where: { leagueId: league.id, status: "SCHEDULED" } });
    if (unresolved === 0) await adminFinishRushLeagueAction(league.id, secret);
  }
  return { success: true, action: "processed", leagueId: league.id, battles };
}
