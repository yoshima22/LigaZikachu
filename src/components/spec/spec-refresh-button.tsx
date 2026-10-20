"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RealtimeRefresh } from "@/components/realtime-refresh";

// Botão de atualizar a lista da Zika TV (a página é server-rendered). Lives que
// começam/terminam chegam na hora pelo sinal em tempo real; o refresh periódico
// fica só como rede de segurança.
export function SpecRefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const refresh = () => start(() => router.refresh());

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") start(() => router.refresh());
    }, 120_000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <>
      <RealtimeRefresh topic="zikatv" event="live" />
      <button
        onClick={refresh}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"
      >
        <span className={pending ? "animate-spin" : ""}>↻</span> {pending ? "Atualizando…" : "Atualizar"}
      </button>
    </>
  );
}
