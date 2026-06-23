"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { undoBet, undoWeeklyLeagueBet } from "../../actions";

export function UndoBetButton({ betId, isLeague = false }: { betId: string; isLeague?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Desfazer esta aposta? Suas ZikaCoins serão devolvidas.")) return;
        startTransition(async () => {
          try {
            const result = isLeague ? await undoWeeklyLeagueBet(betId) : await undoBet(betId);
            if (result.error) { toast.error(result.error); return; }
            toast.success("Aposta desfeita. ZikaCoins reembolsadas!");
          } catch { toast.error("Erro ao desfazer aposta."); }
        });
      }}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
    >
      <RotateCcw size={12} /> Desfazer
    </button>
  );
}
