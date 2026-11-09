"use client";

import { useEffect, useState, useTransition } from "react";
import { fmtPts } from "@/lib/rei-do-rio/config";
import type { DailyReport } from "@/lib/rei-do-rio/report";
import { CATEGORY_LABELS, type PointCategory } from "@/lib/rei-do-rio/scoring";
import { loadReportAction } from "../actions";
import { Card, Empty, Pill, Skeleton, Sprite, Title } from "./rei-ui";

const CAT_COLORS: Record<PointCategory, string> = { damage: "#f97316", ko: "#ef4444", support: "#22c55e", resilience: "#38bdf8", win: "#facc15", leadership: "#a78bfa" };

function Stat({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`text-xl font-black tabular-nums ${tone ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

/** Barras horizontais SVG simples (sem biblioteca) para evolução semanal. */
function MiniBars({ data, color = "#facc15", fmt = (v: number) => String(v) }: { data: { label: string; value: number }[]; color?: string; fmt?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-1.5">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-slate-400">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(d.value / max) * 100}%`, background: color }} /></div>
          <span className="w-14 text-right font-mono tabular-nums text-white">{fmt(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReportView({ editionId, participantId, doneDays, onReplay }: { editionId: string; participantId: string; doneDays: number[]; onReplay: (matchId: string) => void }) {
  const [day, setDay] = useState(doneDays[doneDays.length - 1] ?? 1);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!doneDays.length) return;
    setErr(null);
    start(async () => {
      const r = await loadReportAction(editionId, participantId, day);
      if (r.ok) setReport(r.report); else { setReport(null); setErr(r.error ?? "Falha ao carregar."); }
    });
  }, [editionId, participantId, day, doneDays.length]);

  if (!doneDays.length) return <Empty icon="📜" title="Nenhum relatório ainda">O relatório diário fica pronto depois da rodada das 21h, quando os resultados do dia são consolidados.</Empty>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Dia do relatório">
        {doneDays.map((d) => <button key={d} role="tab" aria-selected={d === day} onClick={() => setDay(d)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${d === day ? "bg-amber-400 text-slate-900" : "bg-slate-800 text-slate-300 hover:text-white"}`}>{["", "Terça", "Quarta", "Quinta", "Sexta"][d]}</button>)}
      </div>
      {pending && !report && <Skeleton rows={5} />}
      {err && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}
      {report && (
        <div className={pending ? "opacity-60 transition" : "transition"}>
          <Card glow>
            <Title sub="Gerado a partir das batalhas reais do dia — sem texto inventado.">Resumo de {report.dayLabel}</Title>
            <ul className="space-y-1 text-sm text-sky-50">{report.text.map((t) => <li key={t}>❄️ {t}</li>)}</ul>
          </Card>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <Stat label="Posição" value={report.summary.rank ? `${report.summary.rank}º` : "–"} sub={report.summary.rankDelta ? `${report.summary.rankDelta > 0 ? "▲" : "▼"} ${Math.abs(report.summary.rankDelta)} no dia` : "sem variação"} tone={report.summary.rankDelta ? (report.summary.rankDelta > 0 ? "text-emerald-300" : "text-red-300") : undefined} />
            <Stat label="Pontos do dia" value={fmtPts(report.summary.dayPoints)} tone="text-amber-200" />
            <Stat label="Pontos totais" value={fmtPts(report.summary.totalPoints)} />
            <Stat label="V · D · E" value={`${report.summary.wins}·${report.summary.losses}·${report.summary.draws}`} sub={report.summary.byes ? `${report.summary.byes} folga(s)` : undefined} />
            <Stat label="KOs" value={report.summary.kos} sub={`${report.summary.defeatedMascots} derrotados seus`} />
            <Stat label="Topo" value={`${report.summary.roundsInTop} rod.`} sub={`seq. ${report.summary.bestStreak}V`} />
            <Stat label="Dano causado" value={Math.round(report.summary.damageDealt)} /><Stat label="Dano recebido" value={Math.round(report.summary.damageTaken)} />
            <Stat label="Cura efetiva" value={Math.round(report.summary.healing)} /><Stat label="Mitigado" value={Math.round(report.summary.mitigated)} />
            <Stat label="Batalhas" value={report.summary.battles} /><Stat label="Slots esgotados" value={report.summary.slotsExhausted} />
          </div>

          <Card className="mt-3">
            <Title sub="Cada barra mostra de onde vieram os pontos do mascote hoje.">Desempenho individual</Title>
            <div className="space-y-2">
              {report.mascots.map((m) => {
                const total = Math.max(1, Object.values(m.sources).reduce((a, b) => a + b, 0));
                return (
                  <div key={m.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-2">
                    <div className="flex items-center gap-2">
                      <Sprite id={m.pokemonId} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{m.name} <span className="text-[11px] font-normal text-slate-400">· {m.roles.join("/")}</span></p>
                        <p className="text-[11px] text-slate-400">{m.battles} lutas · {m.kos} KO · {m.assists} assist. · {Math.round(m.damageDealt)} dano · {Math.round(m.healing)} cura · sobreviveu {m.survivedBattles}/{m.battles}</p>
                      </div>
                      <div className="text-right"><p className="font-mono text-base font-black text-amber-200">{fmtPts(m.dayPoints)}</p><p className="text-[10px] text-slate-500">semana {fmtPts(m.weekPoints)}{m.eventRank ? ` · #${m.eventRank}` : ""}</p></div>
                    </div>
                    <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-800" role="img" aria-label="Origem dos pontos">
                      {(Object.keys(CAT_COLORS) as PointCategory[]).map((k) => (m.sources[k] ? <span key={k} title={`${CATEGORY_LABELS[k]}: ${fmtPts(m.sources[k])}`} style={{ width: `${(m.sources[k] / total) * 100}%`, background: CAT_COLORS[k] }} /> : null))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{(Object.keys(CAT_COLORS) as PointCategory[]).map((k) => <span key={k} className="flex items-center gap-1 text-[10px] text-slate-400"><i className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[k] }} />{CATEGORY_LABELS[k]}</span>)}</div>
          </Card>

          <Card className="mt-3">
            <Title>Linha do tempo</Title>
            <ol className="space-y-2">
              {report.timeline.map((t) => (
                <li key={t.matchId} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{new Date(t.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                    <Pill tone={t.result === "W" ? "green" : t.result === "L" ? "red" : "slate"}>{t.result === "W" ? "Vitória" : t.result === "L" ? "Derrota" : t.result === "D" ? "Empate" : "Folga"}</Pill>
                    <span className="text-sm font-bold text-white">{t.opponent ? `vs ${t.opponent}` : "Sem adversário"}</span>
                    {t.modifierPct !== 0 && <Pill tone={t.modifierPct < 0 ? "red" : "blue"}>{t.modifierPct < 0 ? "👑" : "❄"} {t.modifierPct > 0 ? "+" : ""}{t.modifierPct}%</Pill>}
                    <span className="ml-auto font-mono text-sm font-black text-amber-200">+{fmtPts(t.points)}</span>
                    {t.hasReplay && <button onClick={() => onReplay(t.matchId)} className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-200 hover:bg-sky-500/30">▶ Replay</button>}
                  </div>
                  {t.lineup.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{t.lineup.map((f) => <span key={f.slot} className="flex items-center gap-1 rounded-lg bg-slate-800/70 px-1.5 py-0.5 text-[10px] text-slate-300"><Sprite id={f.pokemonId} size={20} />{f.name}{f.startHpPct < 100 && <b className="text-amber-300">{f.startHpPct}%</b>}</span>)}</div>}
                  {t.defeated.length > 0 && <p className="mt-1.5 text-[11px] text-red-300">Derrotados: {t.defeated.join(", ")}</p>}
                  {t.substitutions.length > 0 && <p className="mt-0.5 text-[11px] text-emerald-300">Para a próxima: {t.substitutions.map((s) => `slot ${s.slot}: ${s.out} → ${s.in} (${s.reason})`).join(" · ")}</p>}
                </li>
              ))}
            </ol>
          </Card>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Card><Title>Pontos por dia</Title><MiniBars data={report.comparison.map((c) => ({ label: c.label, value: c.points }))} fmt={(v) => fmtPts(v)} /></Card>
            <Card><Title>Posição ao fim de cada dia</Title><MiniBars color="#38bdf8" data={report.comparison.map((c) => ({ label: c.label, value: c.rank ? Math.max(1, 21 - c.rank) : 0 }))} fmt={(v) => (v ? `${21 - v}º` : "–")} /><p className="mt-1 text-[10px] text-slate-500">Barra maior = posição melhor.</p></Card>
            <Card className="md:col-span-2"><Title>Comparação semanal</Title>
              <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-xs"><thead><tr className="text-left text-slate-500"><th className="py-1">Dia</th><th>Pontos</th><th>Posição</th><th>V</th><th>D</th><th>KOs</th><th>Sobreviventes</th></tr></thead>
                <tbody>{report.comparison.map((c) => <tr key={c.day} className="border-t border-slate-800 text-slate-200"><td className="py-1.5 font-bold">{c.label}</td><td className="font-mono">{fmtPts(c.points)}</td><td>{c.rank ? `${c.rank}º` : "–"}</td><td className="text-emerald-300">{c.wins}</td><td className="text-red-300">{c.losses}</td><td>{c.kos}</td><td>{c.survived}</td></tr>)}</tbody></table></div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
