"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importPokemonRange } from "../actions";

const GEN_PRESETS = [
  { label: "Gen 1", from: 1, to: 151 },
  { label: "Gen 2", from: 152, to: 251 },
  { label: "Gen 3 (1ª metade)", from: 252, to: 301 },
  { label: "Gen 3 (2ª metade)", from: 302, to: 386 },
  { label: "Gen 4", from: 387, to: 493 },
  { label: "Gen 5 (1ª metade)", from: 494, to: 570 },
  { label: "Gen 5 (2ª metade)", from: 571, to: 649 }
];

export function ImportPanel() {
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(50);
  const [log, setLog] = useState<string | null>(null);

  const handle = (f: number, t: number) => {
    setLog(null);
    startTransition(async () => {
      try {
        const result = await importPokemonRange({ from: f, to: t });
        if (result.error) { toast.error(result.error); return; }
        const msg = `${result.imported} Pokémon importados (${f}–${t}).`;
        setLog(msg);
        toast.success(msg);
      } catch { toast.error("Erro ao importar."); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {GEN_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={pending}
            onClick={() => handle(p.from, p.to)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-300 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-3">
        <label className="space-y-1 text-xs text-slate-400">
          <span>De (National ID)</span>
          <input type="number" min={1} max={1025} value={from} onChange={(e) => setFrom(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
        </label>
        <label className="space-y-1 text-xs text-slate-400">
          <span>Até</span>
          <input type="number" min={1} max={1025} value={to} onChange={(e) => setTo(Number(e.target.value))}
            className="w-24 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
        </label>
        <Button type="button" disabled={pending} onClick={() => handle(from, to)}
          className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
          {pending ? "Importando…" : "Importar"}
        </Button>
      </div>

      {log && <p className="text-xs text-[#7AC74C]">✓ {log}</p>}
      {pending && <p className="text-xs text-slate-400 animate-pulse">Buscando dados da PokeAPI… isso pode levar alguns segundos.</p>}
    </div>
  );
}
