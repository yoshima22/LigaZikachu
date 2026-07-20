"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { reactivatePlayerAccount } from "../actions";

export function AdminAccountStatusPanel({
  playerId,
  displayName,
}: {
  playerId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 text-emerald-400" size={20} />
          <div>
            <p className="text-sm font-semibold text-slate-100">Conta suspensa</p>
            <p className="text-xs text-slate-400">Restaura o acesso de {displayName} e registra a aÃ§Ã£o no log administrativo.</p>
          </div>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const result = await reactivatePlayerAccount(playerId);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success("Conta reativada com sucesso.");
            router.refresh();
          })}
          className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Reativando..." : "Despausar conta"}
        </button>
      </div>
    </div>
  );
}
