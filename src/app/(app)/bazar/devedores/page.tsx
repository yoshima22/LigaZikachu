import Link from "next/link";
import { ArrowLeft, Handshake } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DebtorRankingPage() {
  const loans = await prisma.bazarLoan.findMany({
    where: { status: "ACTIVE" },
    select: {
      borrowerId: true,
      totalDueCoins: true,
      amountPaidCoins: true,
      borrower: { select: { displayName: true, avatarUrl: true } },
    },
  });
  const grouped = new Map<string, { name: string; avatarUrl: string | null; debt: number; contracts: number }>();
  for (const loan of loans) {
    const current = grouped.get(loan.borrowerId) ?? { name: loan.borrower.displayName, avatarUrl: loan.borrower.avatarUrl, debt: 0, contracts: 0 };
    current.debt += loan.totalDueCoins - loan.amountPaidCoins;
    current.contracts += 1;
    grouped.set(loan.borrowerId, current);
  }
  const ranking = [...grouped.values()].sort((a, b) => b.debt - a.debt || b.contracts - a.contracts);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/bazar" className="rounded-lg border border-border p-2 text-slate-400 hover:text-white"><ArrowLeft size={16} /></Link>
        <div><h1 className="font-pixel text-base text-[#FFCB05]">Ranking Público de Devedores</h1><p className="text-xs text-slate-500">Somente empréstimos ativos, ordenados pelo saldo total devido.</p></div>
      </div>
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100"><Handshake size={14} className="mr-2 inline" />Este ranking é informativo. Empréstimos são acordos de boa-fé e não têm cobrança ou punição automática.</div>
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        {ranking.map((entry, index) => (
          <div key={entry.name} className="grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-3 last:border-0">
            <span className={`text-lg font-black ${index < 3 ? "text-[#FFCB05]" : "text-slate-600"}`}>#{index + 1}</span>
            <div><p className="font-bold text-white">{entry.name}</p><p className="text-[10px] text-slate-500">{entry.contracts} empréstimo(s) ativo(s)</p></div>
            <strong className="text-sm text-orange-300">{entry.debt.toLocaleString("pt-BR")} ZC</strong>
          </div>
        ))}
        {!ranking.length && <p className="p-10 text-center text-sm text-slate-500">Nenhum empréstimo ativo. A Liga está com o nome limpo.</p>}
      </div>
    </div>
  );
}
