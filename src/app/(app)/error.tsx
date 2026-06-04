"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw, UserRound } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300">
        <AlertTriangle size={28} />
      </div>
      <div>
        <h1 className="font-pixel text-base text-[#FFCB05]">Ops, algo travou nesta tela</h1>
        <p className="mt-2 text-sm text-slate-400">
          Seus dados continuam salvos. Tente recarregar a tela ou vá para uma área segura do app.
        </p>
        {error.digest && (
          <p className="mt-2 text-[11px] text-slate-600">Digest: {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700]"
        >
          <RefreshCcw size={14} />
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          <Home size={14} />
          Dashboard
        </Link>
        <Link
          href="/perfil"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
        >
          <UserRound size={14} />
          Perfil
        </Link>
      </div>
    </div>
  );
}
