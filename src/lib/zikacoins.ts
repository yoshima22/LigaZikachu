import { prisma } from "@/lib/prisma";
import { recordPlayerActivity } from "@/lib/player-activity";
import { ZikaCoinTxType, ZikaCoinTxStatus, type Prisma } from "@prisma/client";

export type CoinTxInput = {
  playerId: string;
  type: ZikaCoinTxType;
  amount: number; // positive = earn, negative = spend
  description?: string;
  tournamentId?: string;
  tournamentWeekId?: string;
  matchId?: string;
  adminId?: string;
  status?: ZikaCoinTxStatus;
};

export async function creditCoins(
  tx: Prisma.TransactionClient,
  input: CoinTxInput
): Promise<void> {
  const wallet = await tx.zikaCoinWallet.upsert({
    where: { playerId: input.playerId },
    update: {},
    create: { playerId: input.playerId, balance: 0 }
  });

  const newBalance = wallet.balance + input.amount;
  if (newBalance < 0) throw new Error("Saldo insuficiente de ZikaCoins.");

  const isCredit = input.amount > 0;

  await tx.zikaCoinWallet.update({
    where: { playerId: input.playerId },
    data: {
      balance: newBalance,
      totalEarned: isCredit ? { increment: input.amount } : undefined,
      totalSpent: !isCredit ? { increment: -input.amount } : undefined
    }
  });

  await tx.zikaCoinTransaction.create({
    data: {
      walletId: wallet.id,
      type: input.type,
      amount: input.amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: input.description ?? null,
      tournamentId: input.tournamentId ?? null,
      tournamentWeekId: input.tournamentWeekId ?? null,
      matchId: input.matchId ?? null,
      adminId: input.adminId ?? null,
      status: input.status ?? ZikaCoinTxStatus.COMPLETED
    }
  });

  await recordPlayerActivity(tx, {
    playerId: input.playerId,
    actorUserId: input.adminId,
    category: "ZC",
    action: input.type,
    summary: input.description ?? `${input.amount > 0 ? "Crédito" : "Débito"} de ${Math.abs(input.amount)} ZC`,
    source: input.type,
    entityType: input.matchId ? "match" : input.tournamentWeekId ? "tournamentWeek" : input.tournamentId ? "tournament" : "wallet",
    entityId: input.matchId ?? input.tournamentWeekId ?? input.tournamentId ?? wallet.id,
    amount: input.amount,
    unit: "ZC",
    before: { balance: wallet.balance },
    after: { balance: newBalance },
    metadata: { status: input.status ?? ZikaCoinTxStatus.COMPLETED },
  });
}

export async function getOrCreateWallet(playerId: string) {
  return prisma.zikaCoinWallet.upsert({
    where: { playerId },
    update: {},
    create: { playerId, balance: 0 }
  });
}
