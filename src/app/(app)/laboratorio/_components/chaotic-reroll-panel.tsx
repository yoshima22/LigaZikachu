"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getStaticSpriteUrl, shortMascotCode } from "@/lib/mascot-data";
import { getChaoticRerollStateAction, chaoticStatRerollAction } from "../actions";

type Candidate = { id: string; pokemonId: number; name: string; level: number; total: number } & Stats;
type Stats = { statForce: number; statAgility: number; statCharisma: number; statInstinct: number; statVitality: number };
type Snapshot = { level: number } & Stats;
type Result = { id: string; name: string; pokemonId: number; before: Stats; final: Stats };

const STATS: Array<{ key: keyof Stats; label: string; color: string }> = [
  { key: "statForce", label: "Força", color: "bg-red-400" },
  { key: "statAgility", label: "Agilidade", color: "bg-yellow-400" },
  { key: "statCharisma", label: "Carisma", color: "bg-pink-400" },
  { key: "statInstinct", label: "Instinto", color: "bg-blue-400" },
  { key: "statVitality", label: "Vitalidade", color: "bg-green-400" },
];
const PAGE = 6;
const sum = (s: Stats) => s.statForce + s.statAgility + s.statCharisma + s.statInstinct + s.statVitality;

export function ChaoticRerollPanel() {
  const [state, setState] = useState<{ open: boolean; closesAt: string; candidates: Candidate[] } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState<Snapshot | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [resultsPage, setResultsPage] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const s = await getChaoticRerollStateAction().catch(() => null);
    if (s) setState(s);
  }, []);
  useEffect(() => { load(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [load]);

  const run = (cand: Candidate) => {
    if (running) return;
    setRunning(true); setDisplay(null);
    (async () => {
      const res = await chaoticStatRerollAction(cand.id);
      if (!res.ok) { toast.error(res.error); setRunning(false); return; }
      const prog = res.progression as Snapshot[];
      const before = res.before as Stats;
      const final = res.final as Stats;
      let i = 0;
      const stepMs = Math.max(14, Math.round(2200 / Math.max(1, prog.length)));
      timerRef.current = setInterval(() => {
        setDisplay(prog[i]); i++;
        if (i >= prog.length) {
          if (timerRef.current) clearInterval(timerRef.current);
          setDisplay(prog[prog.length - 1]);
          setRunning(false);
          setResults((prev) => [{ id: cand.id, name: cand.name, pokemonId: cand.pokemonId, before, final }, ...prev.filter((r) => r.id !== cand.id)]);
          setResultsPage(0);
          setSelected(null); setDisplay(null);
          toast.success(`${cand.name}: re-roll concluído!`);
          load();
        }
      }, stepMs);
    })();
  };

  if (!state || !state.open) {
    return <p className="rounded-xl border border-border bg-slate-950/60 p-4 text-sm text-slate-400">O Re-roll Caótico está encerrado (esteve disponível até 26/08/2026).</p>;
  }

  const totalPages = Math.max(1, Math.ceil(state.candidates.length / PAGE));
  const pageItems = state.candidates.slice(page * PAGE, page * PAGE + PAGE);
  const selCand = state.candidates.find((c) => c.id === selected) ?? null;
  // Antes de sortear, o card mostra os status ATUAIS do mascote; durante/depois,
  // mostra o snapshot animado.
  const shown: Snapshot | null = display ?? (selCand
    ? { level: selCand.level, statForce: selCand.statForce, statAgility: selCand.statAgility, statCharisma: selCand.statCharisma, statInstinct: selCand.statInstinct, statVitality: selCand.statVitality }
    : null);
  const maxBar = shown ? Math.max(shown.statForce, shown.statAgility, shown.statCharisma, shown.statInstinct, shown.statVitality, 1) : 1;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-br from-purple-950/40 to-slate-950 p-4">
        <p className="text-sm font-black text-purple-200">🌀 Re-roll Caótico de Status <span className="ml-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-red-300">tempo limitado</span></p>
        <p className="mt-1 text-[11px] text-slate-400">Só mascotes <b>Caóticos</b> e apenas <b>uma vez</b> cada. Redistribui o total de status atual pela regra caótica de subida nível a nível — <b>sem inflar</b>. Disponível até <b>26/08/2026</b>.</p>
      </div>

      {/* Lista + paginação */}
      {state.candidates.length === 0 ? (
        <p className="rounded-xl border border-border bg-slate-950/60 p-4 text-xs text-slate-500">Você não tem mascotes Caóticos elegíveis (livres, sem re-roll).</p>
      ) : (
        <div className="rounded-2xl border border-border bg-slate-950/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-300">Selecione um mascote ({state.candidates.length} elegíveis)</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">←</button>
                <span>{page + 1}/{totalPages}</span>
                <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">→</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pageItems.map((c) => (
              <button key={c.id} onClick={() => setSelected(c.id)} disabled={running}
                className={`flex items-center gap-2 rounded-xl border p-2 text-left transition-colors ${selected === c.id ? "border-purple-400 bg-purple-500/15" : "border-border hover:border-slate-500"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getStaticSpriteUrl(c.pokemonId)} alt="" className="h-9 w-9 shrink-0 object-contain [image-rendering:pixelated]" />
                <span className="min-w-0 text-[11px]">
                  <span className="flex items-center gap-1"><b className="truncate text-white">{c.name}</b><span className="shrink-0 font-mono text-[9px] text-slate-500">#{shortMascotCode(c.id)}</span></span>
                  <span className="text-slate-400">Nv.{c.level} · Σ{c.total}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Área de execução */}
      {selCand && (
        <div className="rounded-2xl border border-purple-500/30 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-200">{selCand.name} <span className="font-mono text-[9px] text-slate-500">#{shortMascotCode(selCand.id)}</span> · {shown ? `Nv.${shown.level}` : `Nv.${selCand.level}`}</p>
            <button onClick={() => run(selCand)} disabled={running}
              className="rounded-lg bg-purple-500 px-4 py-1.5 text-xs font-black text-white hover:bg-purple-400 disabled:opacity-50"
              style={{ textShadow: "0 0 3px rgba(0,0,0,0.9), 0 1px 1px rgba(0,0,0,0.9)" }}>
              {running ? "Sorteando…" : "🎲 Sortear"}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-purple-300">{selCand.total} pontos serão sorteados e redistribuídos (total preservado).</p>
          <div className="mt-2 space-y-1.5">
            {STATS.map((s) => {
              const v = shown ? (shown[s.key] as number) : 0;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[10px] text-slate-400">{s.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-slate-800"><div className={`h-full ${s.color} transition-all duration-75`} style={{ width: `${shown ? Math.round((v / maxBar) * 100) : 0}%` }} /></div>
                  <span className="w-9 shrink-0 text-right text-[11px] font-mono font-bold text-white">{v || "—"}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">{running ? "Simulando o crescimento caótico nível a nível…" : "Clique em Sortear para redistribuir os status."}</p>
        </div>
      )}

      {/* Histórico de sorteios (antes → depois), com paginação */}
      {results.length > 0 && (() => {
        const RES_PAGE = 3;
        const resPages = Math.max(1, Math.ceil(results.length / RES_PAGE));
        const page = Math.min(resultsPage, resPages - 1);
        const shownResults = results.slice(page * RES_PAGE, page * RES_PAGE + RES_PAGE);
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-widest text-purple-200">Histórico de sorteios ({results.length})</p>
              {resPages > 1 && (
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <button disabled={page === 0} onClick={() => setResultsPage(page - 1)} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">←</button>
                  <span>{page + 1}/{resPages}</span>
                  <button disabled={page >= resPages - 1} onClick={() => setResultsPage(page + 1)} className="rounded border border-border px-2 py-0.5 disabled:opacity-30">→</button>
                </div>
              )}
            </div>
            {shownResults.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-slate-950/50 p-3">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getStaticSpriteUrl(r.pokemonId)} alt="" className="h-8 w-8 object-contain [image-rendering:pixelated]" />
                  <p className="text-xs font-bold text-white">{r.name} <span className="font-mono text-[9px] text-slate-500">#{shortMascotCode(r.id)}</span></p>
                  <span className="ml-auto text-[10px] text-slate-500">Σ {sum(r.before)} → {sum(r.final)}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  {STATS.map((s) => {
                    const b = r.before[s.key]; const a = r.final[s.key]; const d = a - b;
                    return (
                      <div key={s.key} className="grid grid-cols-[70px_28px_14px_28px_1fr] items-center text-[11px]">
                        <span className="text-slate-400">{s.label}</span>
                        <span className="text-right font-mono text-slate-500">{b}</span>
                        <span className="text-center text-slate-600">→</span>
                        <span className="text-right font-mono font-bold text-white">{a}</span>
                        <span className={`text-right font-mono text-[10px] ${d > 0 ? "text-green-400" : d < 0 ? "text-red-400" : "text-slate-600"}`}>{d > 0 ? `+${d}` : d}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
