"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { adminUndoSimulationAction } from "../simulation-actions";

export function UndoSimulationButton() {
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
      const result = await adminUndoSimulationAction();
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
    <div className="space-y-2">
      <button
        disabled={pending}
        onClick={run}
        className="inline-flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
        {pending ? "Desfazendo…" : "Desfazer simulação de hoje"}
      </button>

      {(log.length > 0 || error) && (
        <div className={`rounded-xl border p-3 space-y-1 text-xs font-mono ${error ? "border-red-500/30 bg-red-500/5" : "border-green-500/30 bg-green-500/5"}`}>
          {error && (
            <p className="flex items-center gap-2 text-red-400">
              <XCircle size={13} /> {error}
            </p>
          )}
          {log.map((line, i) => (
            <p key={i} className="text-slate-300">{line}</p>
          ))}
          {done && (
            <p className="flex items-center gap-2 text-green-400 font-semibold mt-1">
              <CheckCircle2 size={13} /> Pronto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
