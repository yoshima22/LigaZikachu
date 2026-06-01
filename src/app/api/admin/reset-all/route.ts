/**
 * POST /api/admin/reset-all?target=album|wallets|inventory
 * Reseta dados de TODOS os jogadores. Apenas SUPER_ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const INITIAL_BALANCE = 200;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = new URL(req.url).searchParams.get("target");

  try {
    if (target === "album") {
      const { count } = await prisma.playerSticker.deleteMany({});
      return NextResponse.json({ success: true, message: `✓ ${count} figurinhas removidas de todos os álbuns.` });
    }

    if (target === "inventory") {
      // Remove itens do tipo BANNER, FRAME e ZIKALOOT_TICKET do inventário
      const { count } = await prisma.playerInventory.deleteMany({
        where: { item: { type: { in: ["BANNER", "FRAME", "ZIKALOOT_TICKET"] } } }
      });
      return NextResponse.json({ success: true, message: `✓ ${count} itens removidos dos inventários (banners, molduras, tickets).` });
    }

    if (target === "wallets") {
      // Reseta saldo de todas as carteiras para o inicial (200 ZC)
      // e apaga o histórico de transações
      const wallets = await prisma.zikaCoinWallet.findMany({ select: { id: true, playerId: true } });

      await prisma.$transaction([
        prisma.zikaCoinTransaction.deleteMany({}),
        prisma.zikaCoinWallet.updateMany({
          data: {
            balance: INITIAL_BALANCE,
            totalEarned: INITIAL_BALANCE,
            totalSpent: 0
          }
        })
      ]);

      // Recria transação de saldo inicial para cada carteira
      await prisma.zikaCoinTransaction.createMany({
        data: wallets.map(w => ({
          walletId: w.id,
          type: "ADMIN_ADJUSTMENT" as const,
          amount: INITIAL_BALANCE,
          balanceBefore: 0,
          balanceAfter: INITIAL_BALANCE,
          description: "Reset de carteira — saldo inicial restaurado"
        }))
      });

      return NextResponse.json({ success: true, message: `✓ ${wallets.length} carteiras resetadas para ${INITIAL_BALANCE} ZC. Histórico apagado.` });
    }

    return NextResponse.json({ error: "target inválido. Use: album, wallets ou inventory." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
