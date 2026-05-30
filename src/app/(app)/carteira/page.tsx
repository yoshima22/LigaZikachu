import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { isAdmin } from "@/lib/auth/permissions";
import { Coins, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AdjustCoinsForm } from "./_components/adjust-coins-form";

const txTypeLabels: Record<string, string> = {
  PARTICIPATION_REWARD:       "Participação em dia",
  MATCH_WIN_REWARD:           "Vitória em partida",
  MATCH_LOSS_REWARD:          "Derrota (bônus)",
  TOP_DAY_REWARD:             "Top do Dia",
  ACHIEVEMENT_REWARD:         "Conquista",
  BADGE_REWARD:               "Insígnia",
  BET_PLACED:                 "Aposta realizada",
  BET_WON:                    "Aposta vencida",
  BET_LOST:                   "Aposta perdida",
  BET_REFUNDED:               "Reembolso de aposta",
  SHOP_PURCHASE:              "Compra na ZikaShop",
  STICKER_PACK_PURCHASE:      "Pacote de figurinhas",
  DUPLICATE_STICKER_CONVERSION: "Conversão de duplicata",
  ADMIN_ADJUSTMENT:           "Ajuste manual (admin)"
};

export default async function CarteiraPage() {
  const session = await auth();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);

  const player = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true }
  });
  if (!player) return null;

  const wallet = await getOrCreateWallet(player.id);

  const transactions = await prisma.zikaCoinTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      tournament: { select: { name: true, slug: true } },
      tournamentWeek: { select: { weekNumber: true, label: true } },
      admin: { select: { name: true } }
    }
  });

  const players = admin
    ? await prisma.player.findMany({
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" }
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
        <h1 className="font-pixel text-base text-[#FFCB05]">Carteira Zikachu</h1>
        <p className="mt-1 text-sm text-slate-400">Seu saldo de ZikaCoins e histórico de transações.</p>
      </div>

      {/* Saldo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="col-span-1 rounded-2xl border border-[#FFCB05]/30 bg-gradient-to-br from-[#1A1A2E] to-[#201d38] p-6 sm:col-span-1">
          <p className="text-xs uppercase tracking-widest text-slate-500">Saldo atual</p>
          <p className="mt-2 flex items-center gap-2 font-pixel text-3xl text-[#FFCB05]">
            <Coins size={28} />
            {wallet.balance.toLocaleString("pt-BR")}
          </p>
          <p className="mt-1 text-xs text-slate-500">ZikaCoins</p>
        </div>
        <Card className="flex flex-col justify-between">
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <TrendingUp size={14} className="text-[#7AC74C]" /> Total ganho
          </p>
          <p className="mt-1 text-xl font-bold text-[#7AC74C]">
            +{wallet.totalEarned.toLocaleString("pt-BR")}
          </p>
        </Card>
        <Card className="flex flex-col justify-between">
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <TrendingDown size={14} className="text-red-400" /> Total gasto
          </p>
          <p className="mt-1 text-xl font-bold text-red-400">
            -{wallet.totalSpent.toLocaleString("pt-BR")}
          </p>
        </Card>
      </div>

      {/* Admin: ajuste manual */}
      {admin && (
        <Card>
          <p className="mb-3 font-semibold text-slate-200">Ajuste manual de ZikaCoins</p>
          <AdjustCoinsForm players={players} />
        </Card>
      )}

      {/* Histórico */}
      <div className="space-y-3">
        <h2 className="font-semibold text-slate-200">Histórico de Transações</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma transação ainda.</p>
        ) : (
          <div className="rounded-xl border border-border bg-slate-950/50 divide-y divide-border overflow-hidden">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">
                    {txTypeLabels[tx.type] ?? tx.type}
                  </p>
                  <p className="text-xs text-slate-500">
                    {tx.description ?? ""}
                    {tx.tournament ? ` · ${tx.tournament.name}` : ""}
                    {tx.tournamentWeek ? ` · Semana ${tx.tournamentWeek.weekNumber}` : ""}
                    {tx.admin ? ` · por ${tx.admin.name}` : ""}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {new Date(tx.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.amount > 0 ? "text-[#7AC74C]" : "text-red-400"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString("pt-BR")} ZC
                  </p>
                  <p className="text-[10px] text-slate-600">
                    saldo: {tx.balanceAfter.toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
