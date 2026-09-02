"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ENGUICA_BOX_REWARD_LABEL, ENGUICA_CONTRACTS } from "@/lib/tcg-enguica-contracts";
import { revealEnguicaContract } from "../actions";

type Props = {
  tournamentId: string;
  weekNumber: number;
  isAdmin: boolean;
  deckRegistrationOpen: boolean;
  contract: { key: string; title: string; description: string; revealedAt: string | null } | null;
};

export function EnguicaContractPanel({ tournamentId, weekNumber, isAdmin, deckRegistrationOpen, contract }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function reveal() {
    startTransition(async () => {
      try {
        await revealEnguicaContract(tournamentId, weekNumber);
        toast.success("O Professor Enguiça revelou o contrato da semana!");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível revelar o contrato.");
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-violet-500/10">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="max-w-3xl space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Desafio geral compartilhado</p>
          {contract ? (
            <>
              <h2 className="text-xl font-black text-white">📋 {contract.title}</h2>
              <p className="text-sm leading-6 text-slate-300">{contract.description}</p>
              <p className="text-xs text-cyan-200">Caixa Enguiça: {ENGUICA_BOX_REWARD_LABEL}</p>
              <p className="text-[11px] text-slate-500">Marque a conclusão em uma partida oficial. A caixa só é enviada no encerramento, depois da confirmação do resultado.</p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-white">Contrato ainda oculto</h2>
              <p className="text-sm text-slate-400">O objetivo é sorteado automaticamente junto com a liberação do envio de decks.</p>
            </>
          )}
        </div>
        {isAdmin && !contract && (
          <div className="space-y-2 text-right">
            <Button onClick={reveal} disabled={pending || !deckRegistrationOpen} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
              {pending ? "Sorteando..." : "Recuperar sorteio do contrato"}
            </Button>
            {!deckRegistrationOpen && <p className="max-w-52 text-[10px] text-amber-300">Disponível enquanto o envio de decks estiver aberto.</p>}
          </div>
        )}
      </div>
      <details className="border-t border-cyan-400/15 px-5 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-cyan-200">Ver pool de {ENGUICA_CONTRACTS.length} contratos possíveis</summary>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {ENGUICA_CONTRACTS.map((item) => (
            <div key={item.key} className={`rounded-lg border p-3 ${item.key === contract?.key ? "border-cyan-300/60 bg-cyan-500/10" : "border-slate-800 bg-slate-950/50"}`}>
              <p className="text-xs font-bold text-slate-200">{item.title}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.description}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
