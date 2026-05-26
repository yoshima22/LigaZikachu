"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

interface CodeFiltersProps {
  players: Array<{ id: string; displayName: string }>;
  totalPages: number;
  currentPage: number;
}

const inputClass =
  "w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30";

const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500";

export function CodeFilters({
  players,
  totalPages,
  currentPage,
}: CodeFiltersProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "ALL");
  const [playerId, setPlayerId] = useState(searchParams.get("playerId") ?? "ALL");

  const statusOptions = [
    { value: "ALL", label: "Todos os status" },
    { value: "AVAILABLE", label: "Disponivel" },
    { value: "ASSIGNED", label: "Atribuido" },
    { value: "REDEEMED", label: "Resgatado" },
    { value: "INVALIDATED", label: "Invalidado" },
    { value: "EXPIRED", label: "Expirado" },
  ];

  function buildUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    if (status && status !== "ALL") params.set("status", status);
    else params.delete("status");
    if (playerId && playerId !== "ALL") params.set("playerId", playerId);
    else params.delete("playerId");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="space-y-3">
      <form
        action={buildUrl(1)}
        className="flex flex-wrap gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = buildUrl(1);
        }}
      >
        <div className="flex-1 min-w-[200px]">
          <label className={labelClass}>Buscar codigo</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              name="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Digite parte do codigo..."
              className="pl-9 bg-slate-900/70 border-border text-slate-100 placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="w-[180px]">
          <label className={labelClass}>Status</label>
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="w-[200px]">
          <label className={labelClass}>Jogador</label>
          <select
            name="playerId"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            className={inputClass}
          >
            <option value="ALL">Todos os jogadores</option>
            <option value="NONE">Sem dono</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>

        <Button type="submit" className="mb-0.5">Filtrar</Button>
      </form>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Pagina {currentPage} de {totalPages}</p>
          <div className="flex gap-2">
            <Link href={buildUrl(currentPage - 1)}>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={(e) => {
                  if (currentPage <= 1) e.preventDefault();
                }}
              >
                <ChevronLeft size={14} />
              </Button>
            </Link>
            <Link href={buildUrl(currentPage + 1)}>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={(e) => {
                  if (currentPage >= totalPages) e.preventDefault();
                }}
              >
                <ChevronRight size={14} />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
