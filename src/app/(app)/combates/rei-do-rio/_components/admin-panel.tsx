"use client";

import { useState, useTransition } from "react";
import { fmtPts } from "@/lib/rei-do-rio/config";
import type { SimMetrics } from "@/lib/rei-do-rio/simulate";
import { DAY_LABELS } from "@/lib/rei-do-rio/schedule";
import type { EditionView } from "@/lib/rei-do-rio/view";
import { adminAddBotsAction, adminCommandAction, adminCreateEditionAction, adminSimulateAction, adminToggleRegistrationAction, type AdminCommand } from "../actions";
import { Card, Pill, Title } from "./rei-ui";

type Run = { week: number; metrics: SimMetrics; top: { name: string; score: number; wins: number }[] };

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export function AdminPanel({ view, onChanged, onCreated }: { view: EditionView | null; onChanged: () => void; onCreated: (id: string) => void }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [name, setName] = useState("Trono de Natal");
  const [bots, setBots] = useState(12);
  const [isTest, setIsTest] = useState(true);
  const [auto, setAuto] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [sim, setSim] = useState<Run[] | null>(null);
  const [simPlayers, setSimPlayers] = useState(12);
  const [simWeeks, setSimWeeks] = useState(2);
  const [gap, setGap] = useState(50);
  const [pressure, setPressure] = useState(true);
  const [hpMult, setHpMult] = useState(3);
  const [maxRounds, setMaxRounds] = useState(6);
  const [winPts, setWinPts] = useState(30);

  const ed = view?.edition;
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string; [k: string]: unknown }>, after?: (r: Awaited<ReturnType<typeof fn>>) => void) =>
    start(async () => { const r = await fn(); setMsg({ ok: r.ok, text: r.message ?? r.error ?? (r.ok ? "Feito." : "Falhou.") }); if (r.ok) { onChanged(); after?.(r); } });
  const cmd = (c: AdminCommand) => run(() => adminCommandAction(ed!.id, c, confirm));

  return (
    <div className="space-y-4">
      {msg && <div role="status" className={`rounded-xl border p-3 text-sm ${msg.ok ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200"}`}>{msg.text}</div>}

      <Card>
        <Title sub="Edições de teste ficam isoladas: bots, sem economia, sem ranking real.">Nova edição</Title>
        <div className="grid gap-2 sm:grid-cols-4">
          <label className="text-xs text-slate-400 sm:col-span-2">Nome<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white" /></label>
          <label className="text-xs text-slate-400">Bots de teste<input type="number" min={0} max={40} value={bots} onChange={(e) => setBots(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white" /></label>
          <div className="flex flex-col justify-end gap-1 text-xs text-slate-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />Edição de teste</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Relógio real (cron)</label>
          </div>
        </div>
        <button disabled={pending} onClick={() => run(() => adminCreateEditionAction({ name, isTest, autoRun: auto, bots, balance: { hpMultiplier: hpMult, maxRounds, winPoints: winPts, pressure } }), (r) => r.editionId && onCreated(r.editionId as string))} className="mt-3 rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-slate-900 disabled:opacity-50">Criar edição</button>
        {!isTest && <p className="mt-2 text-[11px] text-amber-300">Os parâmetros de HP, limite de rodadas e vitória (campos do simulador abaixo) são gravados na edição. Edição real: usa as datas do calendário. Comandos que mexem nela pedem o nome exato para confirmar.</p>}
      </Card>

      {ed && view && (
        <>
          <Card>
            <Title sub={`Fase: ${ed.phase}${ed.restDay ? ` (editando ${DAY_LABELS[ed.restDay]})` : ""} · ${ed.doneRounds}/20 rodadas · segunda ${ed.mondayDate}`}>Controles — {ed.name}</Title>
            {!ed.isTest && <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Digite o nome exato para confirmar comandos" className="mb-2 w-full rounded-lg border border-amber-400/40 bg-slate-900 px-2 py-1.5 text-sm text-white" />}
            <div className="flex flex-wrap gap-2">
              {ed.phase === "PREPARATION" && <>
                <button disabled={pending} onClick={() => run(() => adminToggleRegistrationAction(ed.id, !ed.registrationOpen))} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold text-white">{ed.registrationOpen ? "Fechar inscrições" : "Abrir inscrições"}</button>
                {ed.isTest && <button disabled={pending} onClick={() => run(() => adminAddBotsAction(ed.id, 4))} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold text-white">+4 bots</button>}
                <button disabled={pending} onClick={() => cmd("LOCK")} className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-black text-white">Simular fechamento de segunda (21h)</button>
              </>}
              {ed.phase !== "FINISHED" && <>
                <button disabled={pending} onClick={() => cmd("NEXT_ROUND")} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-black text-white">▶ Próxima rodada</button>
                <button disabled={pending} onClick={() => cmd("RUN_DAY")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-black text-white">⏭ Simular dia completo</button>
                <button disabled={pending} onClick={() => cmd("RUN_ALL")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-black text-white">⏩ Simular semana inteira</button>
                <button disabled={pending} onClick={() => cmd("TICK_REAL")} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold text-white" title="Roda só o que o relógio real já permite">Avançar pelo relógio</button>
              </>}
              <button disabled={pending} onClick={() => cmd("VERIFY")} className="rounded-lg border border-sky-400/50 px-3 py-1.5 text-xs font-bold text-sky-200">Verificar integridade</button>
              <button onClick={() => download(`rei-do-rio-${ed.id}.json`, { edition: ed, standings: view.standings, mascotRanking: view.mascotRanking, rounds: view.rounds, recent: view.recent })} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold text-white">Exportar JSON</button>
              {ed.isTest && <>
                <button disabled={pending} onClick={() => window.confirm("Reiniciar esta edição de teste para a preparação? Resultados serão apagados.") && cmd("RESET")} className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs font-bold text-amber-200">Reiniciar teste</button>
                <button disabled={pending} onClick={() => window.confirm("Apagar esta edição de teste?") && cmd("DELETE")} className="rounded-lg border border-red-400/50 px-3 py-1.5 text-xs font-bold text-red-300">Apagar teste</button>
              </>}
            </div>
            {pending && <p className="mt-2 text-xs text-slate-400" aria-live="polite">Processando… rodadas completas podem levar alguns segundos.</p>}
            {ed.lockDropped.length > 0 && <p className="mt-2 text-xs text-amber-300">Fora no fechamento: {ed.lockDropped.join(" | ")}</p>}
          </Card>

          <Card>
            <Title sub="Status das 20 rodadas (erros ficam registrados aqui).">Rodadas</Title>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {view.rounds.map((r) => (
                <div key={r.roundIndex} title={r.error ?? new Date(r.scheduledAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} className={`rounded-lg p-1.5 text-center text-[10px] font-bold ${r.status === "DONE" ? "bg-emerald-500/20 text-emerald-300" : r.status === "PROCESSING" ? "bg-amber-400/20 text-amber-200" : r.error ? "bg-red-500/20 text-red-300" : "bg-slate-800 text-slate-500"}`}>
                  {r.roundIndex}<br /><span className="font-normal">{["", "Ter", "Qua", "Qui", "Sex"][r.dayIndex]} {[9, 12, 15, 18, 21][r.slotInDay - 1]}h</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <Title sub="Equipes inscritas, inclusive bots.">Participantes ({view.adminParticipants.length})</Title>
            <ul className="grid gap-1 sm:grid-cols-2">{view.adminParticipants.map((p) => <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-2 py-1 text-xs text-white">{p.name}<span className="flex gap-1">{p.isBot && <Pill>bot</Pill>}{p.locked && <Pill tone="green">fechado</Pill>}<span className="font-mono text-amber-200">{fmtPts(p.total)}</span></span></li>)}</ul>
          </Card>
        </>
      )}

      <Card>
        <Title sub="Roda 100% em memória com o motor real de combate. Não grava nada no banco.">Simulador de balanceamento</Title>
        <div className="flex flex-wrap items-end gap-3 text-xs text-slate-400">
          <label>Jogadores<input type="number" min={4} max={40} value={simPlayers} onChange={(e) => setSimPlayers(Number(e.target.value))} className="ml-1 w-16 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-white" /></label>
          <label>Semanas<input type="number" min={1} max={5} value={simWeeks} onChange={(e) => setSimWeeks(Number(e.target.value))} className="ml-1 w-14 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-white" /></label>
          <label>Troca por vida dos bots (%)<input type="number" min={0} max={90} step={10} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="ml-1 w-14 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-white" /></label>
          <label>HP x<input type="number" step="0.5" min={0.5} max={6} value={hpMult} onChange={(e) => setHpMult(Number(e.target.value))} className="ml-1 w-14 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-white" /></label>
          <label>Limite de rodadas<input type="number" min={3} max={150} value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} className="ml-1 w-16 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-white" /></label>
          <label>Pts da vitória<input type="number" min={0} max={100} value={winPts} onChange={(e) => setWinPts(Number(e.target.value))} className="ml-1 w-14 rounded border border-slate-700 bg-slate-900 px-1 py-1 text-white" /></label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={pressure} onChange={(e) => setPressure(e.target.checked)} />Pressão/Corrente</label>
          <button disabled={pending} onClick={() => start(async () => { const r = await adminSimulateAction({ players: simPlayers, weeks: simWeeks, swapPct: gap, pressure, hpMultiplier: hpMult, maxRounds, winPoints: winPts }); if (r.ok) setSim(r.runs as Run[]); else setMsg({ ok: false, text: r.error ?? "Falhou." }); })} className="rounded-lg bg-violet-500 px-3 py-1.5 font-black text-white disabled:opacity-50">Simular</button>
          {sim && <button onClick={() => download("rei-do-rio-simulacao.json", sim)} className="rounded-lg border border-slate-600 px-3 py-1.5 font-bold text-white">Exportar</button>}
        </div>
        {sim?.map((r) => (
          <div key={r.week} className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
            <p className="font-black text-white">Semana {r.week} · campeão {r.metrics.champion} · {r.metrics.ms} ms · {r.metrics.errors.length} erro(s)</p>
            <p className="mt-1">KOs/combate {r.metrics.avgKosPerMatch.toFixed(2)} · slots esgotados/jogador/dia {r.metrics.exhaustedSlotsPerDay.toFixed(1)} · trocas {r.metrics.substitutions} · trocas de liderança {r.metrics.leadershipChanges} · modificadores aplicados {r.metrics.modifierApplications} · spread {r.metrics.spreadStrongWeak.toFixed(0)} pts · correlação posição×vitórias {r.metrics.rankWinCorr.toFixed(2)} · {r.metrics.inversions} inversões · fortes {r.metrics.strongWinPct.toFixed(0)}% × fracos {r.metrics.weakWinPct.toFixed(0)}%</p>
            <p className="mt-1 text-slate-400">Vitórias por composição: {Object.entries(r.metrics.winsByTag).map(([k, v]) => `${k} ${Math.round((100 * v.w) / Math.max(1, v.n))}%`).join(" · ")}</p>
            <p className="mt-1 text-slate-400">Pontos por postura: {Object.entries(r.metrics.pointsByRole).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 100).toFixed(0)}`).join(" · ")}</p>
            {r.metrics.errors.length > 0 && <p className="mt-1 text-red-300">{r.metrics.errors.join(" | ")}</p>}
          </div>
        ))}
      </Card>
    </div>
  );
}
