"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getTowerRunStateAction,
  startTowerExpeditionAction,
  submitTowerActionAction,
  abandonTowerRunAction,
} from "../actions";
import { getCombatRoleLabel } from "@/lib/combat-roles";
import { TowerBattleGrid } from "./tower-battle-grid";

type State = Extract<Awaited<ReturnType<typeof getTowerRunStateAction>>, { ok: true }>;
type Intent = "ADVANCE" | "ATTACK" | "DEFEND" | "WAIT";
const INTENTS: { value: Intent; label: string }[] = [
  { value: "ADVANCE", label: "Avançar" },
  { value: "ATTACK", label: "Atacar" },
  { value: "DEFEND", label: "Defender" },
  { value: "WAIT", label: "Esperar" },
];

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
  const [intents, setIntents] = useState<Record<string, Intent>>({});
  const [interacting, setInteracting] = useState<string[]>([]);
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

          {/* Supressão do andar */}
          {state.battle && state.battle.suppression.total > 0 && (
            <p className="text-[11px] text-slate-400">
              Mecanismos de supressão neutralizados: <strong className="text-[#FFCB05]">{state.battle.suppression.resolved}/{state.battle.suppression.total}</strong>
              <span className="text-slate-500"> · cada um ativo reforça os inimigos.</span>
            </p>
          )}

          {/* Sala + fog */}
          {state.battle && <TowerBattleGrid battle={state.battle} />}

          {/* Mecanismos ao alcance */}
          {!state.battle?.over && state.battle && state.battle.objects.some((o) => !o.resolved) && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Mecanismos à vista</p>
              {state.battle.objects.filter((o) => !o.resolved).map((o) => {
                const on = interacting.includes(o.id);
                return (
                  <label key={o.id} className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${o.interactable ? "border-amber-500/30 bg-amber-500/5" : "border-slate-800 bg-slate-900/40 opacity-70"}`}>
                    <input type="checkbox" disabled={!o.interactable || state.mine.confirmed} checked={on}
                      onChange={(e) => setInteracting((cur) => e.target.checked ? [...cur, o.id] : cur.filter((x) => x !== o.id))} />
                    <span className="min-w-0 flex-1">
                      <strong className="text-white">{o.name}</strong>
                      <span className="text-slate-500"> · {o.progress}/{o.required}{o.suppression ? " · supressão" : ""}</span>
                    </span>
                    {!o.interactable && <span className="text-[10px] text-slate-500">aproxime um mascote</span>}
                  </label>
                );
              })}
            </div>
          )}
          {state.battle?.over && (
            <p className={`rounded-lg border px-3 py-2 text-xs font-bold ${state.battle.outcome === "WIN" ? "border-green-500/30 bg-green-500/5 text-green-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
              {state.battle.outcome === "WIN" ? "🏆 Encounter vencido!" : "☠️ Seus mascotes caíram no encounter."}
            </p>
          )}

          {/* Ordens dos seus mascotes (aplicadas na resolução do turno) */}
          {!state.battle?.over && state.myMascots.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ordens dos seus mascotes</p>
              {state.myMascots.map((m) => (
                <div key={m.id} className={`flex items-center gap-2 rounded-lg border p-2 ${m.hp <= 0 ? "border-slate-800 bg-slate-900/30 opacity-50" : "border-slate-800 bg-slate-900/50"}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{m.name}</p>
                    <p className="text-[10px] text-cyan-300">{getCombatRoleLabel(m.role)} · {m.hp}/{m.maxHp} HP</p>
                  </div>
                  {m.hp <= 0 ? (
                    <span className="text-[10px] font-bold text-red-400">caído</span>
                  ) : (
                    <select value={intents[m.id] ?? "ADVANCE"} onChange={(e) => setIntents((cur) => ({ ...cur, [m.id]: e.target.value as Intent }))}
                      disabled={state.mine.confirmed}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-yellow-300 disabled:opacity-50">
                      {INTENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Confirmar ações do turno */}
          {!state.battle?.over && (
            <button type="button" disabled={pending || state.mine.confirmed} onClick={() => start(async () => {
              const payload = { intents: Object.fromEntries(state.myMascots.map((m) => [m.id, intents[m.id] ?? "ADVANCE"])), interactions: interacting };
              const res = await submitTowerActionAction(runId, payload);
              if ("error" in res) { toast.error(res.error); return; }
              toast.success(res.resolved ? "Todos confirmaram — turno resolvido." : "Ordens confirmadas.");
              void refresh();
            })} className="w-full rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-2.5 text-sm font-black text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40">
              {state.mine.confirmed ? "Ordens confirmadas — aguardando os demais / deadline" : "Confirmar ordens do turno"}
            </button>
          )}

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
