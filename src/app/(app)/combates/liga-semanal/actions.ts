"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { WEEKLY_MODIFIERS, LEAGUE_ITEMS } from "./constants";
import { toLeagueMascot, runLeagueCombat } from "@/lib/league-combat";
import type { WeeklyModifier } from "./constants";

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

const PATH = "/combates/liga-semanal";

// ── Read action (client refresh) ──────────────────────────────────────────

export async function getLeagueDataAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const { getLeaguePageData } = await import("./data");
  const data = await getLeaguePageData(player.id, player.displayName);
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

      await tx.weeklyMascotLeagueParticipant.create({
        data: {
          id: createId(),
          leagueId: league.id,
          playerId: player.id,
          updatedAt: new Date(),
        },
      });
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao criar liga: ${String(err).slice(0, 200)}. A migration SQL 011 foi aplicada?` };
  }
}

// ── Join league ───────────────────────────────────────────────────────────

export async function joinLeagueAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };
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

// ── Save daily team ───────────────────────────────────────────────────────

export async function saveDailyTeamAction(
  leagueId: string,
  battleSlot: number,
  mascotIds: string[],
  roles: Record<string, string>,
) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  if (mascotIds.length !== 6) return { error: "Selecione exatamente 6 mascotes." };
  if (battleSlot < 1 || battleSlot > 3) return { error: "Slot inválido." };

  try {
    const today = new Date().toISOString().slice(0, 10);

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

export async function simulateRoundAction(leagueId: string, battleSlot: number) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

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

  const today = new Date().toISOString().slice(0, 10);
  const existingMatches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { leagueId, battleDate: today, battleSlot },
  });
  if (existingMatches.length > 0) return { error: `Slot ${battleSlot} de hoje já foi simulado` };

  const roundNumber = await prisma.weeklyMascotLeagueMatch.count({ where: { leagueId } }) + 1;
  const modifier = league.modifierJson as unknown as WeeklyModifier | null;

  // Swiss pairing: pair by proximity in standings
  const paired = new Set<string>();
  const pairings: Array<{ aId: string; bId: string | null }> = [];

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (paired.has(p.playerId)) continue;

    let opponent: typeof p | null = null;
    for (let j = i + 1; j < participants.length; j++) {
      if (!paired.has(participants[j].playerId)) {
        opponent = participants[j];
        break;
      }
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

  // Run all matches
  for (const pair of pairings) {
    if (!pair.bId) {
      // BYE
      await prisma.weeklyMascotLeagueMatch.create({
        data: {
          id: createId(),
          leagueId,
          roundNumber,
          battleDate: today,
          battleSlot,
          scheduledAt: new Date(),
          playerAId: pair.aId,
          status: "BYE",
          resolvedAt: new Date(),
        },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: pair.aId },
        data: { points: { increment: 3 }, byes: { increment: 1 }, updatedAt: new Date() },
      });
      continue;
    }

    // Get mascots for both players (auto-select top 6 by level)
    const [mascotsA, mascotsB] = await Promise.all([
      prisma.mascot.findMany({
        where: { playerId: pair.aId },
        orderBy: { level: "desc" },
        take: 6,
      }),
      prisma.mascot.findMany({
        where: { playerId: pair.bId },
        orderBy: { level: "desc" },
        take: 6,
      }),
    ]);

    if (mascotsA.length < 6 || mascotsB.length < 6) {
      // WO for the team with insufficient mascots
      const woPlayer = mascotsA.length < 6 ? pair.aId : pair.bId;
      const winPlayer = woPlayer === pair.aId ? pair.bId : pair.aId;
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

    const teamA = mascotsA.map((m, i) => toLeagueMascot(m, i + 1));
    const teamB = mascotsB.map((m, i) => toLeagueMascot(m, i + 1));

    const result = runLeagueCombat(teamA, teamB, modifier);

    const winnerId = result.winner === "A" ? pair.aId : result.winner === "B" ? pair.bId : null;
    const loserId = result.winner === "A" ? pair.bId : result.winner === "B" ? pair.aId : null;

    await prisma.weeklyMascotLeagueMatch.create({
      data: {
        id: createId(), leagueId, roundNumber, battleDate: today, battleSlot,
        scheduledAt: new Date(), playerAId: pair.aId, playerBId: pair.bId,
        winnerId, loserId, isDraw: result.winner === "DRAW",
        playerASurvivors: result.teamASurvivors, playerBSurvivors: result.teamBSurvivors,
        playerADamageDealt: result.teamADamageDealt, playerBDamageDealt: result.teamBDamageDealt,
        playerADamageTaken: result.teamADamageTaken, playerBDamageTaken: result.teamBDamageTaken,
        resultJson: { winner: result.winner, rounds: result.rounds },
        replayJson: result.log as unknown as any,
        status: "RESOLVED", resolvedAt: new Date(),
      },
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

  revalidatePath(PATH);
  return { success: true, matches: pairings.length };
  } catch (err) {
    return { error: `Erro na simulação: ${String(err).slice(0, 200)}` };
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
      if (!exists) {
        await prisma.shopItem.create({
          data: {
            id: createId(),
            type: item.type as never,
            name: item.name,
            description: item.description,
            price: item.price,
            active: false,
            createdAt: now,
            updatedAt: now,
          },
        });
        created++;
      }
    }

    revalidatePath(PATH);
    return { success: true, created };
  } catch (err) {
    return { error: `Erro ao criar itens: ${String(err).slice(0, 200)}` };
  }
}
