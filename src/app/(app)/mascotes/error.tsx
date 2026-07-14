"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, User } from "lucide-react";

export default function MascotesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    console.error("[MascotesErrorBoundary]", error);
  }, [error]);

  useEffect(() => {
    if (retryCount >= 2) return;
    const timeout = window.setTimeout(() => {
      setRetryCount((count) => count + 1);
      reset();
    }, 1800 + retryCount * 1200);
    return () => window.clearTimeout(timeout);
  }, [reset, retryCount]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-red-500/30 bg-red-950/15 p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/30 bg-red-500/10 text-red-200">
        <AlertTriangle size={24} />
      </div>
      <div className="space-y-2">
        <p className="font-pixel text-base text-[#FFCB05]">Mascotes deram uma oscilada</p>
        <p className="text-sm leading-relaxed text-slate-300">
          A pagina de mascotes encontrou uma falha temporaria ao montar seus dados. Seus mascotes,
          ovos e recompensas continuam salvos.
        </p>
        {retryCount < 2 && (
          <p className="text-[11px] text-slate-500">
            Tentando recuperar automaticamente...
          </p>
        )}
        {error.digest && (
          <p className="text-[11px] text-slate-500">Digest: {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]"
        >
          <RotateCcw size={14} />
          Tentar novamente
        </button>
        <Link
          href="/perfil"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-slate-950/60 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <User size={14} />
          Ir para o perfil
        </Link>
      </div>
    </div>
  );
}
