"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";

export function BazarFiltersClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [open, setOpen] = useState(false);

  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value); else p.delete(key);
    router.push(`${pathname}?${p.toString()}`);
  }, [router, pathname, params]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            defaultValue={params.get("q") ?? ""}
            onChange={e => update("q", e.target.value)}
            placeholder="Buscar no Bazar…"
            className="w-full rounded-xl border border-border bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60 placeholder:text-slate-600"
          />
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors ${open ? "border-[#FFCB05]/40 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-400 hover:text-slate-200"}`}
        >
          <SlidersHorizontal size={12}/> Filtros
        </button>
      </div>

      {open && (
        <div className="grid gap-3 sm:grid-cols-4 rounded-xl border border-border bg-slate-900/60 p-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Categoria</label>
            <select
              value={params.get("cat") ?? ""}
              onChange={e => update("cat", e.target.value)}
              className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="">Todas</option>
              <option value="MASCOT">Mascotes</option>
              <option value="ITEM">Itens</option>
              <option value="COSMETIC">Cosméticos</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Tipo</label>
            <select
              value={params.get("type") ?? ""}
              onChange={e => update("type", e.target.value)}
              className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="">Todos</option>
              <option value="SALE">Venda</option>
              <option value="TRADE">Troca</option>
              <option value="SALE_OR_TRADE">Venda ou Troca</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Ordenar</label>
            <select
              value={params.get("sort") ?? "newest"}
              onChange={e => update("sort", e.target.value)}
              className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="newest">Mais recentes</option>
              <option value="cheapest">Mais baratos</option>
              <option value="expensive">Mais caros</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wide">Preço máx.</label>
            <input
              type="number"
              min={0}
              defaultValue={params.get("maxPrice") ?? ""}
              onChange={e => update("maxPrice", e.target.value)}
              placeholder="Sem limite"
              className="w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
          </div>
        </div>
      )}
    </div>
  );
}
