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
  // Garante a carteira sem gravar saldo (create só se não existir).
  const created = await tx.zikaCoinWallet.upsert({
    where: { playerId: input.playerId },
    update: {},
    create: { playerId: input.playerId, balance: 0 }
  });

  const isCredit = input.amount > 0;

  // IMPORTANTE: usar operações ATÔMICas (increment/decrement) em vez de ler o
  // saldo e regravar um valor absoluto. O read-modify-write causava lost update
  // quando dois créditos/reembolsos concorrentes batiam na mesma carteira (ex.:
  // reembolso de leilão sobrescrito por resgate de presente no mesmo instante).
  let walletAfter: { id: string; balance: number };
  if (isCredit) {
    walletAfter = await tx.zikaCoinWallet.update({
      where: { playerId: input.playerId },
      data: { balance: { increment: input.amount }, totalEarned: { increment: input.amount } },
      select: { id: true, balance: true }
    });
  } else {
    const need = -input.amount;
    const res = await tx.zikaCoinWallet.updateMany({
      where: { playerId: input.playerId, balance: { gte: need } },
      data: { balance: { decrement: need }, totalSpent: { increment: need } }
    });
    if (res.count !== 1) throw new Error("Saldo insuficiente de ZikaCoins.");
    walletAfter = { id: created.id, balance: (await tx.zikaCoinWallet.findUnique({ where: { playerId: input.playerId }, select: { balance: true } }))!.balance };
  }
  const newBalance = walletAfter.balance;
  const balanceBefore = newBalance - input.amount;

  await tx.zikaCoinTransaction.create({
    data: {
      walletId: walletAfter.id,
      type: input.type,
      amount: input.amount,
      balanceBefore,
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
    entityId: input.matchId ?? input.tournamentWeekId ?? input.tournamentId ?? walletAfter.id,
    amount: input.amount,
    unit: "ZC",
    before: { balance: balanceBefore },
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
