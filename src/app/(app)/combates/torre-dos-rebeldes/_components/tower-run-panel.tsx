"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getTowerRunStateAction,
  startTowerExpeditionAction,
  submitTowerActionAction,
  abandonTowerRunAction,
} from "../actions";

type State = Extract<Awaited<ReturnType<typeof getTowerRunStateAction>>, { ok: true }>;

const card = "rounded-2xl border border-slate-800 bg-slate-950/70 p-5";

function Countdown({ deadline }: { deadline: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return null;
  const ms = Math.max(0, new Date(deadline).getTime() - now);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const label = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return <span className={`font-mono text-sm font-bold tabular-nums ${ms === 0 ? "text-red-300" : "text-[#FFCB05]"}`}>{ms === 0 ? "resolvendo…" : label}</span>;
}

export function TowerRunPanel({ runId, onLeft }: { runId: string; onLeft: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await getTowerRunStateAction(runId);
      if ("error" in res) setError(res.error ?? "Erro ao carregar a expedição.");
      else setState(res);
    } finally {
      inFlight.current = false;
    }
  }, [runId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  if (error) return <section className={card}><p className="text-sm text-red-300">{error}</p></section>;
  if (!state) return <section className={card}><p className="text-sm text-slate-500">Carregando expedição…</p></section>;

  const run = state.run;
  const ended = run.status === "FINISHED" || run.status === "ABANDONED";

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">
          {run.status === "LOBBY" ? "Lobby" : ended ? "Encerrada" : "Expedição · Turno " + run.globalTurn}
        </h2>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Andar {run.currentFloor}</span>
          <span>Ritmo {run.pace === "ONLINE" ? "Online" : "Lento"}</span>
          {run.status === "ACTIVE" && <Countdown deadline={run.nextDeadline} />}
        </div>
      </div>

      {run.status === "LOBBY" && (
        <div className="mt-4">
          <p className="text-sm text-slate-300">Pronto para entrar. Ao iniciar, abre a primeira janela de turno.</p>
          <button type="button" disabled={pending} onClick={() => start(async () => {
            const res = await startTowerExpeditionAction(runId);
            if ("error" in res) { toast.error(res.error); return; }
            toast.success("Expedição iniciada!"); void refresh();
          })} className="mt-3 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-black text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40">
            🗼 Iniciar Expedição
          </button>
        </div>
      )}

      {run.status === "ACTIVE" && (
        <div className="mt-4 space-y-4">
          {/* Ordem de resolução / confirmações */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ordem de resolução</p>
            <div className="mt-2 space-y-1.5">
              {state.order.map((userId, i) => {
                const m = state.members.find((x) => x.userId === userId);
                const isMe = userId === state.mine.userId;
                return (
                  <div key={userId} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-xs">
                    <span className="w-5 font-bold text-slate-500">{i + 1}.</span>
                    <span className={`font-semibold ${isMe ? "text-[#FFCB05]" : "text-slate-200"}`}>{isMe ? "Você" : "Jogador"} · {m?.expeditionRole ?? "?"}</span>
                    <span className="ml-auto">
                      {m?.afkRemoved
                        ? <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-300">AFK removido</span>
                        : m?.confirmed
                          ? <span className="rounded bg-green-500/15 px-2 py-0.5 text-[10px] font-black text-green-300">✓ Confirmado</span>
                          : <span className="rounded bg-slate-500/15 px-2 py-0.5 text-[10px] font-black text-slate-400">planejando…{m && m.consecutiveMisses > 0 ? ` (${m.consecutiveMisses}/2)` : ""}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ação do turno (placeholder até o gameplay da Fase 6) */}
          <button type="button" disabled={pending || state.mine.confirmed} onClick={() => start(async () => {
            const res = await submitTowerActionAction(runId, null);
            if ("error" in res) { toast.error(res.error); return; }
            toast.success(res.resolved ? "Todos confirmaram — turno resolvido." : "Ação confirmada.");
            void refresh();
          })} className="w-full rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-2.5 text-sm font-black text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40">
            {state.mine.confirmed ? "Ação confirmada — aguardando os demais / deadline" : "Confirmar ação do turno (placeholder)"}
          </button>

          {/* Log recente */}
          {state.log.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-[10px] text-slate-400">
              {state.log.slice().reverse().map((line, i) => <p key={i}>· {line}</p>)}
            </div>
          )}
        </div>
      )}

      {ended && <p className="mt-3 text-sm text-slate-400">Esta expedição foi {run.status === "FINISHED" ? "concluída" : "abandonada"}.</p>}

      <button type="button" disabled={pending} onClick={() => start(async () => {
        const res = await abandonTowerRunAction(runId);
        if ("error" in res) { toast.error(res.error); return; }
        toast.success("Expedição encerrada."); onLeft();
      })} className="mt-4 rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40">
        {ended ? "Voltar ao lobby" : "Encerrar expedição"}
      </button>
    </section>
  );
}
