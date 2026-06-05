import Link from "next/link";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateWallet } from "@/lib/zikacoins";
import { isAdmin } from "@/lib/auth/permissions";
import { Coins, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AdjustCoinsForm } from "./_components/adjust-coins-form";

const txTypeLabels: Record<string, string> = {
  PARTICIPATION_REWARD: "Participacao em dia",
  MATCH_WIN_REWARD: "Vitoria em partida",
  MATCH_LOSS_REWARD: "Derrota (bonus)",
  TOP_DAY_REWARD: "Top do Dia",
  ACHIEVEMENT_REWARD: "Conquista",
  BADGE_REWARD: "Insignia",
  BET_PLACED: "Aposta realizada",
  BET_WON: "Aposta vencida",
  BET_LOST: "Aposta perdida",
  BET_REFUNDED: "Reembolso de aposta",
  SHOP_PURCHASE: "Compra na ZikaShop",
  STICKER_PACK_PURCHASE: "Pacote de figurinhas",
  DUPLICATE_STICKER_CONVERSION: "Conversao de duplicata",
  ADMIN_ADJUSTMENT: "Ajuste manual (admin)",
};

export default async function CarteiraPage({
  searchParams,
}: {
  searchParams?: Promise<{ playerId?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user) return null;

  const admin = isAdmin(session.user.role);
  const params = await searchParams;

  const currentPlayer = await prisma.player.findUnique({
    where: { userId: session.user.id },
    select: { id: true, displayName: true, ptcglNick: true },
  });
  if (!currentPlayer) return null;

  const players = admin
    ? await prisma.player.findMany({
        select: {
          id: true,
          displayName: true,
          ptcglNick: true,
          wallet: { select: { balance: true, totalEarned: true, totalSpent: true } },
        },
        orderBy: { displayName: "asc" },
      })
    : [];

  const requestedPlayerId = admin && params?.playerId ? params.playerId : currentPlayer.id;
  const selectedPlayer =
    requestedPlayerId === currentPlayer.id
      ? currentPlayer
      : await prisma.player.findUnique({
          where: { id: requestedPlayerId },
          select: { id: true, displayName: true, ptcglNick: true },
        });

  const reportPlayer = selectedPlayer ?? currentPlayer;
  const wallet = await getOrCreateWallet(reportPlayer.id);

  const transactions = await prisma.zikaCoinTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      tournament: { select: { name: true, slug: true } },
      tournamentWeek: { select: { weekNumber: true, label: true } },
      admin: { select: { name: true } },
    },
  });

  const adminPlayers = players.map((p) => ({ id: p.id, displayName: p.displayName }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Liga Zikachu</p>
        <h1 className="font-pixel text-base text-[#FFCB05]">Carteira Zikachu</h1>
        <p className="mt-1 text-sm text-slate-400">
          {admin
            ? "Relatorio de saldo e historico de ZikaCoins por jogador."
            : "Seu saldo de ZikaCoins e historico de transacoes."}
        </p>
      </div>

      {admin && (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Relatorio admin</p>
              <h2 className="mt-1 font-semibold text-slate-200">Carteira de {reportPlayer.displayName}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Selecione um jogador para auditar saldo, ganhos, gastos e movimentacoes recentes.
              </p>
            </div>
            <form action="/carteira" className="flex flex-wrap items-center gap-2">
              <select
                name="playerId"
                defaultValue={reportPlayer.id}
                className="h-10 min-w-64 rounded-xl border border-border bg-slate-950 px-3 text-sm text-slate-200"
              >
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                    {p.ptcglNick ? ` (${p.ptcglNick})` : ""} - {p.wallet?.balance ?? 0} ZC
                  </option>
                ))}
              </select>
              <button className="h-10 rounded-xl bg-[#FFCB05] px-4 text-sm font-bold text-[#1A1A2E]">
                Ver carteira
              </button>
              <Link
                href="/carteira"
                className="h-10 rounded-xl border border-border px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Minha carteira
              </Link>
            </form>
          </div>
        </Card>
      )}

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

      {admin && (
        <Card>
          <p className="mb-3 font-semibold text-slate-200">Ajuste manual de ZikaCoins</p>
          <AdjustCoinsForm players={adminPlayers} />
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-slate-200">
          Historico de Transacoes{admin ? ` - ${reportPlayer.displayName}` : ""}
        </h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma transacao ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-slate-950/50 divide-y divide-border">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">
                    {txTypeLabels[tx.type] ?? tx.type}
                  </p>
                  <p className="text-xs text-slate-500">
                    {tx.description ?? ""}
                    {tx.tournament ? ` - ${tx.tournament.name}` : ""}
                    {tx.tournamentWeek ? ` - Semana ${tx.tournamentWeek.weekNumber}` : ""}
                    {tx.admin ? ` - por ${tx.admin.name}` : ""}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {new Date(tx.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${tx.amount > 0 ? "text-[#7AC74C]" : "text-red-400"}`}>
                    {tx.amount > 0 ? "+" : ""}
                    {tx.amount.toLocaleString("pt-BR")} ZC
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
