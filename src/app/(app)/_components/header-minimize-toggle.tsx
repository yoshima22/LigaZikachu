"use client";

import { useLayoutEffect, useState } from "react";
import { ChevronsDown, ChevronsUp } from "lucide-react";

const STORAGE_KEY = "liga-zikachu:header-min";

// Botão (só PC) que alterna o cabeçalho entre completo e minimizado. O visual fica em globals.css
// (html[data-header-min]); a escolha é lembrada neste navegador.
export function HeaderMinimizeToggle() {
  const [minimized, setMinimized] = useState(false);

  useLayoutEffect(() => {
    let saved = false;
    try { saved = localStorage.getItem(STORAGE_KEY) === "1"; } catch { /* sem armazenamento: começa completo */ }
    setMinimized(saved);
    if (saved) document.documentElement.setAttribute("data-header-min", "1");
    return () => document.documentElement.removeAttribute("data-header-min");
  }, []);

  const toggle = () => {
    const next = !minimized;
    setMinimized(next);
    if (next) document.documentElement.setAttribute("data-header-min", "1");
    else document.documentElement.removeAttribute("data-header-min");
    try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignora */ }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={minimized}
      aria-label={minimized ? "Expandir cabeçalho" : "Minimizar cabeçalho"}
      title={minimized ? "Expandir cabeçalho" : "Minimizar cabeçalho"}
      className="hdr-toggle mr-3 hidden h-9 shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-slate-950/25 px-2.5 text-[10px] font-semibold text-slate-400 transition-colors hover:border-[#FFCB05]/20 hover:bg-[#FFCB05]/10 hover:text-[#FFCB05] lg:flex"
    >
      {minimized ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />}
      <span>{minimized ? "Expandir" : "Minimizar"}</span>
    </button>
  );
}
