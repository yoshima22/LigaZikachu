"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { ZikaBetStatus, ZikaCoinTxType } from "@prisma/client";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";
import { parseBetConfig } from "@/lib/zikabet";
const WEEKLY_LEAGUE_BET_CONFIG = {
  minBet: 10,
  maxBet: 500,
  maxDailyBet: 2000,
  allowBetOnSelf: false,
};

// ── Config de apostas ─────────────────────────────────────────────────────────

const betConfigSchema = z.object({
  tournamentId: z.string().min(1),
  enabled: z.boolean(),
  allowBetOnSelf: z.boolean(),
  minBet: z.number().int().min(1),
  maxBet: z.number().int().min(1),
  maxDailyBet: z.number().int().min(1)
});

export async function updateBetConfig(raw: z.infer<typeof betConfigSchema>): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    const { tournamentId, ...config } = betConfigSchema.parse(raw);
    await prisma.tournament.update({ where: { id: tournamentId }, data: { betConfig: config } });
    revalidatePath("/zikabet");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Odds por partida ──────────────────────────────────────────────────────────

export async function setMatchOdds(
  matchId: string,
  playerAOdds: number,
  playerBOdds: number,
  betsEnabled: boolean
): Promise<{ error?: string }> {
  try {
    await requireAdmin();
    await prisma.match.update({
      where: { id: matchId },
      data: {
        playerAOdds: playerAOdds,
        playerBOdds: playerBOdds,
        betsEnabled
      }
    });

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { tournamentWeek: { include: { tournament: true } } }
    });
    if (match?.tournamentWeek?.tournament?.slug) {
      revalidatePath(`/zikabet`);
      revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`);
    }
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Fazer aposta ──────────────────────────────────────────────────────────────

const placeBetSchema = z.object({
  matchId: z.string().min(1),
  betOnPlayerId: z.string().min(1),
  amount: z.number().int().min(1)
});

const placeWeeklyLeagueBetSchema = z.object({
  weeklyMatchId: z.string().min(1),
  betOnPlayerId: z.string().min(1),
  amount: z.number().int().min(1)
});

export async function placeBet(raw: z.infer<typeof placeBetSchema>): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    const data = placeBetSchema.parse(raw);

    const player = await getSessionPlayer(actor.id);
    if (!player) return { error: "Jogador não encontrado." };

    const match = await prisma.match.findUnique({
      where: { id: data.matchId },
      include: {
        tournamentWeek: {
          include: { tournament: { select: { id: true, slug: true, betConfig: true } } }
        }
      }
    });
    if (!match) return { error: "Partida não encontrada." };
    if (!match.betsEnabled) return { error: "Apostas não estão habilitadas nesta partida." };
    if (match.status !== "DRAFT" && match.status !== "PENDING_CONFIRMATION")
      return { error: "Esta partida já foi encerrada — apostas fechadas." };

    const config = parseBetConfig(match.tournamentWeek?.tournament?.betConfig);
    if (!config.enabled) return { error: "ZikaBet não está habilitada neste torneio." };
    if (data.amount < config.minBet) return { error: `Aposta mínima: ${config.minBet} ZC.` };
    if (data.amount > config.maxBet) return { error: `Aposta máxima: ${config.maxBet} ZC.` };

    if (!config.allowBetOnSelf) {
      if (match.playerAId === player.id || match.playerBId === player.id)
        return { error: "Não é permitido apostar em sua própria partida." };
    }

    if (data.betOnPlayerId !== match.playerAId && data.betOnPlayerId !== match.playerBId)
      return { error: "Jogador inválido para esta partida." };

    // Verificar aposta já existente
    const existing = await prisma.zikaBet.findUnique({
      where: { playerId_matchId: { playerId: player.id, matchId: data.matchId } }
    });
    if (existing) return { error: "Você já fez uma aposta nesta partida." };

    // Verificar limite diário
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dailySpent = await prisma.zikaBet.aggregate({
      where: { playerId: player.id, placedAt: { gte: startOfDay }, status: { notIn: [ZikaBetStatus.REFUNDED, ZikaBetStatus.CANCELLED] } },
      _sum: { amount: true }
    });
    if ((dailySpent._sum.amount ?? 0) + data.amount > config.maxDailyBet)
      return { error: `Limite diário de apostas: ${config.maxDailyBet} ZC.` };

    const isOnA = data.betOnPlayerId === match.playerAId;
    const odds = isOnA
      ? Number(match.playerAOdds ?? 1.5)
      : Number(match.playerBOdds ?? 1.5);
    const potentialReturn = Math.floor(data.amount * odds);

    await prisma.$transaction(async (tx) => {
      const wallet = await getOrCreateWallet(player.id);
      if (wallet.balance < data.amount) throw new Error(`Saldo insuficiente. Você tem ${wallet.balance} ZC.`);

      await creditCoins(tx, {
        playerId: player.id,
        type: ZikaCoinTxType.BET_PLACED,
        amount: -data.amount,
        description: `Aposta na partida`,
        tournamentId: match.tournamentWeek?.tournament?.id,
        tournamentWeekId: match.tournamentWeekId ?? undefined,
        matchId: data.matchId
      });

      await tx.zikaBet.create({
        data: {
          playerId: player.id,
          matchId: data.matchId,
          betOnPlayerId: data.betOnPlayerId,
          amount: data.amount,
          odds,
          potentialReturn,
          status: ZikaBetStatus.OPEN
        }
      });
    });

    revalidatePath("/zikabet");
    revalidatePath("/zikabet/minhas-apostas");
    revalidatePath("/carteira");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Liquidar apostas do dia (chamado pelo closeWeek) ─────────────────────────

export async function placeWeeklyLeagueBet(raw: z.infer<typeof placeWeeklyLeagueBetSchema>): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Nao autenticado." };
    const data = placeWeeklyLeagueBetSchema.parse(raw);

    const player = await getSessionPlayer(actor.id);
    if (!player) return { error: "Jogador nao encontrado." };

    const match = await prisma.weeklyMascotLeagueMatch.findUnique({
      where: { id: data.weeklyMatchId },
      select: { id: true, playerAId: true, playerBId: true, status: true, resultJson: true },
    });
    if (!match) return { error: "Combate da Liga Semanal nao encontrado." };
    if (match.status !== "SCHEDULED") return { error: "Este combate ja nao aceita apostas." };
    if (!match.playerBId) return { error: "Combate sem adversario nao aceita apostas." };
    if (data.betOnPlayerId !== match.playerAId && data.betOnPlayerId !== match.playerBId) return { error: "Jogador invalido para este combate." };
    if (!WEEKLY_LEAGUE_BET_CONFIG.allowBetOnSelf && (match.playerAId === player.id || match.playerBId === player.id)) return { error: "Nao e permitido apostar em sua propria luta da Liga Semanal." };
    if (data.amount < WEEKLY_LEAGUE_BET_CONFIG.minBet) return { error: `Aposta minima: ${WEEKLY_LEAGUE_BET_CONFIG.minBet} ZC.` };
    if (data.amount > WEEKLY_LEAGUE_BET_CONFIG.maxBet) return { error: `Aposta maxima: ${WEEKLY_LEAGUE_BET_CONFIG.maxBet} ZC.` };

    const existing = await prisma.weeklyMascotLeagueBet.findUnique({ where: { playerId_weeklyMatchId: { playerId: player.id, weeklyMatchId: data.weeklyMatchId } } });
    if (existing) return { error: "Voce ja fez uma aposta neste combate." };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [dailyTcgSpent, dailyWeeklySpent] = await Promise.all([
      prisma.zikaBet.aggregate({ where: { playerId: player.id, placedAt: { gte: startOfDay }, status: { notIn: [ZikaBetStatus.REFUNDED, ZikaBetStatus.CANCELLED] } }, _sum: { amount: true } }),
      prisma.weeklyMascotLeagueBet.aggregate({ where: { playerId: player.id, placedAt: { gte: startOfDay }, status: { notIn: [ZikaBetStatus.REFUNDED, ZikaBetStatus.CANCELLED] } }, _sum: { amount: true } }),
    ]);
    const dailySpent = (dailyTcgSpent._sum.amount ?? 0) + (dailyWeeklySpent._sum.amount ?? 0);
    if (dailySpent + data.amount > WEEKLY_LEAGUE_BET_CONFIG.maxDailyBet) return { error: `Limite diario de apostas: ${WEEKLY_LEAGUE_BET_CONFIG.maxDailyBet} ZC.` };

    const oddsJson = (match.resultJson ?? {}) as Record<string, unknown>;
    const odds = data.betOnPlayerId === match.playerAId ? Number(oddsJson.oddsA ?? 1.9) : Number(oddsJson.oddsB ?? 1.9);
    const potentialReturn = Math.floor(data.amount * odds);

    await prisma.$transaction(async (tx) => {
      const wallet = await getOrCreateWallet(player.id);
      if (wallet.balance < data.amount) throw new Error(`Saldo insuficiente. Voce tem ${wallet.balance} ZC.`);
      await creditCoins(tx, { playerId: player.id, type: ZikaCoinTxType.BET_PLACED, amount: -data.amount, description: "Aposta na Liga Semanal dos Mascotes" });
      await tx.weeklyMascotLeagueBet.create({ data: { playerId: player.id, weeklyMatchId: data.weeklyMatchId, betOnPlayerId: data.betOnPlayerId, amount: data.amount, odds, potentialReturn, status: ZikaBetStatus.OPEN } });
    });

    revalidatePath("/zikabet");
    revalidatePath("/zikabet/minhas-apostas");
    revalidatePath("/carteira");
    return {};
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0].message };
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

export async function settleWeeklyLeagueBets(weeklyMatchId: string): Promise<void> {
  const match = await prisma.weeklyMascotLeagueMatch.findUnique({ where: { id: weeklyMatchId }, select: { status: true, winnerId: true, isDraw: true } });
  if (!match || match.status === "SCHEDULED") return;

  const bets = await prisma.weeklyMascotLeagueBet.findMany({ where: { weeklyMatchId, status: { in: [ZikaBetStatus.OPEN, ZikaBetStatus.CLOSED] } } });
  if (bets.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const bet of bets) {
      if (match.isDraw || !match.winnerId) {
        await creditCoins(tx, { playerId: bet.playerId, type: ZikaCoinTxType.BET_REFUNDED, amount: bet.amount, description: "Reembolso de aposta na Liga Semanal (empate)" });
        await tx.weeklyMascotLeagueBet.update({ where: { id: bet.id }, data: { status: ZikaBetStatus.REFUNDED, settledAt: new Date() } });
      } else if (bet.betOnPlayerId === match.winnerId) {
        await creditCoins(tx, { playerId: bet.playerId, type: ZikaCoinTxType.BET_WON, amount: bet.potentialReturn, description: `Aposta vencida na Liga Semanal (${Number(bet.odds)}x)` });
        await tx.weeklyMascotLeagueBet.update({ where: { id: bet.id }, data: { status: ZikaBetStatus.WON, settledAt: new Date() } });
      } else {
        await tx.weeklyMascotLeagueBet.update({ where: { id: bet.id }, data: { status: ZikaBetStatus.LOST, settledAt: new Date() } });
      }
    }
  });

  revalidatePath("/zikabet");
  revalidatePath("/zikabet/minhas-apostas");
  revalidatePath("/carteira");
}

export async function settleDayBets(weekId: string, adminId: string): Promise<void> {
  const bets = await prisma.zikaBet.findMany({
    where: {
      match: { tournamentWeekId: weekId },
      status: { in: [ZikaBetStatus.OPEN, ZikaBetStatus.CLOSED] }
    },
    include: {
      match: true,
      player: { select: { id: true } }
    }
  });

  for (const bet of bets) {
    const match = bet.match;

    // Partida cancelada ou sem resultado → reembolso
    if (match.status === "CANCELED" || !match.winnerPlayerId) {
      await prisma.$transaction(async (tx) => {
        await tx.zikaBet.update({
          where: { id: bet.id },
          data: { status: ZikaBetStatus.REFUNDED, settledAt: new Date() }
        });
        await creditCoins(tx, {
          playerId: bet.playerId,
          type: ZikaCoinTxType.BET_REFUNDED,
          amount: bet.amount,
          description: "Reembolso — partida sem resultado",
          matchId: bet.matchId,
          adminId
        });
      });
      continue;
    }

    const won = bet.betOnPlayerId === match.winnerPlayerId;

    if (won) {
      await prisma.$transaction(async (tx) => {
        await tx.zikaBet.update({
          where: { id: bet.id },
          data: { status: ZikaBetStatus.WON, settledAt: new Date() }
        });
        await creditCoins(tx, {
          playerId: bet.playerId,
          type: ZikaCoinTxType.BET_WON,
          amount: bet.potentialReturn,
          description: `Aposta vencida (${Number(bet.odds)}x)`,
          matchId: bet.matchId,
          adminId
        });
      });
    } else {
      await prisma.zikaBet.update({
        where: { id: bet.id },
        data: { status: ZikaBetStatus.LOST, settledAt: new Date() }
      });
    }
  }
}

// ── Calcular odds automáticas ─────────────────────────────────────────────────

export async function calculateAutoOdds(
  matchId: string
): Promise<{ playerAOdds: number; playerBOdds: number; error?: string }> {
  try {
    await requireAdmin();
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        playerA: { select: { id: true } },
        playerB: { select: { id: true } },
        tournamentWeek: { include: { tournament: { select: { id: true } } } }
      }
    });
    if (!match || !match.playerB || !match.playerBId) return { playerAOdds: 1.5, playerBOdds: 1.5 };

    const playerAId = match.playerAId;
    const playerBId = match.playerBId; // now narrowed to string
    const tournamentId = match.tournamentWeek?.tournament?.id;
    const weekFilter = tournamentId ? { tournamentWeek: { tournamentId } } : {};

    // Buscar stats de cada jogador no torneio (vitórias e derrotas)
    const [statsA, statsB] = await Promise.all([
      prisma.match.aggregate({
        where: { OR: [{ playerAId }, { playerBId: playerAId }], status: "CONFIRMED", ...weekFilter },
        _count: { id: true }
      }),
      prisma.match.aggregate({
        where: { OR: [{ playerAId: playerBId }, { playerBId }], status: "CONFIRMED", ...weekFilter },
        _count: { id: true }
      })
    ]);

    const [winsA, winsB] = await Promise.all([
      prisma.match.count({ where: { winnerPlayerId: playerAId, status: "CONFIRMED", ...weekFilter } }),
      prisma.match.count({ where: { winnerPlayerId: playerBId, status: "CONFIRMED", ...weekFilter } })
    ]);

    const totalA = statsA._count.id || 1;
    const totalB = statsB._count.id || 1;
    const wrA = winsA / totalA;
    const wrB = winsB / totalB;

    // Se ambos sem histórico, odds iguais
    const sumWR = wrA + wrB;
    const probA = sumWR > 0 ? wrA / sumWR : 0.5;
    const probB = sumWR > 0 ? wrB / sumWR : 0.5;

    // Aplicar 5% de margem e arredondar para 0.05
    const margin = 0.95;
    const rawA = probA > 0.02 ? margin / probA : 10;
    const rawB = probB > 0.02 ? margin / probB : 10;
    const round = (v: number) => Math.round(v / 0.05) * 0.05;

    return {
      playerAOdds: Math.max(1.05, round(rawA)),
      playerBOdds: Math.max(1.05, round(rawB))
    };
  } catch (err) {
    return { playerAOdds: 1.5, playerBOdds: 1.5, error: err instanceof Error ? err.message : "Erro" };
  }
}

// ── Jogador desfaz aposta (só se semana ainda OPEN) ──────────────────────────

export async function undoBet(betId: string): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };

    const player = await getSessionPlayer(actor.id);
    if (!player) return { error: "Jogador não encontrado." };

    const bet = await prisma.zikaBet.findUnique({
      where: { id: betId },
      include: {
        match: {
          include: { tournamentWeek: { select: { status: true } } }
        }
      }
    });
    if (!bet) return { error: "Aposta não encontrada." };
    if (bet.playerId !== player.id) return { error: "Esta aposta não é sua." };
    if (bet.status !== ZikaBetStatus.OPEN) return { error: "Só é possível desfazer apostas abertas." };

    const weekStatus = bet.match.tournamentWeek?.status;
    if (weekStatus !== "OPEN" && weekStatus !== "PLANNED")
      return { error: "O dia de jogo já foi bloqueado — apostas não podem mais ser desfeitas." };

    await prisma.$transaction(async (tx) => {
      await tx.zikaBet.update({
        where: { id: betId },
        data: { status: ZikaBetStatus.CANCELLED, settledAt: new Date() }
      });
      await creditCoins(tx, {
        playerId: player.id,
        type: ZikaCoinTxType.BET_REFUNDED,
        amount: bet.amount,
        description: "Aposta desfeita pelo jogador",
        matchId: bet.matchId
      });
    });

    revalidatePath("/zikabet");
    revalidatePath("/zikabet/minhas-apostas");
    revalidatePath("/carteira");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Admin cancelar aposta ─────────────────────────────────────────────────────

export async function cancelBet(betId: string): Promise<{ error?: string }> {
  try {
    const actor = await requireAdmin();
    const bet = await prisma.zikaBet.findUnique({ where: { id: betId } });
    if (!bet) return { error: "Aposta não encontrada." };
    if (bet.status !== ZikaBetStatus.OPEN) return { error: "Só é possível cancelar apostas abertas." };

    await prisma.$transaction(async (tx) => {
      await tx.zikaBet.update({
        where: { id: betId },
        data: { status: ZikaBetStatus.CANCELLED, settledAt: new Date() }
      });
      await creditCoins(tx, {
        playerId: bet.playerId,
        type: ZikaCoinTxType.BET_REFUNDED,
        amount: bet.amount,
        description: "Aposta cancelada pelo admin",
        matchId: bet.matchId,
        adminId: actor.id
      });
    });

    revalidatePath("/zikabet");
    revalidatePath("/carteira");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Admin: liquidar apostas de uma semana manualmente ─────────────────────────

export async function adminSettleWeekBets(
  weekId: string
): Promise<{ settled: number; refunded: number; error?: string }> {
  try {
    const admin = await requireAdmin();
    const week = await prisma.tournamentWeek.findUnique({
      where: { id: weekId },
      include: { tournament: true }
    });
    if (!week) return { settled: 0, refunded: 0, error: "Semana não encontrada." };

    // Conta apostas pendentes antes de liquidar
    const pending = await prisma.zikaBet.count({
      where: {
        match: { tournamentWeekId: weekId },
        status: { in: [ZikaBetStatus.OPEN, ZikaBetStatus.CLOSED] }
      }
    });

    await settleDayBets(weekId, admin.id);

    // Conta resultado após liquidação
    const won      = await prisma.zikaBet.count({ where: { match: { tournamentWeekId: weekId }, status: ZikaBetStatus.WON } });
    const refunded = await prisma.zikaBet.count({ where: { match: { tournamentWeekId: weekId }, status: ZikaBetStatus.REFUNDED } });

    revalidatePath("/zikabet");
    revalidatePath(`/torneios/${week.tournament.slug}`);
    revalidatePath("/carteira");

    return { settled: pending, refunded };
  } catch (err) {
    return { settled: 0, refunded: 0, error: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}
