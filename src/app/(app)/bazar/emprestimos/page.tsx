import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HandCoins, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { LoansClient } from "./loans-client";

export const dynamic = "force-dynamic";

export default async function BazarLoansPage() {
  const session = await getAppSession();
  if (!session?.user) return notFound();
  const player = await getSessionPlayer(session.user.id);
  if (!player) return notFound();

  const [receivables, debts, wallet] = await Promise.all([
    prisma.bazarLoan.findMany({
      where: { lenderId: player.id },
      include: { borrower: { select: { displayName: true } }, payments: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bazarLoan.findMany({
      where: { borrowerId: player.id },
      include: { lender: { select: { displayName: true } }, payments: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id }, select: { balance: true } }),
  ]);

  const serialize = (loan: (typeof receivables)[number] | (typeof debts)[number]) => ({
    id: loan.id,
    principalCoins: loan.principalCoins,
    interestPct: loan.interestPct,
    totalDueCoins: loan.totalDueCoins,
    amountPaidCoins: loan.amountPaidCoins,
    status: loan.status,
    itemSnapshot: loan.itemSnapshot as Record<string, unknown>,
    createdAt: loan.createdAt.toISOString(),
    paidAt: loan.paidAt?.toISOString() ?? null,
    counterparty: "borrower" in loan ? loan.borrower.displayName : loan.lender.displayName,
    payments: loan.payments.map((payment) => ({
      id: payment.id,
      amountCoins: payment.amountCoins,
      remainingCoins: payment.remainingCoins,
      createdAt: payment.createdAt.toISOString(),
    })),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/bazar/meu-bazar" className="rounded-lg border border-border p-2 text-slate-400 hover:text-white"><ArrowLeft size={16} /></Link>
          <div>
            <h1 className="font-pixel text-base text-[#FFCB05]">Meus Empréstimos</h1>
            <p className="text-xs text-slate-500">Valores a receber, suas dívidas e histórico de parcelas.</p>
          </div>
        </div>
        <Link href="/bazar/devedores" className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-200"><Trophy size={14} /> Ranking de devedores</Link>
      </div>
      <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3 text-xs leading-relaxed text-orange-100">
        <strong>Contratos de boa-fé:</strong> o sistema registra valores e permite parcelas voluntárias. Não há cobrança automática, retirada forçada de itens ou punição automática por atraso.
      </div>
      <LoansClient receivables={receivables.map(serialize)} debts={debts.map(serialize)} balance={wallet?.balance ?? 0} />
    </div>
  );
}
