"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

interface PlayerFiltersProps {
  q: string;
  status: string;
}

export function PlayerFilters({ q, status }: PlayerFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      startTransition(() => {
        router.push(`/jogadores?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        placeholder="Buscar por nome ou nick…"
        defaultValue={q}
        onChange={(e) => update("q", e.target.value)}
        className="h-10 w-64 rounded-xl border border-border bg-slate-900 px-4 text-sm text-foreground placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <select
        defaultValue={status}
        onChange={(e) => update("status", e.target.value)}
        className="h-10 rounded-xl border border-border bg-slate-900 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">Todos os status</option>
        <option value="ACTIVE">Ativo</option>
        <option value="PENDING_APPROVAL">Aguardando aprovação</option>
        <option value="SUSPENDED">Suspenso</option>
        <option value="REJECTED">Rejeitado</option>
      </select>
    </div>
  );
}
