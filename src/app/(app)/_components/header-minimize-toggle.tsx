"use client";

import { useEffect, useState } from "react";
import { ChevronsDown, ChevronsUp } from "lucide-react";
import { HEADER_MIN_STORAGE_KEY } from "@/lib/site-theme";

const EVENT = "liga-zikachu:header-min-change";
const isMinimized = () => document.documentElement.hasAttribute("data-header-min");

// Botão (só PC) que alterna o cabeçalho entre completo e minimizado. O visual fica em globals.css
// (html[data-header-min]); o estado inicial vem do THEME_INIT_SCRIPT e a escolha é lembrada neste navegador.
// Há duas instâncias (topo no modo antigo, ao lado da grade no modo duas linhas); o CSS mostra uma por vez.
export function HeaderMinimizeToggle({ placement }: { placement: "top" | "grid" }) {
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const sync = () => setMinimized(isMinimized());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const toggle = () => {
    const next = !isMinimized();
    if (next) document.documentElement.setAttribute("data-header-min", "1");
    else document.documentElement.removeAttribute("data-header-min");
    try { localStorage.setItem(HEADER_MIN_STORAGE_KEY, next ? "1" : "0"); } catch { /* sem armazenamento: vale só nesta sessão */ }
    window.dispatchEvent(new Event(EVENT));
  };

  const label = minimized ? "Expandir cabeçalho" : "Minimizar cabeçalho";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={minimized}
      aria-label={label}
      title={label}
      className={`hdr-toggle ${placement === "top" ? "hdr-toggle-top" : "hdr-toggle-grid mr-3"} h-9 shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-slate-950/25 px-2.5 text-[10px] font-semibold text-slate-400 transition-colors hover:border-[#FFCB05]/20 hover:bg-[#FFCB05]/10 hover:text-[#FFCB05]`}
    >
      {minimized ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />}
      <span className="hidden xl:inline">{minimized ? "Expandir" : "Minimizar"}</span>
    </button>
  );
}
