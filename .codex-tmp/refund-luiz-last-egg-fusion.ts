import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const PLAYER_ID = "cmpkvjtzl0003jx049kf2w64w";
const ORIGINAL_TRANSACTION_ID = "cms6vqhj40003jr04kpt4cbd0";
const REFUND_DESCRIPTION = `Estorno da fusão de ovos (${ORIGINAL_TRANSACTION_ID})`;

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const original = await tx.zikaCoinTransaction.findUnique({
      where: { id: ORIGINAL_TRANSACTION_ID },
      include: { wallet: true },
    });
    if (!original || original.wallet.playerId !== PLAYER_ID || original.amount !== -250) {
      throw new Error("Transação original da fusão não confere.");
    }

    const priorRefund = await tx.zikaCoinTransaction.findFirst({
      where: { walletId: original.walletId, description: REFUND_DESCRIPTION },
    });
    if (priorRefund) {
      return { alreadyRefunded: true, refundTransactionId: priorRefund.id };
    }

    const balanceBefore = original.wallet.balance;
    const wallet = await tx.zikaCoinWallet.update({
      where: { id: original.walletId },
      data: {
        balance: { increment: 250 },
        totalSpent: { decrement: 250 },
      },
    });
    const refund = await tx.zikaCoinTransaction.create({
      data: {
        walletId: original.walletId,
        type: "ADMIN_ADJUSTMENT",
        amount: 250,
        balanceBefore,
        balanceAfter: wallet.balance,
        description: REFUND_DESCRIPTION,
        status: "COMPLETED",
      },
    });
    const eggs = await Promise.all(
      Array.from({ length: 3 }, () =>
        tx.mascotEgg.create({
          data: {
            playerId: PLAYER_ID,
            type: "COMMON",
            origin: `Estorno da fusão ${ORIGINAL_TRANSACTION_ID}`,
            hatchRarityBonusPct: 0,
          },
          select: { id: true, type: true, origin: true },
        }),
      ),
    );
    const vault = await tx.miauvadaoConfig.update({
      where: { id: "singleton" },
      data: { vaultBalance: { increment: 250 } },
      select: { vaultBalance: true },
    });

    return {
      alreadyRefunded: false,
      refundTransactionId: refund.id,
      balanceBefore,
      balanceAfter: wallet.balance,
      totalSpentAfter: wallet.totalSpent,
      vaultBalanceAfter: vault.vaultBalance,
      eggs,
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => prisma.$disconnect());
