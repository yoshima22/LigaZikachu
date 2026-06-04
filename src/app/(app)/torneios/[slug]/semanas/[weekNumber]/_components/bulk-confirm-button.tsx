"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { confirmAllWeekResults } from "../partidas/actions";

interface Props {
  tournamentId: string;
  weekNumber: number;
  slug: string;
}

export function BulkConfirmButton({ tournamentId, weekNumber }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ confirmed: number; skipped: number } | null>(null);

  const handle = () => {
    if (!confirm("Confirmar TODOS os resultados reportados desta semana? ZikaCoins serão distribuídas e o ranking atualizado.")) return;
    startTransition(async () => {
      const r = await confirmAllWeekResults(tournamentId, weekNumber);
      if (r.error) { toast.error(r.error); return; }
      setResult(r);
      toast.success(`${r.confirmed} resultado(s) confirmado(s)!${r.skipped > 0 ? ` (${r.skipped} pulados)` : ""}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={handle}
        className="flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
      >
        <CheckCircle2 size={13} />
        {pending ? "Confirmando…" : "Validar todos"}
      </button>
      {result && (
        <span className="text-[10px] text-slate-500">
          ✓ {result.confirmed} confirmados
        </span>
      )}
    </div>
  );
}
