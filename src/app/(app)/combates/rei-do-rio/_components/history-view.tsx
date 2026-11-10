"use client";

import { useEffect, useState, useTransition } from "react";
import { fmtPts } from "@/lib/rei-do-rio/config";
import { DAY_LABELS } from "@/lib/rei-do-rio/schedule";
import type { EditionView, MatchRow } from "@/lib/rei-do-rio/view";
import { loadDayMatchesAction } from "../actions";
import { Avatar, Empty, Pill, Skeleton } from "./rei-ui";

type Page = { total: number; page: number; pageCount: number; items: MatchRow[] };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Histórico de combates: um dia por vez, filtro por rodada, "só os meus" e paginação (10 por página). */
export function HistoryView({ editionId, rounds, hasMe, meId, avatars, onReplay }: { editionId: string; rounds: EditionView["rounds"]; hasMe: boolean; meId?: string; avatars: EditionView["avatars"]; onReplay: (id: string) => void }) {
  const days = [1, 2, 3, 4].filter((d) => rounds.some((r) => r.dayIndex === d && r.status === "DONE"));
  const [day, setDay] = useState(days[days.length - 1] ?? 1);
  const [round, setRound] = useState<number | null>(null);
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const doneRounds = rounds.filter((r) => r.dayIndex === day && r.status === "DONE");
  const timeOf = new Map(rounds.map((r) => [r.roundIndex, hhmm(r.scheduledAt)]));

  useEffect(() => { setPage(1); setRound(null); }, [day]);
  useEffect(() => { setPage(1); }, [round, mine]);
  useEffect(() => {
    if (!days.length) return;
    setErr(null);
    start(async () => {
      const r = await loadDayMatchesAction(editionId, day, { round, mine, page });
      if (r.ok) setData({ total: r.total, page: r.page, pageCount: r.pageCount, items: r.items }); else setErr(r.error ?? "Falha ao carregar.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editionId, day, round, mine, page, days.length]);

  if (!days.length) return <Empty orn="lantern" title="Sem batalhas ainda">As primeiras batalhas aparecem depois da rodada de terça às 09h.</Empty>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Dia">
        {days.map((d) => <button key={d} role="tab" aria-selected={d === day} onClick={() => setDay(d)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${d === day ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300 hover:text-white"}`}>{DAY_LABELS[d]}</button>)}
        {hasMe && <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-300"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Só os meus</label>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Rodada">
        <button onClick={() => setRound(null)} className={`rounded-full border px-3 py-1 text-[11px] font-bold ${round === null ? "border-sky-300 bg-sky-500/15 text-sky-200" : "border-slate-700 text-slate-400 hover:text-white"}`}>Todas as rodadas</button>
        {doneRounds.map((r) => <button key={r.roundIndex} onClick={() => setRound(r.roundIndex)} className={`rounded-full border px-3 py-1 text-[11px] font-bold ${round === r.roundIndex ? "border-sky-300 bg-sky-500/15 text-sky-200" : "border-slate-700 text-slate-400 hover:text-white"}`}>{timeOf.get(r.roundIndex)}</button>)}
      </div>

      {err && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
      {pending && !data ? <Skeleton rows={5} /> : data && (
        <div className={pending ? "opacity-60 transition" : "transition"}>
          {data.items.length === 0 ? <Empty orn="snowflake" title="Nenhum combate neste filtro" /> : (
            <ul className="space-y-1.5">
              {data.items.map((m) => {
                const me = m.a === meId || m.b === meId;
                return (
                  <li key={m.id} className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm ${me ? "border-amber-300/40 bg-amber-300/5" : "border-slate-800 bg-slate-900/50"}`}>
                    <span className="w-11 font-mono text-[11px] text-slate-500">{timeOf.get(m.roundIndex)}</span>
                    {m.bye ? <><Avatar src={avatars[m.a]} name={m.aName} size={22} /><span className="text-slate-300">{m.aName}</span><Pill>folga</Pill></> : <>
                      <Avatar src={avatars[m.a]} name={m.aName} size={24} />
                      <span className={m.winner === "A" ? "font-black text-emerald-300" : "text-slate-300"}>{m.aName}</span>
                      <span className="font-mono text-xs text-slate-500">{fmtPts(m.scoreA)} × {fmtPts(m.scoreB)}</span>
                      <span className={m.winner === "B" ? "font-black text-emerald-300" : "text-slate-300"}>{m.bName}</span>
                      <Avatar src={m.b ? avatars[m.b] : null} name={m.bName ?? "?"} size={24} />
                      {m.winner === "DRAW" && <Pill>empate</Pill>}
                      {m.exhausted && <Pill tone="red" title="Uma das equipes não tinha mascotes em pé: resultado sem luta">{m.exhausted === "BOTH" ? "ambas sem mascotes" : `${m.exhausted === "A" ? m.aName : m.bName} sem mascotes`}</Pill>}
                      {!m.exhausted && <button onClick={() => onReplay(m.id)} className="ml-auto rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-200 hover:bg-sky-500/30">▶ Replay</button>}
                    </>}
                  </li>
                );
              })}
            </ul>
          )}
          <nav className="mt-3 flex items-center justify-between gap-2" aria-label="Paginação">
            <button disabled={data.page <= 1 || pending} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-40">← Anterior</button>
            <span className="text-xs text-slate-400">Página <b className="text-white">{data.page}</b> de {data.pageCount} · {data.total} combate{data.total === 1 ? "" : "s"}</span>
            <button disabled={data.page >= data.pageCount || pending} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 disabled:opacity-40">Próxima →</button>
          </nav>
        </div>
      )}
    </div>
  );
}
