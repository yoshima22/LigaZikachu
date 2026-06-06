"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ManualRefreshButton({ label = "Atualizar multiplayer" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-2 text-xs font-bold text-[#FFCB05] shadow-[0_0_18px_rgba(255,203,5,0.12)] transition hover:bg-[#FFCB05]/20 disabled:opacity-50"
      title="Busca o estado mais recente sem depender de espera automatica."
    >
      <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
      {pending ? "Atualizando..." : label}
    </button>
  );
}
