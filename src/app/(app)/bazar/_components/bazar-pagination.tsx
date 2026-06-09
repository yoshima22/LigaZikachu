"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

export function BazarPagination({ page, totalPages, total, pageSize }: Props) {
  const router      = useRouter();
  const pathname    = usePathname();
  const params      = useSearchParams();

  function goTo(p: number) {
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete("page"); else next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
    // Scroll suave ao topo dos anúncios
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Gera até 7 botões de página com ellipsis
  function pageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "…", totalPages];
    if (page >= totalPages - 3) return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "…", page - 1, page, page + 1, "…", totalPages];
  }

  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      {/* Contador */}
      <p className="text-xs text-slate-500">
        Mostrando <span className="text-slate-300 font-medium">{from}–{to}</span> de{" "}
        <span className="text-slate-300 font-medium">{total}</span> anúncios
      </p>

      {/* Controles */}
      <div className="flex items-center gap-1">
        {/* Anterior */}
        <button
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Números de página */}
        {pageNumbers().map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-slate-600 select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => goTo(p as number)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                p === page
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/15 text-[#FFCB05]"
                  : "border-border text-slate-400 hover:border-slate-500 hover:text-slate-200"
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Próxima */}
        <button
          onClick={() => goTo(page + 1)}
          disabled={page >= totalPages}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Próxima página"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
