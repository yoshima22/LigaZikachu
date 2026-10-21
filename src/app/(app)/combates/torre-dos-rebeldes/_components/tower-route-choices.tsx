"use client";

import React from "react";
import type { TowerRouteIntel } from "@/lib/tower/route-intel";

type Route = {
  id: string;
  title: string;
  visited: boolean;
  available: boolean;
  blockedReason: string | null;
  intel: TowerRouteIntel;
};

export function TowerRouteChoices({ routes, selectedId, disabled, onRoute }: {
  routes: readonly (Route | null)[];
  selectedId?: string;
  disabled: boolean;
  onRoute: (id: string) => void;
}) {
  const choices = routes.filter((route): route is Route => Boolean(route));
  if (!choices.length) return null;
  return <section aria-label="Escolha de passagem" className="rounded-2xl border border-cyan-300/25 bg-[#071120] p-3 sm:p-5">
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Próxima decisão</p>
        <h3 className="mt-1 text-lg font-black text-white">Qual passagem seguir?</h3>
      </div>
      <p className="max-w-sm text-xs text-slate-400">Os sinais mostram oportunidades e riscos, mas a sala só se revela ao entrar. Marque sua rota e confirme a ação abaixo.</p>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {choices.map((route) => {
        const selected = selectedId === route.id;
        const blocked = !route.available;
        return <button
          type="button"
          key={route.id}
          disabled={disabled || blocked}
          aria-label={`${route.visited ? "Voltar para" : "Seguir"} ${route.title}: ${route.intel.signal}`}
          aria-pressed={selected}
          onClick={() => onRoute(route.id)}
          className={`min-w-0 rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 ${selected ? "border-cyan-200 bg-cyan-300/15" : blocked ? "border-red-400/30 bg-red-950/15 opacity-75" : "border-purple-300/35 bg-purple-950/20 hover:border-cyan-300/65 hover:bg-cyan-300/10"}`}
        >
          <span className={`text-[10px] font-black uppercase tracking-wider ${blocked ? "text-red-200" : selected ? "text-cyan-200" : "text-purple-200"}`}>{blocked ? "Passagem bloqueada" : selected ? "✓ Rota marcada" : route.visited ? "↩ Voltar" : "→ Explorar"}</span>
          <span className="mt-1 block break-words text-base font-black text-white">{route.visited ? route.title : route.intel.signal}</span>
          {route.visited && <span className="mt-0.5 block text-xs text-slate-400">{route.intel.signal}</span>}
          <span className="mt-3 block border-t border-white/10 pt-2 text-xs text-emerald-200"><strong className="text-emerald-300">Oportunidade · </strong>{route.intel.opportunity}</span>
          <span className="mt-1.5 block text-xs text-amber-100"><strong className="text-amber-300">Risco · </strong>{route.intel.risk}</span>
          {route.blockedReason && <span className="mt-2 block rounded-lg bg-red-400/10 p-2 text-xs font-bold text-red-200">{route.blockedReason}</span>}
        </button>;
      })}
    </div>
  </section>;
}
