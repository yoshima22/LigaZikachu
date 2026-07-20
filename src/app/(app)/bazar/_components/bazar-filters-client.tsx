"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

export function BazarFiltersClient() {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();
  const [open, setOpen]         = useState(false);
  const [searchValue, setSearch] = useState(params.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Atualiza param na URL, sempre reiniciando para página 1
  const update = useCallback((key: string, value: string) => {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value); else p.delete(key);
    p.delete("page"); // Volta para página 1 ao mudar filtro
    router.push(`${pathname}?${p.toString()}`);
  }, [router, pathname, params]);

  // Busca com debounce de 450ms
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (value.trim()) p.set("q", value.trim()); else p.delete("q");
      p.delete("page");
      router.push(`${pathname}?${p.toString()}`);
    }, 450);
  }, [router, pathname, params]);

  // Limpa debounce ao desmontar
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Sincroniza o input se o usuário navegar back/forward
  useEffect(() => { setSearch(params.get("q") ?? ""); }, [params]);

  const clearSearch = () => handleSearch("");

  const hasFilters = params.get("cat") || params.get("type") || params.get("maxPrice") || params.get("sort");

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {/* Barra de busca */}
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={searchValue}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Escape") clearSearch();
            }}
            placeholder="Buscar mascote, item, descrição…"
            className="w-full rounded-xl border border-border bg-slate-900 pl-8 pr-8 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]/60 placeholder:text-slate-600 transition-colors"
          />
          {searchValue && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Botão de filtros */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition-colors ${
            open || hasFilters
              ? "border-[#FFCB05]/40 bg-[#FFCB05]/10 text-[#FFCB05]"
              : "border-border text-slate-400 hover:text-slate-200"
          }`}
        >
          <SlidersHorizontal size={12}/>
          Filtros
          {hasFilters && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#FFCB05] text-[9px] font-bold text-[#1A1A2E]">
              {[params.get("cat"), params.get("type"), params.get("maxPrice"), params.get("sort")].filter(Boolean).length}
            </span>
          )}
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
              <option value="AUCTION">LeilÃ£o</option>
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

          {/* Limpar todos os filtros */}
          {hasFilters && (
            <div className="sm:col-span-4 flex justify-end">
              <button
                onClick={() => {
                  const p = new URLSearchParams();
                  if (searchValue.trim()) p.set("q", searchValue.trim());
                  router.push(`${pathname}?${p.toString()}`);
                }}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
