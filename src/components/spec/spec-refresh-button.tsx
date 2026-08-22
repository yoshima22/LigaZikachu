"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

// Botão de atualizar a lista da Zika TV (a página é server-rendered). Também
// atualiza sozinho em ritmo econômico enquanto a aba está visível.
export function SpecRefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const refresh = () => start(() => router.refresh());

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") start(() => router.refresh());
    }, 45_000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <button
      onClick={refresh}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"
    >
      <span className={pending ? "animate-spin" : ""}>↻</span> {pending ? "Atualizando…" : "Atualizar"}
    </button>
  );
}
