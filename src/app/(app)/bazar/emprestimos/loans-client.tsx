"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { payBazarLoan } from "../actions";

type Loan = {
  id: string;
  principalCoins: number;
  interestPct: number;
  totalDueCoins: number;
  amountPaidCoins: number;
  status: string;
  itemSnapshot: Record<string, unknown>;
  createdAt: string;
  paidAt: string | null;
  counterparty: string;
  payments: Array<{ id: string; amountCoins: number; remainingCoins: number; createdAt: string }>;
};

function itemName(snapshot: Record<string, unknown>) {
  const base = String(snapshot.nickname ?? snapshot.pokemonName ?? snapshot.displayName ?? "Item do Bazar");
  return snapshot.level ? `${base} Nv.${snapshot.level}` : base;
}

function LoanCard({ loan, debt, onPaid }: { loan: Loan; debt: boolean; onPaid: () => void }) {
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const remaining = loan.totalDueCoins - loan.amountPaidCoins;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">{itemName(loan.itemSnapshot)}</p>
          <p className="mt-1 text-xs text-slate-400">{debt ? "Credor" : "Devedor"}: <strong className="text-slate-200">{loan.counterparty}</strong></p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${loan.status === "ACTIVE" ? "bg-orange-500/10 text-orange-300" : "bg-green-500/10 text-green-300"}`}>{loan.status === "ACTIVE" ? "ATIVO" : "PAGO"}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Principal", loan.principalCoins], ["Juros", `${loan.interestPct}%`], ["Total", loan.totalDueCoins], ["Restante", remaining]].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-slate-900 p-2"><p className="text-[9px] uppercase text-slate-600">{label}</p><p className="text-sm font-black text-[#FFCB05]">{typeof value === "number" ? `${value.toLocaleString("pt-BR")} ZC` : value}</p></div>
        ))}
      </div>
      {debt && loan.status === "ACTIVE" && (
        <div className="mt-3 flex gap-2">
          <input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} placeholder={`Parcela (máx. ${remaining})`} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none" />
          <button disabled={pending || !amount} onClick={() => startTransition(async () => {
            const result = await payBazarLoan(loan.id, Number(amount));
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(`Parcela de ${result.paid?.toLocaleString("pt-BR")} ZC paga.`);
            setAmount("");
            onPaid();
          })} className="rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40">{pending ? "Pagando…" : "Pagar parcela"}</button>
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-[10px] font-bold text-cyan-300">Histórico de pagamentos ({loan.payments.length})</summary>
        <div className="mt-2 space-y-1">
          {loan.payments.map((payment) => <p key={payment.id} className="rounded bg-slate-900 px-2 py-1.5 text-[10px] text-slate-400">{new Date(payment.createdAt).toLocaleString("pt-BR")} · <strong className="text-green-300">{payment.amountCoins.toLocaleString("pt-BR")} ZC</strong> · restavam {payment.remainingCoins.toLocaleString("pt-BR")} ZC</p>)}
          {!loan.payments.length && <p className="text-[10px] text-slate-600">Nenhuma parcela paga.</p>}
        </div>
      </details>
    </article>
  );
}

export function LoansClient({ receivables, debts, balance }: { receivables: Loan[]; debts: Loan[]; balance: number }) {
  const [tab, setTab] = useState<"RECEIVE" | "OWE">("RECEIVE");
  const reload = () => window.location.reload();
  const list = tab === "RECEIVE" ? receivables : debts;
  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setTab("RECEIVE")} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === "RECEIVE" ? "bg-cyan-500/15 text-cyan-200" : "bg-slate-900 text-slate-500"}`}>Valores a receber ({receivables.filter((l) => l.status === "ACTIVE").length})</button>
        <button onClick={() => setTab("OWE")} className={`rounded-xl px-4 py-2 text-xs font-bold ${tab === "OWE" ? "bg-orange-500/15 text-orange-200" : "bg-slate-900 text-slate-500"}`}>Minhas dívidas ({debts.filter((l) => l.status === "ACTIVE").length})</button>
      </div>
      {tab === "OWE" && <p className="text-xs text-slate-500">Saldo disponível para parcelas: <strong className="text-[#FFCB05]">{balance.toLocaleString("pt-BR")} ZC</strong></p>}
      <div className="space-y-3">{list.map((loan) => <LoanCard key={loan.id} loan={loan} debt={tab === "OWE"} onPaid={reload} />)}{!list.length && <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">Nenhum empréstimo nesta categoria.</div>}</div>
    </>
  );
}
