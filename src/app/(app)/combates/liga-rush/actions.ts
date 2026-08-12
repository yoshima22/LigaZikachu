"use server";

import { revalidatePath } from "next/cache";
import { Prisma, ZikaCoinTxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { defaultCombatRoleFor } from "@/lib/combat-roles";
import { runLeagueCombat, toLeagueMascot } from "@/lib/league-combat";
import { normalizeBattleDivision, validateBattleDivision } from "@/lib/battle-divisions";
import { creditCoins } from "@/lib/zikacoins";
import { MEGA_STONES } from "@/lib/mega-evolution";
import { DEFAULT_RUSH_REWARDS, RUSH_RULE_PRESETS } from "./constants";

const PATH = "/combates/liga-rush";
const BATTLE_HOURS = [20, 20, 20];
const BATTLE_MINUTES = [0, 10, 20];

type RewardTier = { rank: number; coins: number; label?: string; item?: "RANDOM_MEGA_STONE" | "RANDOM_MEGA_STONE_OR_ZC" };

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

function parseRewards(value: unknown): RewardTier[] {
  const source = Array.isArray(value) ? value : DEFAULT_RUSH_REWARDS;
  return source.map((entry) => {
    const row = entry as Partial<RewardTier>;
    return {
      rank: Math.max(1, Math.trunc(Number(row.rank) || 1)),
      coins: Math.min(10000, Math.max(0, Math.trunc(Number(row.coins) || 0))),
      label: String(row.label ?? ""),
      ...(row.item ? { item: row.item } : {}),
    };
  }).sort((a, b) => a.rank - b.rank);
}

export async function getRushDataAction() {
  const { session, player } = await requireContext();
  const league = await prisma.rushLeague.findFirst({
    where: { status: { in: ["REGISTRATION", "ACTIVE"] } },
    orderBy: { weekStart: "desc" },
    include: { participants: { orderBy: [{ points: "desc" }, { wins: "desc" }, { damageDealt: "desc" }] }, dailyTeams: { where: { playerId: player.id } }, matches: { orderBy: [{ battleDate: "desc" }, { battleSlot: "asc" }] } },
  });
  const recent = await prisma.rushLeague.findMany({ where: { status: "FINISHED" }, orderBy: { weekEnd: "desc" }, take: 4 });
  if (!league) return { league: null, recent, isAdmin: isAdmin(session.user.role), presets: RUSH_RULE_PRESETS, divisions: [] };

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

export async function adminCreateRushLeagueAction(input: { name: string; weekKey: string; weekStart: string; weekEnd: string; registrationEnds: string; division: string; teamSize: number; maxLevel?: number | null; requiredType?: string | null; uniqueSpecies: boolean; preset?: string; rewards?: RewardTier[] }) {
  try {
    await requireContext(true);
    if (!input.name.trim() || !input.weekKey.trim()) return { error: "Informe nome e identificador da semana." };
    const rewards = parseRewards(input.rewards ?? DEFAULT_RUSH_REWARDS);
    const league = await prisma.rushLeague.create({ data: {
      name: input.name.trim(), weekKey: input.weekKey.trim(), weekStart: parseBrtAdminDate(input.weekStart), weekEnd: parseBrtAdminDate(input.weekEnd), registrationEnds: parseBrtAdminDate(input.registrationEnds),
      division: normalizeBattleDivision(input.division), teamSize: Math.min(6, Math.max(1, Math.trunc(input.teamSize))), maxLevel: input.maxLevel ? Math.max(1, Math.trunc(input.maxLevel)) : null,
      requiredType: input.requiredType?.trim().toLowerCase() || null, uniqueSpecies: Boolean(input.uniqueSpecies), ruleJson: { preset: input.preset ?? "CUSTOM", battlesPerDay: 3, freeRegistration: true }, rewardsJson: rewards as unknown as Prisma.InputJsonValue,
    } });
    revalidatePath(PATH);
    return { success: true, leagueId: league.id };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao criar a edição Rush." }; }
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

export async function adminGenerateRushDayAction(leagueId: string, battleDate: string) {
  try {
    await requireContext(true);
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

export async function adminRunRushDayAction(leagueId: string, battleDate: string) {
  try {
    await requireContext(true);
    const league = await prisma.rushLeague.findUnique({ where: { id: leagueId } });
    if (!league) return { error: "Liga não encontrada." };
    const matches = await prisma.rushLeagueMatch.findMany({ where: { leagueId, battleDate, status: "SCHEDULED", playerBId: { not: null } }, orderBy: { battleSlot: "asc" } });
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

export async function adminFinishRushLeagueAction(leagueId: string, championReward: "COINS" | "STONE" = "COINS") {
  try {
    const { session } = await requireContext(true);
    const league = await prisma.rushLeague.findUnique({ where: { id: leagueId }, include: { participants: true } });
    if (!league) return { error: "Liga não encontrada." };
    if (league.rewardsGrantedAt) return { error: "As recompensas desta edição já foram distribuídas." };
    const ranking = [...league.participants].sort((a, b) => b.points - a.points || b.wins - a.wins || b.survivorsScore - a.survivorsScore || b.damageDealt - a.damageDealt || a.damageTaken - b.damageTaken);
    const rewards = parseRewards(league.rewardsJson);
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < ranking.length; index++) {
        const participant = ranking[index]; const rank = index + 1; const reward = rewards.find((r) => r.rank === rank);
        await tx.rushLeagueParticipant.update({ where: { id: participant.id }, data: { finalRank: rank, rewardGranted: Boolean(reward) } });
        if (!reward) continue;
        const giveStone = rank === 1 && reward.item && (reward.item === "RANDOM_MEGA_STONE" || championReward === "STONE");
        if (giveStone) {
          const stone = MEGA_STONES[Math.floor(Math.random() * MEGA_STONES.length)];
          const shopItem = await tx.shopItem.findFirst({ where: { type: stone.type } });
          if (shopItem) await tx.playerInventory.upsert({ where: { playerId_itemId: { playerId: participant.playerId, itemId: shopItem.id } }, create: { playerId: participant.playerId, itemId: shopItem.id, quantity: 1, source: "RUSH_LEAGUE" }, update: { quantity: { increment: 1 } } });
        } else if (reward.coins > 0) {
          await creditCoins(tx, { playerId: participant.playerId, type: ZikaCoinTxType.PARTICIPATION_REWARD, amount: reward.coins, description: `Liga Rush ${league.weekKey} — ${rank}º lugar`, adminId: session.user.id });
        }
      }
      await tx.rushLeague.update({ where: { id: leagueId }, data: { status: "FINISHED", championPlayerId: ranking[0]?.playerId, rewardsGrantedAt: new Date() } });
    });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao encerrar a Rush." }; }
}
