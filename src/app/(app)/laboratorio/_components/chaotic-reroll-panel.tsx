"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getStaticSpriteUrl } from "@/lib/mascot-data";
import { getChaoticRerollStateAction, chaoticStatRerollAction } from "../actions";

type Candidate = { id: string; pokemonId: number; name: string; level: number; total: number };
type Snapshot = { level: number; statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number };

const STATS: Array<{ key: keyof Snapshot; label: string; color: string }> = [
  { key: "statForce", label: "Força", color: "bg-red-400" },
  { key: "statAgility", label: "Agilidade", color: "bg-yellow-400" },
  { key: "statCharisma", label: "Carisma", color: "bg-pink-400" },
  { key: "statInstinct", label: "Instinto", color: "bg-blue-400" },
  { key: "statVitality", label: "Vitalidade", color: "bg-green-400" },
];

export function ChaoticRerollPanel() {
  const [state, setState] = useState<{ open: boolean; closesAt: string; candidates: Candidate[] } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState<Snapshot | null>(null);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const s = await getChaoticRerollStateAction().catch(() => null);
    if (s) setState(s);
  }, []);
  useEffect(() => { load(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [load]);

  const run = async () => {
    if (!selected || running) return;
    setRunning(true); setDone(false); setDisplay(null);
    const res = await chaoticStatRerollAction(selected);
    if (!res.ok) { toast.error(res.error); setRunning(false); return; }
    const prog = res.progression as Snapshot[];
    // Animação nível-a-nível aceleradinha.
    let i = 0;
    const stepMs = Math.max(14, Math.round(2200 / Math.max(1, prog.length)));
    timerRef.current = setInterval(() => {
      setDisplay(prog[i]);
      i++;
      if (i >= prog.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setDisplay(prog[prog.length - 1]);
        setDone(true);
        setRunning(false);
        toast.success("Re-roll caótico concluído!");
        load(); // recarrega candidatos (esse já saiu da lista)
      }
    }, stepMs);
  };

  if (!state || !state.open) return null;

  const cand = state.candidates.find((c) => c.id === selected) ?? null;
  const maxBar = display ? Math.max(display.statForce, display.statAgility, display.statCharisma, display.statInstinct, display.statVitality, 1) : 1;

  return (
    <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-950/40 to-slate-950 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-purple-200">🌀 Re-roll Caótico de Status <span className="ml-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-red-300">tempo limitado</span></p>
          <p className="mt-0.5 text-[11px] text-slate-400">Só mascotes <b>Caóticos</b> e apenas <b>uma vez</b> cada. Redistribui o total de status atual pela regra caótica de subida nível a nível — sem inflar. Disponível até <b>26/08/2026</b>.</p>
        </div>
      </div>

      {state.candidates.length === 0 ? (
        <p className="text-xs text-slate-500">Você não tem mascotes Caóticos elegíveis (livres e ainda sem re-roll).</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {state.candidates.map((c) => (
              <button key={c.id} onClick={() => { setSelected(c.id); setDone(false); setDisplay(null); }} disabled={running}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${selected === c.id ? "border-purple-400 bg-purple-500/15" : "border-border hover:border-slate-500"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getStaticSpriteUrl(c.pokemonId)} alt="" className="h-8 w-8 object-contain [image-rendering:pixelated]" />
                <span className="text-[11px]"><span className="block font-bold text-white">{c.name}</span><span className="text-slate-400">Nv.{c.level} · Σ{c.total}</span></span>
              </button>
            ))}
          </div>

          {cand && (
            <div className="rounded-xl border border-border bg-slate-950/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-200">{cand.name} · {display ? `Nv.${display.level}` : `Nv.${cand.level}`}</p>
                <button onClick={run} disabled={running} className="rounded-lg bg-purple-500 px-3 py-1.5 text-[11px] font-black text-white hover:bg-purple-400 disabled:opacity-50">
                  {running ? "Re-rolando…" : done ? "Concluído ✓" : "🌀 Re-rolar"}
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                {STATS.map((s) => {
                  const v = display ? (display[s.key] as number) : 0;
                  return (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 text-[10px] text-slate-400">{s.label}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded bg-slate-800">
                        <div className={`h-full ${s.color} transition-all duration-75`} style={{ width: `${display ? Math.round((v / maxBar) * 100) : 0}%` }} />
                      </div>
                      <span className="w-9 shrink-0 text-right text-[11px] font-mono font-bold text-white">{v || "—"}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{running ? "Simulando o crescimento caótico nível a nível…" : done ? "Novos status aplicados (total preservado)." : "Clique em Re-rolar para redistribuir os status."}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
