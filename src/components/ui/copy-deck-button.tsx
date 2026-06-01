"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  deckList: string;
  className?: string;
}

/** Botão de copiar lista de deck — leve e reutilizável em qualquer contexto */
export function CopyDeckButton({ deckList, className }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!deckList?.trim()) return;
    try {
      await navigator.clipboard.writeText(deckList);
    } catch {
      const el = document.createElement("textarea");
      el.value = deckList;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copiar lista do deck"
      className={`flex items-center gap-1 rounded-md border border-border bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400 hover:border-slate-600 hover:text-slate-200 transition-colors ${className ?? ""}`}
    >
      {copied
        ? <><Check size={10} className="text-emerald-400" /><span className="text-emerald-400">Copiado!</span></>
        : <><Copy size={10} />Copiar</>}
    </button>
  );
}
