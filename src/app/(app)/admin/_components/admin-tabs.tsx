"use client";

import { useEffect, useState, type ReactNode } from "react";

export type AdminTab = { id: string; label: string; content: ReactNode };

/**
 * Abas do painel admin. Todas as abas ficam montadas (só ocultas por CSS) para
 * os painéis não perderem o que foi digitado ao trocar de aba.
 */
export function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (tabs.some((t) => t.id === fromHash)) setActive(fromHash);
  }, [tabs]);

  function select(id: string) {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="space-y-6">
      <div role="tablist" className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto border-b border-border bg-slate-950/90 px-1 py-2 backdrop-blur">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => select(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              active === t.id ? "bg-[#FFCB05] text-[#1A1A2E]" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id} className="space-y-8">
          {t.content}
        </div>
      ))}
    </div>
  );
}
