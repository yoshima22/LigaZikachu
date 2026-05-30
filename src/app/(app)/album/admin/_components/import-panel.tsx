"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { importPokemonRange } from "../actions";

const GEN_PRESETS = [
  { label: "Gen 1 (1–151)", from: 1, to: 151 },
  { label: "Gen 2 (152–251)", from: 152, to: 251 },
  { label: "Gen 3a (252–386)", from: 252, to: 386 },
  { label: "Gen 4a (387–493)", from: 387, to: 493 },
  { label: "Gen 5a (494–649)", from: 494, to: 649 },
  { label: "Gen 6 (650–721)", from: 650, to: 721 },
  { label: "Gen 7a (722–809)", from: 722, to: 809 },
  { label: "Gen 8 (810–905)", from: 810, to: 905 },
  { label: "Gen 9 (906–1025)", from: 906, to: 1025 }
];

// Gerações maiores precisam de múltiplos lotes
const BATCH_PRESETS: { label: string; batches: { from: number; to: number }[] }[] = [
  { label: "Importar tudo (1–1025)", batches: [
    { from: 1, to: 200 }, { from: 201, to: 400 }, { from: 401, to: 600 },
    { from: 601, to: 800 }, { from: 801, to: 1000 }, { from: 1001, to: 1025 }
  ]}
];

export function ImportPanel() {
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(151);
  const [log, setLog] = useState<string[]>([]);

  const runImport = async (f: number, t: number): Promise<number> => {
    const result = await importPokemonRange({ from: f, to: t });
    if (result.error) throw new Error(result.error);
    return result.imported;
  };

  const handle = (f: number, t: number) => {
    setLog([]);
    startTransition(async () => {
      try {
        const imported = await runImport(f, t);
        const msg = `✓ ${imported} Pokémon importados (${f}–${t})`;
        setLog([msg]);
        toast.success(msg);
      } catch (e) { toast.error((e as Error).message); }
    });
  };

  const handleBatches = (batches: { from: number; to: number }[]) => {
    setLog(["Iniciando importação em lotes…"]);
    startTransition(async () => {
      let total = 0;
      const msgs: string[] = [];
      for (const b of batches) {
        try {
          const n = await runImport(b.from, b.to);
          total += n;
          msgs.push(`✓ ${b.from}–${b.to}: ${n} importados`);
          setLog([...msgs]);
          await new Promise((r) => setTimeout(r, 500));
        } catch (e) {
          msgs.push(`✗ ${b.from}–${b.to}: ${(e as Error).message}`);
          setLog([...msgs]);
        }
      }
      msgs.push(`--- Total: ${total} Pokémon ---`);
      setLog([...msgs]);
      toast.success(`Importação concluída! ${total} Pokémon importados.`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {GEN_PRESETS.map((p) => (
          <button key={p.label} type="button" disabled={pending}
            onClick={() => handle(p.from, p.to)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-300 hover:border-[#FFCB05]/40 hover:text-[#FFCB05] disabled:opacity-50">
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {BATCH_PRESETS.map((bp) => (
          <button key={bp.label} type="button" disabled={pending}
            onClick={() => handleBatches(bp.batches)}
            className="rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50">
            🚀 {bp.label}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-3">
        <label className="space-y-1 text-xs text-slate-400">
          <span>De</span>
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

      {log.length > 0 && (
        <div className="rounded-lg border border-border bg-slate-900/50 p-3 space-y-1 max-h-48 overflow-y-auto">
          {log.map((l, i) => (
            <p key={i} className={`text-xs ${l.startsWith("✓") ? "text-[#7AC74C]" : l.startsWith("✗") ? "text-red-400" : "text-slate-400"}`}>{l}</p>
          ))}
          {pending && <p className="text-xs text-slate-400 animate-pulse">Buscando dados da PokeAPI…</p>}
        </div>
      )}
    </div>
  );
}
