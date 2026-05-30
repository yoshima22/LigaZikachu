"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, requireAdmin } from "@/lib/auth/permissions";
import { ZikaBetStatus, ZikaCoinTxType } from "@prisma/client";
import { creditCoins, getOrCreateWallet } from "@/lib/zikacoins";
import { parseBetConfig } from "@/lib/zikabet";

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

export async function placeBet(raw: z.infer<typeof placeBetSchema>): Promise<{ error?: string }> {
  try {
    const actor = await getSessionUser();
    if (!actor) return { error: "Não autenticado." };
    const data = placeBetSchema.parse(raw);

    const player = await prisma.player.findUnique({ where: { userId: actor.id } });
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
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
