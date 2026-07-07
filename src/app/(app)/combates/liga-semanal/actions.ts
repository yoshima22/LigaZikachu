"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { WEEKLY_MODIFIERS, LEAGUE_ITEMS } from "./constants";
import { toLeagueMascot, runLeagueCombat } from "@/lib/league-combat";
import { recommendCombatRole } from "@/lib/combat-roles";
import type { WeeklyModifier } from "./constants";
import { EggType, GiftType, Role, UserStatus, ZikaCoinTxType } from "@prisma/client";
import { settleWeeklyLeagueBets } from "@/app/(app)/zikabet/actions";
import { creditCoins } from "@/lib/zikacoins";
import { isStandbyActive } from "@/lib/account-standby";

function createId() { return crypto.randomUUID(); }

function getCurrentWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { weekStart: monday, weekEnd: friday };
}

function getTodayBrt() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getBrtMinuteOfDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function isWeeklyTeamEditLocked(now = new Date()) {
  return getBrtMinuteOfDay(now) >= 20 * 60;
}

const WEEKLY_TEAM_LOCK_MESSAGE = "Atualizacoes de time da Liga Semanal ficam travadas apos 20:00 (BRT).";

const PATH = "/combates/liga-semanal";
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);
function activeWeeklyPlayerWhere(now = new Date()) {
  return {
    active: true,
    casualMode: false,
    user: { role: { notIn: [Role.ADMIN, Role.SUPER_ADMIN] }, status: UserStatus.ACTIVE },
  };
}

type RoleRecommendMascot = {
  id: string;
  statForce?: number | null;
  statAgility?: number | null;
  statVitality?: number | null;
  statInstinct?: number | null;
  statCharisma?: number | null;
};

function recommendedRolesForMascots(mascots: RoleRecommendMascot[]) {
  return Object.fromEntries(mascots.map((mascot) => [mascot.id, recommendCombatRole(mascot)]));
}

function resolveMascotRole(mascot: RoleRecommendMascot, roles?: Record<string, string>) {
  return roles?.[mascot.id] ?? recommendCombatRole(mascot);
}

async function findActiveWeeklyPlayers(client: Pick<typeof prisma, "player">, now = new Date()) {
  const players = await client.player.findMany({
    where: activeWeeklyPlayerWhere(now),
    select: { id: true, notes: true },
  });
  return players.filter((player) => !isStandbyActive(player.notes, now)).map((player) => ({ id: player.id }));
}

// ── Read action (client refresh) ──────────────────────────────────────────

export async function getLeagueDataAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const { getLeaguePageData } = await import("./data");
  const data = await getLeaguePageData(player.id, player.displayName, isAdmin(session.user.role));
  return JSON.parse(JSON.stringify(data));
}

// ── Create league ─────────────────────────────────────────────────────────

export async function createLeagueAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  try {
    const weekKey = getCurrentWeekKey();
    const { weekStart, weekEnd } = getWeekBounds();

    const existing = await prisma.weeklyMascotLeague.findUnique({ where: { weekKey } });
    if (existing) return { error: `Liga ${weekKey} já existe.` };

    await prisma.$transaction(async (tx) => {
      const league = await tx.weeklyMascotLeague.create({
        data: {
          id: createId(),
          weekKey,
          weekStart,
          weekEnd,
          status: "REGISTRATION",
          updatedAt: new Date(),
        },
      });

      const allPlayers = await findActiveWeeklyPlayers(tx);

      for (const p of allPlayers) {
        await tx.weeklyMascotLeagueParticipant.create({
          data: {
            id: createId(),
            leagueId: league.id,
            playerId: p.id,
            updatedAt: new Date(),
          },
        });
      }
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao criar liga: ${String(err).slice(0, 200)}. A migration SQL 011 foi aplicada?` };
  }
}

export async function startWeeklyLeagueNowAction() {
  const session = await getAppSession();
  if (!session?.user || !isAdmin(session.user.role)) return { error: "Acesso restrito" };
  try {
    const weekKey = getCurrentWeekKey();
    const battleDate = getTodayBrt();
    const modifier = WEEKLY_MODIFIERS[[...battleDate].reduce((sum, char) => sum + char.charCodeAt(0), 0) % WEEKLY_MODIFIERS.length];
    const { weekStart, weekEnd } = getWeekBounds();
    const result = await prisma.$transaction(async (tx) => {
      let league = await tx.weeklyMascotLeague.findUnique({ where: { weekKey } });
      if (league?.status === "FINISHED" || league?.status === "CANCELLED") {
        await tx.weeklyMascotLeagueMatch.deleteMany({ where: { leagueId: league.id } });
        await tx.weeklyMascotLeagueDailyTeam.deleteMany({ where: { leagueId: league.id } });
        await tx.weeklyMascotLeagueBattleItem.deleteMany({ where: { leagueId: league.id } });
        await tx.weeklyMascotLeagueMascotStats.deleteMany({ where: { leagueId: league.id } });
        await tx.weeklyMascotLeagueParticipant.deleteMany({ where: { leagueId: league.id } });
        await tx.weeklyMascotLeague.delete({ where: { id: league.id } });
        league = null;
      }
      if (!league) {
        league = await tx.weeklyMascotLeague.create({ data: { id: createId(), weekKey, weekStart, weekEnd, status: "ACTIVE", modifierJson: { ...modifier, dailyDate: battleDate, dailyHistory: [modifier.id] }, updatedAt: new Date() } });
      } else {
        const stored = (league.modifierJson ?? {}) as Record<string, unknown>;
        league = await tx.weeklyMascotLeague.update({ where: { id: league.id }, data: { status: "ACTIVE", modifierJson: stored.dailyDate === battleDate ? undefined : { ...modifier, dailyDate: battleDate, dailyHistory: [...(Array.isArray(stored.dailyHistory) ? stored.dailyHistory : []), modifier.id].slice(-5) }, updatedAt: new Date() } });
      }
      const activePlayers = await findActiveWeeklyPlayers(tx);
      if (activePlayers.length) await tx.weeklyMascotLeagueParticipant.createMany({ data: activePlayers.map((player) => ({ id: createId(), leagueId: league!.id, playerId: player.id, updatedAt: new Date() })), skipDuplicates: true });
      return { leagueId: league.id, participants: activePlayers.length, modifier: modifier.name };
    });
    revalidatePath(PATH);
    return { success: true, ...result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Nao foi possivel iniciar a Liga." };
  }
}

// ── Cancel league ─────────────────────────────────────────────────────────

export async function cancelLeagueAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const league = await prisma.weeklyMascotLeague.findUnique({ where: { id: leagueId } });
    if (!league) return { error: "Liga não encontrada" };
    if (league.status === "FINISHED") return { error: "Liga já encerrada, não pode cancelar." };
    if (league.status === "CANCELLED") return { error: "Liga já está cancelada." };

    await prisma.$transaction(async (tx) => {
      await tx.weeklyMascotLeagueMatch.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueDailyTeam.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueBattleItem.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueMascotStats.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueParticipant.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeague.update({
        where: { id: leagueId },
        data: { status: "CANCELLED", updatedAt: new Date() },
      });
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao cancelar: ${String(err).slice(0, 200)}` };
  }
}

// ── Delete league (remove completely) ─────────────────────────────────────

export async function deleteLeagueAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.weeklyMascotLeagueMatch.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueDailyTeam.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueBattleItem.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueMascotStats.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueParticipant.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeague.delete({ where: { id: leagueId } });
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao excluir: ${String(err).slice(0, 200)}` };
  }
}

// ── Purge admins from current league ──────────────────────────────────────

export async function purgeAdminsFromLeagueAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const adminPlayers = await prisma.player.findMany({
      where: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } },
      select: { id: true },
    });
    const adminIds = adminPlayers.map(p => p.id);
    if (adminIds.length === 0) return { success: true, removed: 0 };

    await prisma.$transaction(async (tx) => {
      await tx.weeklyMascotLeagueMatch.deleteMany({
        where: { leagueId, OR: [{ playerAId: { in: adminIds } }, { playerBId: { in: adminIds } }] },
      });
      await tx.weeklyMascotLeagueDailyTeam.deleteMany({
        where: { leagueId, playerId: { in: adminIds } },
      });
      await tx.weeklyMascotLeagueBattleItem.deleteMany({
        where: { leagueId, playerId: { in: adminIds } },
      });
      await tx.weeklyMascotLeagueMascotStats.deleteMany({
        where: { leagueId, ownerId: { in: adminIds } },
      });
      await tx.weeklyMascotLeagueParticipant.deleteMany({
        where: { leagueId, playerId: { in: adminIds } },
      });
    });

    revalidatePath(PATH);
    return { success: true, removed: adminIds.length };
  } catch (err) {
    return { error: `Erro: ${String(err).slice(0, 200)}` };
  }
}

// ── Purge inactive/deleted players from current league ───────────────────

export async function purgeInactivePlayersAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const participants = await prisma.weeklyMascotLeagueParticipant.findMany({
      where: { leagueId },
      select: { playerId: true },
    });
    const playerIds = participants.map(p => p.playerId);
    if (playerIds.length === 0) return { success: true, removed: 0 };

    // Find players that still exist and are valid
    const validPlayersRaw = await prisma.player.findMany({
      where: { id: { in: playerIds }, ...activeWeeklyPlayerWhere() },
      select: { id: true, notes: true },
    });
    const validPlayers = validPlayersRaw.filter((player) => !isStandbyActive(player.notes));
    const validIds = new Set(validPlayers.map(p => p.id));
    const invalidIds = playerIds.filter(id => !validIds.has(id));

    if (invalidIds.length === 0) return { success: true, removed: 0 };

    await prisma.$transaction(async (tx) => {
      await tx.weeklyMascotLeagueMatch.deleteMany({
        where: { leagueId, OR: [{ playerAId: { in: invalidIds } }, { playerBId: { in: invalidIds } }] },
      });
      await tx.weeklyMascotLeagueDailyTeam.deleteMany({
        where: { leagueId, playerId: { in: invalidIds } },
      });
      await tx.weeklyMascotLeagueBattleItem.deleteMany({
        where: { leagueId, playerId: { in: invalidIds } },
      });
      await tx.weeklyMascotLeagueMascotStats.deleteMany({
        where: { leagueId, ownerId: { in: invalidIds } },
      });
      await tx.weeklyMascotLeagueParticipant.deleteMany({
        where: { leagueId, playerId: { in: invalidIds } },
      });
    });

    revalidatePath(PATH);
    return { success: true, removed: invalidIds.length };
  } catch (err) {
    return { error: `Erro: ${String(err).slice(0, 200)}` };
  }
}

// ── Join league ───────────────────────────────────────────────────────────

export async function joinLeagueAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const league = await prisma.weeklyMascotLeague.findFirst({
    where: { id: leagueId, status: { in: ["REGISTRATION", "ACTIVE"] } },
  });
  if (!league) return { error: "Liga não encontrada ou encerrada" };

  const existing = await prisma.weeklyMascotLeagueParticipant.findFirst({
    where: { leagueId, playerId: player.id },
  });
  if (existing) return { error: "Você já participa desta liga" };

  await prisma.weeklyMascotLeagueParticipant.create({
    data: { id: createId(), leagueId, playerId: player.id, updatedAt: new Date() },
  });

  revalidatePath(PATH);
  return { success: true };
}

// ── Generate daily matchups (preview before battles) ──────────────────────

// ── Swiss pairing engine ──────────────────────────────────────────────────

type PairingPlayer = { playerId: string; points: number; wins: number; damageDealt: number };
type PairingResult = Array<{ aId: string; bId: string | null }>;

function swissPairSlot(
  players: PairingPlayer[],
  faced: Map<string, Set<string>>,
  todayPaired: Map<string, Set<string>>,
  byeCount: Map<string, number>,
  slotIndex: number,
): PairingResult {
  const result: PairingResult = [];
  const paired = new Set<string>();

  // Sort with shuffle within similar score tiers + BYE priority
  const sorted = [...players].sort((a, b) => {
    const aB = byeCount.get(a.playerId) ?? 0;
    const bB = byeCount.get(b.playerId) ?? 0;
    if (aB !== bB) return bB - aB;
    const scoreDiff = (b.points - a.points) || (b.wins - a.wins);
    if (scoreDiff !== 0) return scoreDiff;
    // Same tier: shuffle to avoid deterministic pairing
    return (hashStr(a.playerId + slotIndex) & 0xff) - (hashStr(b.playerId + slotIndex) & 0xff);
  });

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (paired.has(p.playerId)) continue;

    const prevOpps = faced.get(p.playerId) ?? new Set();
    const todayOpps = todayPaired.get(p.playerId) ?? new Set();

    // Build candidate list: score by proximity + penalty for faced
    const candidates: Array<{ player: PairingPlayer; score: number }> = [];
    for (let j = 0; j < sorted.length; j++) {
      if (j === i || paired.has(sorted[j].playerId)) continue;
      const c = sorted[j];
      const pointDist = Math.abs(p.points - c.points);
      const facedBefore = prevOpps.has(c.playerId);
      const facedToday = todayOpps.has(c.playerId);
      // Lower score = better match
      let score = pointDist;
      if (facedToday) score += 1000;  // heavy penalty for same-day repeat
      if (facedBefore) score += 200;  // moderate penalty for week repeat
      // Slight randomness to break ties
      score += (hashStr(p.playerId + c.playerId + slotIndex) % 20);
      candidates.push({ player: c, score });
    }

    candidates.sort((a, b) => a.score - b.score);
    const opp = candidates[0]?.player ?? null;

    if (opp) {
      result.push({ aId: p.playerId, bId: opp.playerId });
      paired.add(p.playerId);
      paired.add(opp.playerId);
      // Track
      if (!todayPaired.has(p.playerId)) todayPaired.set(p.playerId, new Set());
      if (!todayPaired.has(opp.playerId)) todayPaired.set(opp.playerId, new Set());
      todayPaired.get(p.playerId)!.add(opp.playerId);
      todayPaired.get(opp.playerId)!.add(p.playerId);
    } else {
      // BYE
      result.push({ aId: p.playerId, bId: null });
      byeCount.set(p.playerId, (byeCount.get(p.playerId) ?? 0) + 1);
      paired.add(p.playerId);
    }
  }
  return result;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function loadFacedOpponents(leagueId: string) {
  const prevMatches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { leagueId, status: { in: ["RESOLVED", "WO", "SCHEDULED"] } },
    select: { playerAId: true, playerBId: true },
  });
  const faced = new Map<string, Set<string>>();
  for (const m of prevMatches) {
    if (!m.playerBId) continue;
    if (!faced.has(m.playerAId)) faced.set(m.playerAId, new Set());
    if (!faced.has(m.playerBId)) faced.set(m.playerBId, new Set());
    faced.get(m.playerAId)!.add(m.playerBId);
    faced.get(m.playerBId)!.add(m.playerAId);
  }
  return faced;
}

function calculateLeagueOdds(
  pA: { points: number; wins: number; damageDealt: number },
  pB: { points: number; wins: number; damageDealt: number },
): { oddsA: number; oddsB: number } {
  const scoreA = (pA.points * 10) + (pA.wins * 5) + (pA.damageDealt / 100);
  const scoreB = (pB.points * 10) + (pB.wins * 5) + (pB.damageDealt / 100);
  const total = scoreA + scoreB;
  if (total === 0) return { oddsA: 1.90, oddsB: 1.90 };
  const probA = scoreA / total;
  const probB = scoreB / total;
  const margin = 0.92;
  const round5 = (v: number) => Math.round(Math.round(v / 0.05) * 5) / 100;
  return {
    oddsA: Math.max(1.10, round5(probA > 0.02 ? margin / probA : 8)),
    oddsB: Math.max(1.10, round5(probB > 0.02 ? margin / probB : 8)),
  };
}

export async function generateDailyMatchupsAction(leagueId: string, forceRegenerate = false) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const league = await prisma.weeklyMascotLeague.findFirst({ where: { id: leagueId, status: "ACTIVE" } });
    if (!league) return { error: "Liga não ativa" };

    const today = getTodayBrt();

    // Delete existing SCHEDULED (not yet resolved) if regenerating
    const existing = await prisma.weeklyMascotLeagueMatch.findMany({ where: { leagueId, battleDate: today } });
    const hasResolved = existing.some(m => m.status === "RESOLVED" || m.status === "WO");
    if (hasResolved && !forceRegenerate) return { error: "Já existem combates resolvidos hoje. Use 'Refazer Chave' para forçar." };

    if (existing.length > 0) {
      // Revert BYE points before deleting
      const byeMatches = existing.filter(m => m.status === "BYE");
      for (const bye of byeMatches) {
        await prisma.weeklyMascotLeagueParticipant.updateMany({
          where: { leagueId, playerId: bye.playerAId },
          data: { points: { decrement: 3 }, byes: { decrement: 1 }, updatedAt: new Date() },
        });
      }
      await prisma.weeklyMascotLeagueMatch.deleteMany({ where: { leagueId, battleDate: today } });
    }

    const participants = await prisma.weeklyMascotLeagueParticipant.findMany({
      where: { leagueId },
      orderBy: [{ points: "desc" }, { wins: "desc" }, { damageDealt: "desc" }],
    });

    if (participants.length < 2) return { error: "Menos de 2 participantes" };

    const roundBase = await prisma.weeklyMascotLeagueMatch.count({ where: { leagueId } });
    const faced = await loadFacedOpponents(leagueId);
    const todayPaired = new Map<string, Set<string>>();
    const byeCount = new Map<string, number>();
    let created = 0;

    for (const battleSlot of [1, 2, 3]) {
      const pairings = swissPairSlot(participants, faced, todayPaired, byeCount, battleSlot);

      for (const pair of pairings) {
        if (pair.bId) {
          const pA = participants.find(p => p.playerId === pair.aId)!;
          const pB = participants.find(p => p.playerId === pair.bId)!;
          const { oddsA, oddsB } = calculateLeagueOdds(pA, pB);
          await prisma.weeklyMascotLeagueMatch.create({
            data: {
              id: createId(), leagueId,
              roundNumber: roundBase + battleSlot,
              battleDate: today, battleSlot,
              scheduledAt: new Date(),
              playerAId: pair.aId, playerBId: pair.bId,
              status: "SCHEDULED",
              resultJson: { oddsA, oddsB },
            },
          });
          if (!faced.has(pair.aId)) faced.set(pair.aId, new Set());
          if (!faced.has(pair.bId)) faced.set(pair.bId, new Set());
          faced.get(pair.aId)!.add(pair.bId);
          faced.get(pair.bId)!.add(pair.aId);
          created++;
        } else {
          await prisma.weeklyMascotLeagueMatch.create({
            data: {
              id: createId(), leagueId,
              roundNumber: roundBase + battleSlot,
              battleDate: today, battleSlot,
              scheduledAt: new Date(),
              playerAId: pair.aId,
              status: "BYE", resolvedAt: new Date(),
            },
          });
          await prisma.weeklyMascotLeagueParticipant.updateMany({
            where: { leagueId, playerId: pair.aId },
            data: { points: { increment: 3 }, byes: { increment: 1 }, updatedAt: new Date() },
          });
        }
      }
    }

    revalidatePath(PATH);
    return { success: true, matchups: created };
  } catch (err) {
    return { error: `Erro: ${String(err).slice(0, 200)}` };
  }
}

// ── Save daily team ───────────────────────────────────────────────────────

export async function saveDailyTeamAction(
  leagueId: string,
  battleSlot: number,
  mascotIds: string[],
  roles: Record<string, string>,
) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  if (mascotIds.length !== 6) return { error: "Selecione exatamente 6 mascotes." };
  if (battleSlot < 1 || battleSlot > 3) return { error: "Slot inválido." };

  try {
    const today = getTodayBrt();
    if (isWeeklyTeamEditLocked()) return { error: WEEKLY_TEAM_LOCK_MESSAGE };

    const resolvedMatch = await prisma.weeklyMascotLeagueMatch.findFirst({
      where: { leagueId, battleDate: today, battleSlot, status: { in: ["RESOLVED", "WO"] } },
      select: { id: true },
    });
    if (resolvedMatch) return { error: "Este combate ja aconteceu e o time esta travado." };

    // Check no mascot is used in other slots today
    const otherTeams = await prisma.weeklyMascotLeagueDailyTeam.findMany({
      where: { leagueId, playerId: player.id, battleDate: today, battleSlot: { not: battleSlot } },
    });
    const usedIds = new Set(otherTeams.flatMap(t => (t.mascotIdsJson as string[]) ?? []));
    const conflict = mascotIds.find(id => usedIds.has(id));
    if (conflict) return { error: "Um mascote já está em outro time de hoje. Mascotes não podem repetir no mesmo dia." };

    // Verify mascots belong to player
    const owned = await prisma.mascot.findMany({
      where: { id: { in: mascotIds }, playerId: player.id },
      select: { id: true },
    });
    if (owned.length !== 6) return { error: "Algum mascote selecionado não pertence a você." };

    await prisma.weeklyMascotLeagueDailyTeam.upsert({
      where: {
        leagueId_playerId_battleDate_battleSlot: {
          leagueId, playerId: player.id, battleDate: today, battleSlot,
        },
      },
      create: {
        id: createId(),
        leagueId,
        playerId: player.id,
        battleDate: today,
        battleSlot,
        mascotIdsJson: mascotIds,
        rolesJson: roles,
        lockedAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        mascotIdsJson: mascotIds,
        rolesJson: roles,
        lockedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao salvar time: ${String(err).slice(0, 200)}` };
  }
}

// ── Clear single team slot ───────────────────────────────────────────────

export async function clearTeamSlotAction(leagueId: string, battleSlot: number) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };
  if (battleSlot < 1 || battleSlot > 3) return { error: "Slot inválido" };

  try {
    const today = getTodayBrt();
    if (isWeeklyTeamEditLocked()) return { error: WEEKLY_TEAM_LOCK_MESSAGE };

    const resolved = await prisma.weeklyMascotLeagueMatch.findFirst({
      where: { leagueId, battleDate: today, battleSlot, status: { in: ["RESOLVED", "WO"] } },
    });
    if (resolved) return { error: "Este combate já aconteceu. Não é possível limpar." };

    // Save empty array to mark as intentionally cleared (prevents inheritance)
    await prisma.weeklyMascotLeagueDailyTeam.upsert({
      where: { leagueId_playerId_battleDate_battleSlot: { leagueId, playerId: player.id, battleDate: today, battleSlot } },
      create: { id: createId(), leagueId, playerId: player.id, battleDate: today, battleSlot, source: "CLEARED", mascotIdsJson: [], rolesJson: {}, updatedAt: new Date() },
      update: { mascotIdsJson: [], rolesJson: {}, source: "CLEARED", updatedAt: new Date() },
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro: ${String(err).slice(0, 200)}` };
  }
}

// ── Swap team slots ──────────────────────────────────────────────────────

export async function swapTeamSlotsAction(leagueId: string, slotA: number, slotB: number) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  if (slotA === slotB || slotA < 1 || slotA > 3 || slotB < 1 || slotB > 3) return { error: "Slots inválidos" };

  try {
    const today = getTodayBrt();
    if (isWeeklyTeamEditLocked()) return { error: WEEKLY_TEAM_LOCK_MESSAGE };

    // Check no resolved matches for these slots
    const resolved = await prisma.weeklyMascotLeagueMatch.findFirst({
      where: { leagueId, battleDate: today, battleSlot: { in: [slotA, slotB] }, status: { in: ["RESOLVED", "WO"] } },
    });
    if (resolved) return { error: "Um dos combates já aconteceu. Não é possível trocar." };

    // Load both teams (today or inherited)
    async function getTeam(slot: number) {
      let team = await prisma.weeklyMascotLeagueDailyTeam.findUnique({
        where: { leagueId_playerId_battleDate_battleSlot: { leagueId, playerId: player!.id, battleDate: today, battleSlot: slot } },
      });
      if (!team) {
        team = await prisma.weeklyMascotLeagueDailyTeam.findFirst({
          where: { leagueId, playerId: player!.id, battleSlot: slot },
          orderBy: { battleDate: "desc" },
        });
      }
      return team;
    }

    const teamA = await getTeam(slotA);
    const teamB = await getTeam(slotB);

    if (!teamA && !teamB) return { error: "Nenhum dos dois slots tem time." };

    await prisma.$transaction(async (tx) => {
      // Upsert slot A with team B's data (or clear if B is empty)
      if (teamB) {
        await tx.weeklyMascotLeagueDailyTeam.upsert({
          where: { leagueId_playerId_battleDate_battleSlot: { leagueId, playerId: player!.id, battleDate: today, battleSlot: slotA } },
          create: { id: createId(), leagueId, playerId: player!.id, battleDate: today, battleSlot: slotA, mascotIdsJson: teamB.mascotIdsJson as any, rolesJson: teamB.rolesJson as any, lockedAt: new Date(), updatedAt: new Date() },
          update: { mascotIdsJson: teamB.mascotIdsJson as any, rolesJson: teamB.rolesJson as any, updatedAt: new Date() },
        });
      } else {
        await tx.weeklyMascotLeagueDailyTeam.deleteMany({ where: { leagueId, playerId: player!.id, battleDate: today, battleSlot: slotA } });
      }

      // Upsert slot B with team A's data (or clear if A is empty)
      if (teamA) {
        await tx.weeklyMascotLeagueDailyTeam.upsert({
          where: { leagueId_playerId_battleDate_battleSlot: { leagueId, playerId: player!.id, battleDate: today, battleSlot: slotB } },
          create: { id: createId(), leagueId, playerId: player!.id, battleDate: today, battleSlot: slotB, mascotIdsJson: teamA.mascotIdsJson as any, rolesJson: teamA.rolesJson as any, lockedAt: new Date(), updatedAt: new Date() },
          update: { mascotIdsJson: teamA.mascotIdsJson as any, rolesJson: teamA.rolesJson as any, updatedAt: new Date() },
        });
      } else {
        await tx.weeklyMascotLeagueDailyTeam.deleteMany({ where: { leagueId, playerId: player!.id, battleDate: today, battleSlot: slotB } });
      }
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao trocar: ${String(err).slice(0, 200)}` };
  }
}

// ── Toggle league bets ───────────────────────────────────────────────────

export async function toggleLeagueBetsAction(leagueId: string, enabled: boolean) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const league = await prisma.weeklyMascotLeague.findUnique({ where: { id: leagueId } });
    if (!league) return { error: "Liga não encontrada" };

    const current = (league.modifierJson ?? {}) as Record<string, unknown>;
    await prisma.weeklyMascotLeague.update({
      where: { id: leagueId },
      data: { modifierJson: { ...current, betsEnabled: enabled }, updatedAt: new Date() },
    });

    // When disabling: refund ALL open league bets and delete them
    if (!enabled) {
      const openBets = await prisma.weeklyMascotLeagueBet.findMany({
        where: {
          weeklyMatch: { leagueId },
          status: { in: ["OPEN", "CLOSED"] },
        },
      });
      if (openBets.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const bet of openBets) {
            await creditCoins(tx, {
              playerId: bet.playerId,
              type: ZikaCoinTxType.BET_REFUNDED,
              amount: bet.amount,
              description: "Reembolso: apostas da Liga Semanal desabilitadas pelo admin",
            });
          }
          await tx.weeklyMascotLeagueBet.deleteMany({
            where: { id: { in: openBets.map(b => b.id) } },
          });
        });
      }
    }

    revalidatePath(PATH);
    revalidatePath("/zikabet");
    revalidatePath("/zikabet/minhas-apostas");
    revalidatePath("/carteira");
    return { success: true, enabled, refunded: enabled ? 0 : undefined };
  } catch (err) {
    return { error: `Erro: ${String(err).slice(0, 200)}` };
  }
}

// ── Set modifier ──────────────────────────────────────────────────────────

export async function setModifierAction(leagueId: string, modifierId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const mod = WEEKLY_MODIFIERS.find(m => m.id === modifierId);
  if (!mod) return { error: "Modificador inválido" };

  try {
    await prisma.weeklyMascotLeague.update({
      where: { id: leagueId },
      data: { modifierJson: mod as unknown as any, status: "ACTIVE", updatedAt: new Date() },
    });
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro: ${String(err).slice(0, 200)}` };
  }
}

// ── Simulate round ────────────────────────────────────────────────────────

export async function simulateRoundAction(leagueId: string, battleSlot: number, automationSecret?: string) {
  const session = await getAppSession();
  const automated = Boolean(process.env.CRON_SECRET && automationSecret === process.env.CRON_SECRET);
  if (!automated && !session?.user) return { error: "Não autenticado" };
  if (!automated && !isAdmin(session!.user.role)) return { error: "Acesso restrito" };

  try {
  const league = await prisma.weeklyMascotLeague.findFirst({
    where: { id: leagueId, status: "ACTIVE" },
  });
  if (!league) return { error: "Liga não ativa" };

  const participants = await prisma.weeklyMascotLeagueParticipant.findMany({
    where: { leagueId },
    orderBy: [{ points: "desc" }, { wins: "desc" }],
  });

  if (participants.length < 2) return { error: "Precisa de pelo menos 2 participantes" };

  const today = getTodayBrt();

  // Check if already resolved
  const resolvedMatches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { leagueId, battleDate: today, battleSlot, status: { in: ["RESOLVED", "WO"] } },
  });
  if (resolvedMatches.length > 0) return { error: `Slot ${battleSlot} de hoje já foi simulado` };

  // Use pre-generated SCHEDULED matchups if they exist
  const scheduledMatches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { leagueId, battleDate: today, battleSlot, status: "SCHEDULED" },
  });

  const roundNumber = await prisma.weeklyMascotLeagueMatch.count({ where: { leagueId } }) + 1;
  const modifier = league.modifierJson as unknown as WeeklyModifier | null;

  // Use pre-generated matchups or create Swiss pairings
  let pairings: Array<{ aId: string; bId: string | null; existingMatchId?: string }> = [];

  if (scheduledMatches.length > 0) {
    pairings = scheduledMatches.map(m => ({
      aId: m.playerAId,
      bId: m.playerBId,
      existingMatchId: m.id,
    }));
  } else {
    const paired = new Set<string>();
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (paired.has(p.playerId)) continue;
      let opponent: typeof p | null = null;
      for (let j = i + 1; j < participants.length; j++) {
        if (!paired.has(participants[j].playerId)) { opponent = participants[j]; break; }
      }
      if (opponent) {
        pairings.push({ aId: p.playerId, bId: opponent.playerId });
        paired.add(p.playerId);
        paired.add(opponent.playerId);
      } else {
        pairings.push({ aId: p.playerId, bId: null });
        paired.add(p.playerId);
      }
    }
  }

  for (const pair of pairings) {
    if (!pair.bId) {
      if (pair.existingMatchId) {
        await prisma.weeklyMascotLeagueMatch.update({
          where: { id: pair.existingMatchId },
          data: { status: "BYE", resolvedAt: new Date() },
        });
      } else {
        await prisma.weeklyMascotLeagueMatch.create({
          data: { id: createId(), leagueId, roundNumber, battleDate: today, battleSlot, scheduledAt: new Date(), playerAId: pair.aId, status: "BYE", resolvedAt: new Date() },
        });
      }
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: pair.aId },
        data: { points: { increment: 3 }, byes: { increment: 1 }, updatedAt: new Date() },
      });
      continue;
    }

    // Load daily teams (manual) or fallback to auto-select
    async function loadTeam(playerId: string) {
      const earlierTeams = await prisma.weeklyMascotLeagueDailyTeam.findMany({
        where: { leagueId, playerId, battleDate: today, battleSlot: { lt: battleSlot } },
        select: { mascotIdsJson: true },
      });
      const alreadyUsedToday = new Set(
        earlierTeams.flatMap((team) => (team.mascotIdsJson as string[] | null) ?? []),
      );

      // 1. Time de hoje
      let dailyTeam = await prisma.weeklyMascotLeagueDailyTeam.findUnique({
        where: { leagueId_playerId_battleDate_battleSlot: { leagueId, playerId, battleDate: today, battleSlot } },
      });

      // 2. Se não existe hoje, herdar do dia anterior
      if (!dailyTeam) {
        const lastTeam = await prisma.weeklyMascotLeagueDailyTeam.findFirst({
          where: { leagueId, playerId, battleSlot },
          orderBy: { battleDate: "desc" },
        });
        if (lastTeam) dailyTeam = lastTeam;
      }

      if (dailyTeam) {
        const ids = dailyTeam.mascotIdsJson as string[];
        if (ids.length === 0) {
          // CLEARED slot — skip to auto-fill
        } else {
          const roles = (dailyTeam.rolesJson as Record<string, string>) ?? {};
          const mascots = await prisma.mascot.findMany({ where: { id: { in: ids }, playerId } });
          const ordered = ids
            .map(id => mascots.find(m => m.id === id))
            .filter((mascot) => mascot && !alreadyUsedToday.has(mascot.id));

          // If mascots were lost (sold/transferred), fill remaining slots
          if (ordered.length < 6) {
            const existingIds = new Set(ordered.map(m => m!.id));
            const fillers = await prisma.mascot.findMany({
              where: { playerId, id: { notIn: [...new Set([...alreadyUsedToday, ...existingIds])] } },
              orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
              take: 6 - ordered.length,
            });
            ordered.push(...fillers);
          }

          return ordered.map((m, i) => toLeagueMascot(m!, i + 1, resolveMascotRole(m!, roles)));
        }
      }

      // 3. Auto-fill: favorites first, then by level
      const favs = await prisma.mascot.findMany({
        where: { playerId, isFavorite: true, id: { notIn: [...alreadyUsedToday] } },
        orderBy: { level: "desc" },
        take: 6,
      });
      if (favs.length >= 6) return favs.slice(0, 6).map((m, i) => toLeagueMascot(m, i + 1, recommendCombatRole(m)));

      const usedIds = new Set(favs.map(m => m.id));
      const rest = await prisma.mascot.findMany({
        where: { playerId, id: { notIn: [...new Set([...alreadyUsedToday, ...usedIds])] } },
        orderBy: { level: "desc" },
        take: 6 - favs.length,
      });
      const all = [...favs, ...rest];
      return all.map((m, i) => toLeagueMascot(m, i + 1, recommendCombatRole(m)));
    }

    // Load items for each player
    async function loadItems(playerId: string) {
      const battleItems = await prisma.weeklyMascotLeagueBattleItem.findMany({
        where: { leagueId, playerId, battleDate: today, battleSlot, consumedAt: null, refundedAt: null },
      });
      return battleItems.map(bi => LEAGUE_ITEMS.find(li => li.type === bi.effectType)).filter(Boolean) as typeof LEAGUE_ITEMS;
    }

    const [teamAMascots, teamBMascots] = await Promise.all([loadTeam(pair.aId), loadTeam(pair.bId!)]);

    if (teamAMascots.length < 6 || teamBMascots.length < 6) {
      const woPlayer = teamAMascots.length < 6 ? pair.aId : pair.bId!;
      const winPlayer = woPlayer === pair.aId ? pair.bId! : pair.aId;
      await prisma.weeklyMascotLeagueMatch.create({
        data: {
          id: createId(), leagueId, roundNumber, battleDate: today, battleSlot,
          scheduledAt: new Date(), playerAId: pair.aId, playerBId: pair.bId,
          winnerId: winPlayer, loserId: woPlayer, status: "WO", resolvedAt: new Date(),
        },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: winPlayer },
        data: { points: { increment: 3 }, wins: { increment: 1 }, updatedAt: new Date() },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: woPlayer },
        data: { woLosses: { increment: 1 }, updatedAt: new Date() },
      });
      continue;
    }

    const [itemsA, itemsB] = await Promise.all([loadItems(pair.aId), loadItems(pair.bId!)]);
    const result = runLeagueCombat(teamAMascots, teamBMascots, modifier, itemsA, itemsB);

    const winnerId = result.winner === "A" ? pair.aId : result.winner === "B" ? pair.bId : null;
    const loserId = result.winner === "A" ? pair.bId : result.winner === "B" ? pair.aId : null;

    const matchData = {
      winnerId, loserId, isDraw: result.winner === "DRAW",
      playerASurvivors: result.teamASurvivors, playerBSurvivors: result.teamBSurvivors,
      playerADamageDealt: result.teamADamageDealt, playerBDamageDealt: result.teamBDamageDealt,
      playerADamageTaken: result.teamADamageTaken, playerBDamageTaken: result.teamBDamageTaken,
      resultJson: { winner: result.winner, rounds: result.rounds },
      replayJson: result.log as unknown as any,
      status: "RESOLVED" as const, resolvedAt: new Date(),
    };

    if (pair.existingMatchId) {
      await prisma.weeklyMascotLeagueMatch.update({ where: { id: pair.existingMatchId }, data: matchData });
    } else {
      await prisma.weeklyMascotLeagueMatch.create({
        data: { id: createId(), leagueId, roundNumber, battleDate: today, battleSlot, scheduledAt: new Date(), playerAId: pair.aId, playerBId: pair.bId, ...matchData },
      });
    }

    await prisma.weeklyMascotLeagueBattleItem.updateMany({
      where: { leagueId, battleDate: today, battleSlot, playerId: { in: [pair.aId, pair.bId!] }, consumedAt: null, refundedAt: null },
      data: { consumedAt: new Date() },
    });

    // Update participant stats
    if (result.winner === "DRAW") {
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: pair.aId },
        data: { points: { increment: 1 }, draws: { increment: 1 }, damageDealt: { increment: result.teamADamageDealt }, damageTaken: { increment: result.teamADamageTaken }, survivorsScore: { increment: result.teamASurvivors }, updatedAt: new Date() },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: pair.bId },
        data: { points: { increment: 1 }, draws: { increment: 1 }, damageDealt: { increment: result.teamBDamageDealt }, damageTaken: { increment: result.teamBDamageTaken }, survivorsScore: { increment: result.teamBSurvivors }, updatedAt: new Date() },
      });
    } else {
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: winnerId! },
        data: { points: { increment: 3 }, wins: { increment: 1 }, damageDealt: { increment: winnerId === pair.aId ? result.teamADamageDealt : result.teamBDamageDealt }, damageTaken: { increment: winnerId === pair.aId ? result.teamADamageTaken : result.teamBDamageTaken }, survivorsScore: { increment: winnerId === pair.aId ? result.teamASurvivors : result.teamBSurvivors }, updatedAt: new Date() },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: loserId! },
        data: { losses: { increment: 1 }, damageDealt: { increment: loserId === pair.aId ? result.teamADamageDealt : result.teamBDamageDealt }, damageTaken: { increment: loserId === pair.aId ? result.teamADamageTaken : result.teamBDamageTaken }, survivorsScore: { increment: loserId === pair.aId ? result.teamASurvivors : result.teamBSurvivors }, updatedAt: new Date() },
      });
    }
  }

  const settledMatches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { leagueId, battleDate: today, battleSlot, status: { in: ["RESOLVED", "WO", "BYE"] } },
    select: { id: true },
  });
  await Promise.all(settledMatches.map((match) => settleWeeklyLeagueBets(match.id)));

  revalidatePath(PATH);
  return { success: true, matches: pairings.length };
  } catch (err) {
    return { error: `Erro na simulação: ${String(err).slice(0, 200)}` };
  }
}

// ── Regenerate replays only (no ranking changes) ────────────────────────

export async function regenerateReplaysAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const today = getTodayBrt();
    const matches = await prisma.weeklyMascotLeagueMatch.findMany({
      where: { leagueId, battleDate: today, status: "RESOLVED" },
    });

    if (matches.length === 0) return { error: "Nenhum combate resolvido hoje." };

    const league = await prisma.weeklyMascotLeague.findUnique({ where: { id: leagueId } });
    const modifier = league?.modifierJson as unknown as WeeklyModifier | null;
    let updated = 0;

    for (const match of matches) {
      if (!match.playerBId) continue;

      async function loadTeamForReplay(playerId: string, slot: number) {
        let dailyTeam = await prisma.weeklyMascotLeagueDailyTeam.findUnique({
          where: { leagueId_playerId_battleDate_battleSlot: { leagueId, playerId, battleDate: today, battleSlot: slot } },
        });
        if (!dailyTeam) {
          dailyTeam = await prisma.weeklyMascotLeagueDailyTeam.findFirst({
            where: { leagueId, playerId, battleSlot: slot },
            orderBy: { battleDate: "desc" },
          });
        }
        if (dailyTeam) {
          const ids = dailyTeam.mascotIdsJson as string[];
          const roles = (dailyTeam.rolesJson as Record<string, string>) ?? {};
          const mascots = await prisma.mascot.findMany({ where: { id: { in: ids }, playerId } });
          const ordered = ids.map(id => mascots.find(m => m.id === id)).filter(Boolean);
          return ordered.map((m, i) => toLeagueMascot(m!, i + 1, resolveMascotRole(m!, roles)));
        }
        const mascots = await prisma.mascot.findMany({ where: { playerId }, orderBy: { level: "desc" }, take: 6 });
        return mascots.map((m, i) => toLeagueMascot(m, i + 1, recommendCombatRole(m)));
      }

      const [teamA, teamB] = await Promise.all([
        loadTeamForReplay(match.playerAId, match.battleSlot),
        loadTeamForReplay(match.playerBId, match.battleSlot),
      ]);

      if (teamA.length < 6 || teamB.length < 6) continue;

      const result = runLeagueCombat(teamA, teamB, modifier);

      // Only update replay — keep winner, points, everything else untouched
      await prisma.weeklyMascotLeagueMatch.update({
        where: { id: match.id },
        data: { replayJson: result.log as unknown as any },
      });
      updated++;
    }

    revalidatePath(PATH);
    return { success: true, updated };
  } catch (err) {
    return { error: `Erro: ${String(err).slice(0, 200)}` };
  }
}

// ── Reset and re-simulate specific slots ─────────────────────────────────

export async function resetAndResimulateAction(leagueId: string, slots: number[]) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  if (!slots.length || slots.some(s => s < 1 || s > 3)) return { error: "Slots inválidos" };

  try {
    const league = await prisma.weeklyMascotLeague.findFirst({ where: { id: leagueId, status: "ACTIVE" } });
    if (!league) return { error: "Liga não ativa" };

    const today = getTodayBrt();

    // Find resolved matches for the given slots today
    const matches = await prisma.weeklyMascotLeagueMatch.findMany({
      where: { leagueId, battleDate: today, battleSlot: { in: slots }, status: { in: ["RESOLVED", "WO", "BYE"] } },
    });

    if (matches.length === 0) return { error: "Nenhuma partida resolvida encontrada para os slots selecionados." };

    // Revert participant stats for each match
    await prisma.$transaction(async (tx) => {
      for (const match of matches) {
        if (match.status === "BYE") {
          await tx.weeklyMascotLeagueParticipant.updateMany({
            where: { leagueId, playerId: match.playerAId },
            data: { points: { decrement: 3 }, byes: { decrement: 1 }, updatedAt: new Date() },
          });
        } else if (match.status === "WO") {
          if (match.winnerId) {
            await tx.weeklyMascotLeagueParticipant.updateMany({
              where: { leagueId, playerId: match.winnerId },
              data: { points: { decrement: 3 }, wins: { decrement: 1 }, updatedAt: new Date() },
            });
          }
          if (match.loserId) {
            await tx.weeklyMascotLeagueParticipant.updateMany({
              where: { leagueId, playerId: match.loserId },
              data: { woLosses: { decrement: 1 }, updatedAt: new Date() },
            });
          }
        } else if (match.isDraw) {
          await tx.weeklyMascotLeagueParticipant.updateMany({
            where: { leagueId, playerId: match.playerAId },
            data: { points: { decrement: 1 }, draws: { decrement: 1 }, damageDealt: { decrement: match.playerADamageDealt }, damageTaken: { decrement: match.playerADamageTaken }, survivorsScore: { decrement: match.playerASurvivors }, updatedAt: new Date() },
          });
          if (match.playerBId) {
            await tx.weeklyMascotLeagueParticipant.updateMany({
              where: { leagueId, playerId: match.playerBId },
              data: { points: { decrement: 1 }, draws: { decrement: 1 }, damageDealt: { decrement: match.playerBDamageDealt }, damageTaken: { decrement: match.playerBDamageTaken }, survivorsScore: { decrement: match.playerBSurvivors }, updatedAt: new Date() },
            });
          }
        } else if (match.winnerId && match.loserId) {
          const wIsA = match.winnerId === match.playerAId;
          await tx.weeklyMascotLeagueParticipant.updateMany({
            where: { leagueId, playerId: match.winnerId },
            data: { points: { decrement: 3 }, wins: { decrement: 1 }, damageDealt: { decrement: wIsA ? match.playerADamageDealt : match.playerBDamageDealt }, damageTaken: { decrement: wIsA ? match.playerADamageTaken : match.playerBDamageTaken }, survivorsScore: { decrement: wIsA ? match.playerASurvivors : match.playerBSurvivors }, updatedAt: new Date() },
          });
          await tx.weeklyMascotLeagueParticipant.updateMany({
            where: { leagueId, playerId: match.loserId },
            data: { losses: { decrement: 1 }, damageDealt: { decrement: !wIsA ? match.playerADamageDealt : match.playerBDamageDealt }, damageTaken: { decrement: !wIsA ? match.playerADamageTaken : match.playerBDamageTaken }, survivorsScore: { decrement: !wIsA ? match.playerASurvivors : match.playerBSurvivors }, updatedAt: new Date() },
          });
        }
      }

      // Delete the matches for these slots
      await tx.weeklyMascotLeagueMatch.deleteMany({
        where: { leagueId, battleDate: today, battleSlot: { in: slots } },
      });

      // Un-consume battle items so they can be re-used
      await tx.weeklyMascotLeagueBattleItem.updateMany({
        where: { leagueId, battleDate: today, battleSlot: { in: slots }, consumedAt: { not: null } },
        data: { consumedAt: null },
      });
    });

    // Re-simulate each slot
    const results = [];
    for (const slot of slots.sort()) {
      results.push({ slot, result: await simulateRoundAction(leagueId, slot) });
    }

    revalidatePath(PATH);
    return { success: true, results };
  } catch (err) {
    return { error: `Erro ao resetar/resimular: ${String(err).slice(0, 200)}` };
  }
}

// ── Full league reset: zero standings + regenerate + simulate all ────────

export async function fullLeagueResetAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const league = await prisma.weeklyMascotLeague.findUnique({ where: { id: leagueId } });
    if (!league) return { error: "Liga não encontrada" };

    await prisma.$transaction(async (tx) => {
      // Delete ALL matches, stats, items
      await tx.weeklyMascotLeagueMatch.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueMascotStats.deleteMany({ where: { leagueId } });
      await tx.weeklyMascotLeagueBattleItem.deleteMany({ where: { leagueId } });

      // Zero ALL participant stats
      await tx.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId },
        data: {
          points: 0, wins: 0, losses: 0, draws: 0, woLosses: 0, byes: 0,
          survivorsScore: 0, damageDealt: 0, damageTaken: 0,
          finalRank: null, rewardGranted: false, updatedAt: new Date(),
        },
      });

      // Purge inactive/deleted players
      const validPlayers = await findActiveWeeklyPlayers(tx);
      const validIds = new Set(validPlayers.map(p => p.id));
      const participants = await tx.weeklyMascotLeagueParticipant.findMany({
        where: { leagueId }, select: { id: true, playerId: true },
      });
      const toDelete = participants.filter(p => !validIds.has(p.playerId));
      if (toDelete.length > 0) {
        await tx.weeklyMascotLeagueDailyTeam.deleteMany({ where: { leagueId, playerId: { in: toDelete.map(p => p.playerId) } } });
        await tx.weeklyMascotLeagueParticipant.deleteMany({ where: { id: { in: toDelete.map(p => p.id) } } });
      }

      // Ensure league is ACTIVE
      await tx.weeklyMascotLeague.update({ where: { id: leagueId }, data: { status: "ACTIVE", updatedAt: new Date() } });
    });

    // Generate matchups
    const genResult = await generateDailyMatchupsAction(leagueId, true);
    if ("error" in genResult) return { error: `Reset OK mas matchups falharam: ${genResult.error}` };

    // Simulate all 3 slots
    const results = [];
    for (const slot of [1, 2, 3]) {
      results.push({ slot, result: await simulateRoundAction(leagueId, slot) });
    }

    revalidatePath(PATH);
    return { success: true, purged: 0, matchups: (genResult as any).matchups, results };
  } catch (err) {
    return { error: `Erro no reset: ${String(err).slice(0, 200)}` };
  }
}

// ── Seed shop items ───────────────────────────────────────────────────────

export async function seedLeagueItemsAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const now = new Date();
    let created = 0;

    for (const item of LEAGUE_ITEMS) {
      const exists = await prisma.shopItem.findFirst({ where: { type: item.type as never } });
      if (exists) {
        await prisma.shopItem.update({ where: { id: exists.id }, data: { name: item.name, description: item.description, price: item.price, active: true } });
      } else {
        await prisma.shopItem.create({
          data: {
            id: createId(),
            type: item.type as never,
            name: item.name,
            description: item.description,
            price: item.price,
            active: true,
            createdAt: now,
            updatedAt: now,
          },
        });
        created++;
      }
    }

    revalidatePath(PATH);
    revalidatePath("/shop");
    revalidateTag("shop-items-active");
    return { success: true, created };
  } catch (err) {
    return { error: `Erro ao criar itens: ${String(err).slice(0, 200)}` };
  }
}

// ── Buy league item ───────────────────────────────────────────────────────

export async function buyLeagueItemAction(itemType: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const def = LEAGUE_ITEMS.find(i => i.type === itemType);
  if (!def) return { error: "Item inválido" };

  try {
    const shopItem = await prisma.shopItem.findFirst({ where: { type: itemType as never } });
    if (!shopItem) return { error: "Item não existe no banco. Execute o Seed primeiro." };

    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < def.price) {
      return { error: `ZikaCoins insuficientes. Você tem ${wallet?.balance ?? 0} ZC, precisa de ${def.price} ZC.` };
    }

    await prisma.$transaction(async (tx) => {
      await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: def.price }, totalSpent: { increment: def.price }, updatedAt: new Date() },
      });
      await tx.playerInventory.upsert({
        where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } },
        create: { id: createId(), playerId: player.id, itemId: shopItem.id, quantity: 1, source: "LEAGUE_SHOP" },
        update: { quantity: { increment: 1 } },
      });
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao comprar: ${String(err).slice(0, 200)}` };
  }
}

export async function selectBattleItemsAction(leagueId: string, battleSlot: number, itemTypes: string[]) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Nao autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador nao encontrado" };
  if (battleSlot < 1 || battleSlot > 3) return { error: "Combate invalido" };
  if (itemTypes.length > 2 || new Set(itemTypes).size !== itemTypes.length) return { error: "Escolha ate 2 itens diferentes" };
  if (itemTypes.some((type) => !LEAGUE_ITEMS.some((item) => item.type === type))) return { error: "Item invalido" };

  const battleDate = getTodayBrt();
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.weeklyMascotLeagueBattleItem.findMany({ where: { leagueId, playerId: player.id, battleDate, battleSlot, consumedAt: null } });
      for (const previous of existing) {
        const inventory = await tx.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: previous.itemId } } });
        if (inventory) await tx.playerInventory.update({ where: { id: inventory.id }, data: { quantity: { increment: 1 } } });
      }
      await tx.weeklyMascotLeagueBattleItem.deleteMany({ where: { leagueId, playerId: player.id, battleDate, battleSlot, consumedAt: null } });

      for (const type of itemTypes) {
        const definition = LEAGUE_ITEMS.find((item) => item.type === type)!;
        const inventory = await tx.playerInventory.findFirst({ where: { playerId: player.id, quantity: { gt: 0 }, item: { type: type as never } } });
        if (!inventory || inventory.quantity < 1) throw new Error(`Voce nao possui ${definition.name}`);
        await tx.playerInventory.update({ where: { id: inventory.id }, data: { quantity: { decrement: 1 } } });
        await tx.weeklyMascotLeagueBattleItem.create({ data: { id: createId(), leagueId, playerId: player.id, itemId: inventory.itemId, effectType: type, targetType: definition.targetType, battleDate, battleSlot } });
      }
    });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error instanceof Error ? error.message : error).slice(0, 160) };
  }
}

const WEEKLY_BOX_POOL = [
  { kind: "EGG", eggType: EggType.RARE, label: "Ovo Raro", weight: 34 },
  { kind: "EGG", eggType: EggType.EVENT, label: "Ovo de Evento", weight: 24 },
  { kind: "ITEM", itemType: "MASCOT_BUFF_LUCK", label: "Amuleto da Sorte", weight: 20 },
  { kind: "ITEM", itemType: "MASCOT_BUFF_EXP", label: "Vitamina Chocante", weight: 16 },
  { kind: "EGG", eggType: EggType.SPECIAL, label: "Ovo Especial", weight: 6 },
] as const;

function drawWeeklyBoxReward() {
  const roll = Math.random() * 100;
  let cursor = 0;
  return WEEKLY_BOX_POOL.find((reward) => (cursor += reward.weight) > roll) ?? WEEKLY_BOX_POOL[0];
}

function weeklyCoinsForRank(rank: number) {
  if (rank === 4) return 700;
  if (rank === 5) return 600;
  if (rank === 6) return 500;
  if (rank <= 10) return 400;
  if (rank <= 15) return 300;
  return 200;
}

export async function finalizeLeagueAction(leagueId: string, automationSecret?: string) {
  const session = await getAppSession();
  const automated = Boolean(process.env.CRON_SECRET && automationSecret === process.env.CRON_SECRET);
  if (!automated && (!session?.user || !isAdmin(session.user.role))) return { error: "Acesso restrito" };

  try {
    const participants = await prisma.weeklyMascotLeagueParticipant.findMany({
      where: { leagueId },
      orderBy: [{ points: "desc" }, { wins: "desc" }, { survivorsScore: "desc" }, { damageDealt: "desc" }],
    });
    if (!participants.length) return { error: "Liga sem participantes." };

    let granted = 0;
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < participants.length; index++) {
        const participant = participants[index];
        if (participant.rewardGranted) continue;
        const matchesPlayed = participant.wins + participant.losses + participant.draws + participant.woLosses + participant.byes;
        if (matchesPlayed === 0) continue;

        const rank = index + 1;
        const claimed = await tx.weeklyMascotLeagueParticipant.updateMany({
          where: { id: participant.id, rewardGranted: false },
          data: { finalRank: rank, rewardGranted: true },
        });
        if (claimed.count === 0) continue;
        const boxItems = rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0;
        await tx.playerGift.create({
          data: {
            playerId: participant.playerId,
            type: GiftType.CUSTOM,
            title: "Liga Semanal: Ovo de Evento",
            description: `Premio de participacao valida - ${rank}o lugar.`,
            payload: { rewardKind: "MASCOT_EGG", eggType: EggType.EVENT, origin: `liga-semanal:${leagueId}` },
          },
        });

        for (let boxIndex = 0; boxIndex < boxItems; boxIndex++) {
          const reward = drawWeeklyBoxReward();
          await tx.playerGift.create({
            data: {
              playerId: participant.playerId,
              type: GiftType.CUSTOM,
              title: `Caixa Surpresa: ${reward.label}`,
              description: `Conteudo da caixa do ${rank}o lugar da Liga Semanal.`,
              payload: reward.kind === "EGG"
                ? { rewardKind: "MASCOT_EGG", eggType: reward.eggType, origin: `liga-semanal-caixa:${leagueId}` }
                : { rewardKind: "MASCOT_BUFF", buffType: reward.itemType, quantity: 1 },
            },
          });
        }

        if (rank > 3) {
          const coins = weeklyCoinsForRank(rank);
          const wallet = await tx.zikaCoinWallet.upsert({ where: { playerId: participant.playerId }, create: { playerId: participant.playerId }, update: {} });
          await tx.zikaCoinTransaction.create({
            data: { walletId: wallet.id, type: ZikaCoinTxType.PARTICIPATION_REWARD, amount: coins, balanceBefore: wallet.balance, balanceAfter: wallet.balance + coins, description: `Liga Semanal - ${rank}o lugar` },
          });
          await tx.zikaCoinWallet.update({ where: { id: wallet.id }, data: { balance: { increment: coins }, totalEarned: { increment: coins } } });
        }

        granted++;
      }
      await tx.weeklyMascotLeague.update({ where: { id: leagueId }, data: { status: "FINISHED", championPlayerId: participants[0].playerId } });
    }, { timeout: 20000, maxWait: 10000 });

    revalidatePath(PATH);
    revalidatePath("/caixa-de-presentes");
    return { success: true, granted };
  } catch (error) {
    return { error: `Falha ao encerrar: ${String(error).slice(0, 180)}` };
  }
}

export async function runWeeklyLeagueAutomation(automationSecret: string, nowIso?: string) {
  if (!process.env.CRON_SECRET || automationSecret !== process.env.CRON_SECRET) return { error: "Acesso restrito" };

  const now = nowIso ? new Date(nowIso) : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday");
  const minuteOfDay = Number(value("hour")) * 60 + Number(value("minute"));
  if (!new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]).has(weekday)) return { success: true, skipped: "weekend" };

  const activeLeagueItems = await prisma.shopItem.count({
    where: { active: true, type: { in: LEAGUE_ITEMS.map((item) => item.type) as never[] } },
  });
  if (activeLeagueItems < LEAGUE_ITEMS.length) {
    await prisma.$transaction(async (tx) => {
      for (const item of LEAGUE_ITEMS) {
        const existing = await tx.shopItem.findFirst({ where: { type: item.type as never }, select: { id: true } });
        if (existing) await tx.shopItem.update({ where: { id: existing.id }, data: { name: item.name, description: item.description, price: item.price, active: true } });
        else await tx.shopItem.create({ data: { id: createId(), type: item.type as never, name: item.name, description: item.description, price: item.price, active: true, updatedAt: now } });
      }
    });
    revalidateTag("shop-items-active");
    revalidatePath("/shop");
  }

  const weekKey = getCurrentWeekKey();
  let league = await prisma.weeklyMascotLeague.findUnique({ where: { weekKey } });
  if (!league) {
    const { weekStart, weekEnd } = getWeekBounds();
    league = await prisma.$transaction(async (tx) => {
      const created = await tx.weeklyMascotLeague.create({ data: { id: createId(), weekKey, weekStart, weekEnd, status: "REGISTRATION", updatedAt: now } });
      const players = await findActiveWeeklyPlayers(tx, now);
      if (players.length) await tx.weeklyMascotLeagueParticipant.createMany({ data: players.map((player) => ({ id: createId(), leagueId: created.id, playerId: player.id, updatedAt: now })), skipDuplicates: true });
      return created;
    });
  }
  if (league.status === "FINISHED") return { success: true, skipped: "finished" };

  const battleDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const storedModifier = (league.modifierJson ?? {}) as Record<string, unknown>;
  if (storedModifier.dailyDate !== battleDate) {
    const history = Array.isArray(storedModifier.dailyHistory) ? storedModifier.dailyHistory.filter((id): id is string => typeof id === "string") : [];
    const available = WEEKLY_MODIFIERS.filter((modifier) => !history.includes(modifier.id));
    const pool = available.length ? available : WEEKLY_MODIFIERS;
    const seed = [...battleDate].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const modifier = pool[seed % pool.length];
    const dailyHistory = [...history, modifier.id].slice(-5);
    league = await prisma.weeklyMascotLeague.update({
      where: { id: league.id },
      data: { status: "ACTIVE", modifierJson: { ...modifier, dailyDate: battleDate, dailyHistory }, updatedAt: now },
    });
  } else if (league.status === "REGISTRATION") {
    league = await prisma.weeklyMascotLeague.update({ where: { id: league.id }, data: { status: "ACTIVE" } });
  }

  // Pre-generate matchups early in the day (after 08:00 BRT)
  if (minuteOfDay >= 8 * 60) {
    const existingToday = await prisma.weeklyMascotLeagueMatch.findFirst({ where: { leagueId: league.id, battleDate } });
    if (!existingToday) {
      const participants = await prisma.weeklyMascotLeagueParticipant.findMany({
        where: { leagueId: league.id },
        orderBy: [{ points: "desc" }, { wins: "desc" }, { damageDealt: "desc" }],
      });
      if (participants.length >= 2) {
        const faced = await loadFacedOpponents(league.id);
        const todayPaired = new Map<string, Set<string>>();
        const byeCount = new Map<string, number>();
        const roundBase = await prisma.weeklyMascotLeagueMatch.count({ where: { leagueId: league.id } });

        for (const battleSlot of [1, 2, 3]) {
          const pairings = swissPairSlot(participants, faced, todayPaired, byeCount, battleSlot);
          for (const pair of pairings) {
            if (pair.bId) {
              const pA = participants.find(p => p.playerId === pair.aId)!;
              const pB = participants.find(p => p.playerId === pair.bId)!;
              const { oddsA, oddsB } = calculateLeagueOdds(pA, pB);
              await prisma.weeklyMascotLeagueMatch.create({
                data: { id: createId(), leagueId: league.id, roundNumber: roundBase + battleSlot, battleDate, battleSlot, scheduledAt: now, playerAId: pair.aId, playerBId: pair.bId, status: "SCHEDULED", resultJson: { oddsA, oddsB } },
              });
              if (!faced.has(pair.aId)) faced.set(pair.aId, new Set());
              if (!faced.has(pair.bId)) faced.set(pair.bId, new Set());
              faced.get(pair.aId)!.add(pair.bId);
              faced.get(pair.bId)!.add(pair.aId);
            } else {
              await prisma.weeklyMascotLeagueMatch.create({
                data: { id: createId(), leagueId: league.id, roundNumber: roundBase + battleSlot, battleDate, battleSlot, scheduledAt: now, playerAId: pair.aId, status: "BYE", resolvedAt: now },
              });
              await prisma.weeklyMascotLeagueParticipant.updateMany({
                where: { leagueId: league.id, playerId: pair.aId },
                data: { points: { increment: 3 }, byes: { increment: 1 }, updatedAt: now },
              });
            }
          }
        }
      }
    }
  }

  let dueSlots = [
    { slot: 1, minute: 20 * 60 },
    { slot: 2, minute: 20 * 60 + 10 },
    { slot: 3, minute: 20 * 60 + 20 },
  ].filter((entry) => minuteOfDay >= entry.minute);

  if (dueSlots.length) {
    const completedSlots = await prisma.weeklyMascotLeagueMatch.findMany({
      where: { leagueId: league.id, battleDate, battleSlot: { in: dueSlots.map((entry) => entry.slot) }, status: { in: ["RESOLVED", "WO"] } },
      select: { battleSlot: true },
      distinct: ["battleSlot"],
    });
    const completed = new Set(completedSlots.map((match) => match.battleSlot));
    dueSlots = dueSlots.filter((entry) => !completed.has(entry.slot));
  }

  if (dueSlots.length) {
    const participants = await prisma.weeklyMascotLeagueParticipant.findMany({ where: { leagueId: league.id }, select: { playerId: true } });
    const playerIds = participants.map((participant) => participant.playerId);
    const [existingTeams, previousTeams, mascots] = await Promise.all([
      prisma.weeklyMascotLeagueDailyTeam.findMany({ where: { leagueId: league.id, battleDate, playerId: { in: playerIds } }, select: { playerId: true, battleSlot: true, mascotIdsJson: true, rolesJson: true } }),
      prisma.weeklyMascotLeagueDailyTeam.findMany({
        where: { leagueId: league.id, battleDate: { lt: battleDate }, playerId: { in: playerIds }, battleSlot: { in: dueSlots.map((entry) => entry.slot) } },
        select: { playerId: true, battleSlot: true, battleDate: true, mascotIdsJson: true, rolesJson: true },
        orderBy: { battleDate: "desc" },
      }),
      prisma.mascot.findMany({
        where: { playerId: { in: playerIds } },
        select: {
          id: true,
          playerId: true,
          isFavorite: true,
          level: true,
          statForce: true,
          statAgility: true,
          statVitality: true,
          statInstinct: true,
          statCharisma: true,
        },
        orderBy: [{ isFavorite: "desc" }, { level: "desc" }],
      }),
    ]);
    const teamKey = new Set(existingTeams.map((team) => `${team.playerId}:${team.battleSlot}`));
    const previousByKey = new Map<string, typeof previousTeams[number]>();
    for (const team of previousTeams) {
      const key = `${team.playerId}:${team.battleSlot}`;
      if (!previousByKey.has(key)) previousByKey.set(key, team);
    }
    const usedByPlayer = new Map<string, Set<string>>();
    for (const team of existingTeams) {
      const used = usedByPlayer.get(team.playerId) ?? new Set<string>();
      for (const id of (team.mascotIdsJson as string[])) used.add(id);
      usedByPlayer.set(team.playerId, used);
    }
    const mascotsByPlayer = new Map<string, typeof mascots>();
    for (const mascot of mascots) mascotsByPlayer.set(mascot.playerId, [...(mascotsByPlayer.get(mascot.playerId) ?? []), mascot]);
    const mascotById = new Map(mascots.map((mascot) => [mascot.id, mascot]));

    await prisma.$transaction(async (tx) => {
      for (const participant of participants) {
        const used = usedByPlayer.get(participant.playerId) ?? new Set<string>();
        for (const { slot } of dueSlots) {
          if (teamKey.has(`${participant.playerId}:${slot}`)) continue;
          const previous = previousByKey.get(`${participant.playerId}:${slot}`);
          const previousRoles = (previous?.rolesJson as Record<string, string> | null) ?? {};
          const inherited = ((previous?.mascotIdsJson as string[] | undefined) ?? []).flatMap((id) => {
            const mascot = mascotById.get(id);
            return mascot && !used.has(mascot.id) ? [mascot] : [];
          });
          const selected = inherited.slice(0, 6);
          if (selected.length < 6) {
            const selectedIds = new Set(selected.map((mascot) => mascot.id));
            selected.push(...(mascotsByPlayer.get(participant.playerId) ?? [])
              .filter((mascot) => !used.has(mascot.id) && !selectedIds.has(mascot.id))
              .slice(0, 6 - selected.length));
          }
          for (const mascot of selected) used.add(mascot.id);
          const rolesJson = {
            ...recommendedRolesForMascots(selected),
            ...Object.fromEntries(selected.filter((mascot) => previousRoles[mascot.id]).map((mascot) => [mascot.id, previousRoles[mascot.id]])),
          };
          await tx.weeklyMascotLeagueDailyTeam.create({
            data: {
              id: createId(),
              leagueId: league!.id,
              playerId: participant.playerId,
              battleDate,
              battleSlot: slot,
              source: previous ? "INHERITED_AUTO" : "AUTO_FAVORITE",
              mascotIdsJson: selected.map((mascot) => mascot.id),
              rolesJson,
              lockedAt: now,
              updatedAt: now,
            },
          });
        }
      }
    });
  }

  const results = [];
  for (const { slot } of dueSlots) results.push({ slot, result: await simulateRoundAction(league.id, slot, automationSecret) });

  let finalized: unknown = null;
  if (weekday === "Fri" && minuteOfDay >= 20 * 60 + 30) finalized = await finalizeLeagueAction(league.id, automationSecret);
  return { success: true, leagueId: league.id, battleDate, modifier: (league.modifierJson as Record<string, unknown>)?.id, results, finalized };
}
