"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DistributionStatus } from "@prisma/client";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PlayerCodeFiltersProps {
  totalPages: number;
  currentPage: number;
}

const inputClass =
  "w-full rounded-xl border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30";

const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-widest text-slate-500";

export function PlayerCodeFilters({ totalPages, currentPage }: PlayerCodeFiltersProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "ALL");

  const statusOptions = [
    { value: "ALL", label: "Todos os status" },
    { value: DistributionStatus.ASSIGNED, label: "Nao ativado" },
    { value: DistributionStatus.REDEEMED, label: "Ativado" },
  ];

  function buildUrl(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (search) params.set("search", search);
    else params.delete("search");
    if (status && status !== "ALL") params.set("status", status);
    else params.delete("status");
    if (page > 1) params.set("page", String(page));
    else params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="space-y-3">
      <form
        action={buildUrl(1)}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          window.location.href = buildUrl(1);
        }}
      >
        <div className="min-w-[220px] flex-1">
          <label className={labelClass}>Buscar</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              name="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Codigo ou recompensa..."
              className="border-border bg-slate-900/70 pl-9 text-slate-100 placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="w-[190px]">
          <label className={labelClass}>Status</label>
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={inputClass}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" className="mb-0.5">
          Filtrar
        </Button>
      </form>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Pagina {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Link href={buildUrl(currentPage - 1)}>
              <Button
                size="sm"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={(event) => {
                  if (currentPage <= 1) event.preventDefault();
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
                onClick={(event) => {
                  if (currentPage >= totalPages) event.preventDefault();
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
