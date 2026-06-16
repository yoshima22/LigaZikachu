"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, CheckCircle2, XCircle } from "lucide-react";
import { adminRunFullSimulationAction } from "../simulation-actions";

export function SimulationButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = () => {
    setLog([]);
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await adminRunFullSimulationAction();
      if (result.error) {
        setError(result.error);
      } else {
        setLog(result.log ?? []);
        setDone(true);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div>
          <p className="text-xs text-slate-400">
            Seleciona 8 jogadores ativos com ≥ 3 mascotes, cria 4 duplas, forma a sala e executa as 3 rodadas automaticamente.
            Útil para testar o fluxo completo sem precisar de jogadores reais.
          </p>
        </div>
      </div>

      <button
        disabled={pending}
        onClick={run}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
        {pending ? "Simulando…" : "Rodar simulação completa"}
      </button>

      {(log.length > 0 || error) && (
        <div className={`rounded-xl border p-4 space-y-1 text-xs font-mono ${error ? "border-red-500/30 bg-red-500/5" : "border-green-500/30 bg-green-500/5"}`}>
          {error && (
            <p className="flex items-center gap-2 text-red-400">
              <XCircle size={13} /> {error}
            </p>
          )}
          {log.map((line, i) => (
            <p key={i} className="text-slate-300">{line}</p>
          ))}
          {done && (
            <p className="flex items-center gap-2 text-green-400 font-semibold mt-2">
              <CheckCircle2 size={13} /> Simulação concluída. Role a página para ver a sala em "Evento em andamento".
            </p>
          )}
        </div>
      )}
    </div>
  );
}
