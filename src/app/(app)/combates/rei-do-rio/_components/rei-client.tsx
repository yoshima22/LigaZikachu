"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { LeagueBattleReplayModal } from "@/app/(app)/combates/liga-semanal/_components/league-battle-replay";
import { DAY_LABELS } from "@/lib/rei-do-rio/schedule";
import type { Formation } from "@/lib/rei-do-rio/team";
import type { EditionSummary, EditionView } from "@/lib/rei-do-rio/view";
import { clearRestPlanAction, loadEditionAction, loadReplayAction, registerAction, saveRestPlanAction, withdrawAction } from "../actions";
import { AdminPanel } from "./admin-panel";
import { ReportView } from "./report-view";
import { TeamBuilder } from "./team-builder";
import { Avatar, Card, Countdown, Empty, Hero, Ornament, Pill, Skeleton, Title } from "./rei-ui";
import { FormationBoard } from "./views";
import { EditionNotice, HighlightsCard, Podium, TodayCard } from "./home-panels";
import { HistoryView } from "./history-view";
import { ReiIntro } from "./rei-intro";
import { Manual } from "./manual";
import { MascotRanking, ScoringExplainer, StandingsTable, TeamsGrid } from "./stats-views";

type Tab = "evento" | "equipe" | "ranking" | "mascotes" | "equipes" | "batalhas" | "relatorio" | "manual" | "admin";
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "evento", label: "Evento", icon: "🏰" }, { key: "equipe", label: "Minha equipe", icon: "🛡️" }, { key: "ranking", label: "Ranking", icon: "🏆" },
  { key: "mascotes", label: "Mascotes", icon: "🐾" }, { key: "equipes", label: "Equipes", icon: "👥" }, { key: "batalhas", label: "Batalhas", icon: "⚔️" },
  { key: "relatorio", label: "Relatório", icon: "📜" }, { key: "manual", label: "Manual", icon: "📖" }, { key: "admin", label: "Admin", icon: "🔧" },
];

type ReplayData = Extract<Awaited<ReturnType<typeof loadReplayAction>>, { ok: true }>["replay"];

export function ReiClient({ editions: initialEditions, banner = null }: { editions: EditionSummary[]; banner?: string | null }) {
  const [editions, setEditions] = useState(initialEditions);
  const [editionId, setEditionId] = useState<string | null>(initialEditions.find((e) => e.phase !== "FINISHED")?.id ?? initialEditions[0]?.id ?? null);
  const [view, setView] = useState<EditionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!initialEditions.length);
  const [tab, setTab] = useState<Tab>(initialEditions.length ? "evento" : "admin");
  const [replay, setReplay] = useState<ReplayData | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, start] = useTransition();
  const [builderKey, setBuilderKey] = useState(0);
  const [introKey, setIntroKey] = useState(0);
  const [restInit, setRestInit] = useState<Formation | null>(null);

  const refresh = useCallback(async (id = editionId) => {
    if (!id) { setView(null); setLoading(false); return; }
    setLoading(true);
    const r = await loadEditionAction(id);
    if (r.ok) { setView(r.view); setError(null); } else { setError(r.error ?? "Falha ao carregar."); }
    setLoading(false);
  }, [editionId]);

  useEffect(() => { void refresh(); }, [refresh]);
  const flash = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 5000); };

  const ed = view?.edition;
  const me = view?.me ?? null;
  const doneDays = useMemo(() => {
    if (!view) return [] as number[];
    const days = new Set<number>();
    for (const d of [1, 2, 3, 4]) if (view.rounds.filter((r) => r.dayIndex === d).every((r) => r.status === "DONE")) days.add(d);
    return [...days];
  }, [view]);

  async function openReplay(matchId: string) {
    const r = await loadReplayAction(matchId);
    if (r.ok) setReplay(r.replay); else flash(false, r.error ?? "Replay indisponível.");
  }

  const nextEvent = useMemo(() => {
    if (!ed) return null;
    if (ed.phase === "PREPARATION") return { to: ed.lockAt, label: "Inscrições fecham (seg 21h)" };
    if (ed.phase === "REST" && ed.freezeAt) return { to: ed.freezeAt, label: `Formação de ${DAY_LABELS[ed.restDay ?? 1]} congela (08h)` };
    if (ed.nextRoundAt && ed.phase !== "FINISHED") return { to: ed.nextRoundAt, label: "Próxima rodada" };
    return null;
  }, [ed]);

  const saveRegistration = (f: Formation) => start(async () => {
    const r = await registerAction(ed!.id, f);
    flash(r.ok, r.ok ? "Inscrição confirmada! Sua formação original foi registrada." : r.error ?? "Não foi possível salvar.");
    if (r.ok) void refresh();
  });
  const saveRest = (f: Formation) => start(async () => {
    const r = await saveRestPlanAction(ed!.id, f);
    flash(r.ok, r.ok ? `Formação de ${DAY_LABELS[ed!.restDay ?? 1]} salva. Vale a partir das 09h.` : r.error ?? "Não foi possível salvar.");
    if (r.ok) void refresh();
  });

  return (
    <div className="space-y-4">
      <Hero
        name={ed?.name ?? "Trono de Natal"} banner={banner} phase={ed?.phase ?? "PREPARATION"} restDay={ed?.restDay ?? null} isTest={!!ed?.isTest}
        right={nextEvent && <Countdown to={nextEvent.to} label={nextEvent.label} className="min-w-[210px]" />}
      />

      {editions.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-slate-400">Edição
          <select value={editionId ?? ""} onChange={(e) => setEditionId(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white">
            {editions.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.isTest ? "teste" : "real"} · {e.phase}</option>)}
          </select>
        </label>
      )}

      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Seções do Rei do Rio">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${tab === t.key ? "bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/20" : "bg-slate-800/80 text-slate-300 hover:text-white"}`}>
            <span aria-hidden>{t.icon}</span> {t.label}
          </button>
        ))}
        <button onClick={() => setIntroKey((k) => k + 1)} className="ml-auto shrink-0 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300/20">📘 Como funciona</button>
        <button onClick={() => void refresh()} className="shrink-0 rounded-full border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white" aria-label="Atualizar dados">↻</button>
      </nav>

      {toast && <div role="status" className={`rounded-xl border p-3 text-sm ${toast.ok ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-red-400/30 bg-red-500/10 text-red-200"}`}>{toast.text}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{error} <button className="underline" onClick={() => void refresh()}>Tentar de novo</button></div>}

      {tab === "admin" ? (
        <AdminPanel view={view} onChanged={() => { void refresh(); }} onCreated={(id) => { setEditions((p) => [{ id, name: "Nova edição", isTest: true, phase: "PREPARATION", mondayDate: "", participants: 0, autoRun: false, createdAt: new Date().toISOString() }, ...p]); setEditionId(id); setTab("evento"); }} />
      ) : loading && !view ? <Skeleton rows={6} /> : !view || !ed ? (
        <Empty icon="🎄" title="Nenhuma edição criada">Abra a aba Admin e crie uma edição de teste para começar a montar o Trono de Natal.</Empty>
      ) : (
        <>
          {tab === "evento" && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["Participantes", view.standings.length, "🧑‍🤝‍🧑"],
                    ["Rodadas", `${ed.doneRounds}/20`, "⏱️"],
                    ["Combates", Math.round(view.standings.reduce((a, r) => a + r.wins + r.losses + r.draws, 0) / 2), "⚔️"],
                    ["Líder", view.standings[0] ? (view.standings[0].score / 100).toFixed(1) + " pts" : "–", "👑"],
                  ] as [string, string | number, string][]).map(([l, v, i]) => (
                    <div key={l} className="rounded-2xl border border-sky-200/10 bg-slate-950/70 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500"><span aria-hidden>{i}</span> {l}</p><p className="mt-0.5 text-xl font-black tabular-nums text-white">{v}</p></div>
                  ))}
                </div>
                <EditionNotice ed={ed} />
                {ed.phase === "FINISHED" && ed.championName && <Card glow><div className="flex items-center justify-center gap-3"><Ornament k="crown" size={56} /><p className="text-center text-2xl font-black text-amber-200">{ed.championName} é o campeão!</p></div></Card>}
                <Card><Title orn="crown" sub="Líder atual e os principais participantes.">Trono</Title><Podium rows={view.standings} avatars={view.avatars} /><div className="mt-4"><StandingsTable rows={view.standings.slice(0, 8)} cfg={ed.cfg} meId={me?.participantId} breakdown={view.breakdown} avatars={view.avatars} /></div></Card>
                {view.today && <TodayCard today={view.today} meId={me?.participantId} avatars={view.avatars} onReplay={openReplay} />}
                <HighlightsCard highlights={view.highlights} avatars={view.avatars} />
              </div>
              <div className="space-y-4">
                <Card>
                  <Title orn="snowflake" sub="Horários em Brasília.">Calendário</Title>
                  <ol className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2"><Pill tone={ed.phase === "PREPARATION" ? "gold" : "green"}>Seg</Pill><span className="text-slate-200">Inscrição e montagem até 21h</span></li>
                    {[1, 2, 3, 4].map((d) => {
                      const rs = view.rounds.filter((r) => r.dayIndex === d); const done = rs.filter((r) => r.status === "DONE").length;
                      return <li key={d} className="flex items-center gap-2"><Pill tone={done === 5 ? "green" : done > 0 ? "gold" : "slate"}>{DAY_LABELS[d].slice(0, 3)}</Pill><span className="text-slate-200">5 rodadas (09·12·15·18·21h)</span><span className="ml-auto text-xs tabular-nums text-slate-500">{done}/5</span></li>;
                    })}
                    <li className="text-[11px] text-slate-500">Descanso entre 21h e 08h: edite ordem e posturas do dia seguinte.</li>
                  </ol>
                </Card>
              </div>
            </div>
          )}

          {tab === "equipe" && (
            <div className="space-y-4">
              {ed.phase === "PREPARATION" && view.pool && (
                <>
                  <Card><Title sub="Inscrever → Montar automaticamente → Conferir → Confirmar. Você pode mudar tudo até as 21h de segunda.">{me ? "✓ Você está inscrito" : "Entre na disputa"}</Title>
                    {me && <div className="flex flex-wrap items-center gap-2"><Pill tone="green">Inscrição registrada</Pill><button onClick={() => start(async () => { const r = await withdrawAction(ed.id); flash(r.ok, r.ok ? "Inscrição cancelada." : r.error ?? ""); void refresh(); })} className="text-xs text-red-300 underline">Cancelar inscrição</button></div>}
                    {!ed.registrationOpen && <p className="mt-2 text-sm text-amber-300">As inscrições estão fechadas pelo admin.</p>}
                  </Card>
                  {ed.registrationOpen && <TeamBuilder key={`reg-${builderKey}-${me?.participantId ?? "new"}`} pool={view.pool} lockedIds={null} initial={me?.original ?? null} mode="register" onSave={saveRegistration} saving={saving} />}
                </>
              )}
              {ed.phase !== "PREPARATION" && !me && <Empty icon="🚪" title="Você não está nesta edição">A inscrição é voluntária e encerrou às 21h de segunda. Ainda dá para acompanhar tudo pelas outras abas.</Empty>}
              {ed.phase !== "PREPARATION" && me && me.formation && (
                <>
                  {ed.phase === "REST" ? (
                    <Card glow>
                      <Title sub={`Descanso: edite a formação de ${DAY_LABELS[ed.restDay ?? 1]}. A seleção dos 18 mascotes continua travada e a original de segunda fica guardada.`}>🌙 Configuração noturna</Title>
                      <div className="flex flex-wrap items-center gap-3">
                        {ed.freezeAt && !ed.isTest && <Countdown to={ed.freezeAt} label="Congela às 08h em" />}
                        {ed.isTest && <Pill tone="purple">Modo teste: sem prazo de 08h</Pill>}
                        {me.restPlan ? <Pill tone="gold">Formação personalizada salva</Pill> : <Pill>Usará a formação original</Pill>}
                      </div>
                    </Card>
                  ) : (
                    <Card><Title sub="Estado atual de cada slot. Trocas só acontecem entre uma batalha e outra.">Equipe em combate{me.day ? ` · ${DAY_LABELS[me.day]}` : ""}</Title></Card>
                  )}
                  {ed.phase === "REST" ? (
                    <TeamBuilder
                      key={`rest-${builderKey}`} pool={me.roster} lockedIds={new Set(me.roster.map((m) => m.id))} initial={restInit ?? me.restPlan ?? me.original} mode="rest" onSave={saveRest} saving={saving}
                      extraActions={<>
                        <button onClick={() => { setRestInit(me.original); setBuilderKey((k) => k + 1); }} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white">↺ Restaurar original de segunda</button>
                        {me.yesterday && <button onClick={() => { setRestInit(me.yesterday); setBuilderKey((k) => k + 1); }} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white">⟲ Reaproveitar a de ontem</button>}
                        {me.restPlan && <button onClick={() => start(async () => { await clearRestPlanAction(ed.id); setRestInit(null); setBuilderKey((k) => k + 1); flash(true, "Voltou para a formação original."); void refresh(); })} className="rounded-xl border border-red-400/30 px-3 py-2 text-xs font-bold text-red-300">Descartar personalização</button>}
                      </>}
                    />
                  ) : (
                    <FormationBoard formation={me.formation} state={me.state} roster={me.roster} />
                  )}
                </>
              )}
            </div>
          )}

          {tab === "ranking" && <div className="space-y-4"><ScoringExplainer cfg={ed.cfg} /><Card><Title sub="Toque numa linha para ver de onde vêm os pontos. 👑 Pressão do Trono · 🔥 Calor da Lareira.">Classificação geral</Title><StandingsTable rows={view.standings} cfg={ed.cfg} meId={me?.participantId} breakdown={view.breakdown} /></Card></div>}
          {tab === "mascotes" && <Card><Title sub="Top 30 por critério, com a origem dos pontos de cada mascote.">Ranking de mascotes</Title><MascotRanking rows={view.mascotRanking} meId={me?.participantId} /></Card>}
          {tab === "equipes" && <TeamsGrid teams={view.teams} meId={me?.participantId} restDay={ed.phase === "REST" ? ed.restDay : null} avatars={view.avatars} />}
          {tab === "manual" && <Manual cfg={ed.cfg} />}
          {tab === "batalhas" && <Card><Title orn="lantern" sub="Combates de cada dia, 10 por página. Cada replay é o combate real já resolvido — nada é sorteado de novo.">Histórico de batalhas</Title><HistoryView editionId={ed.id} rounds={view.rounds} hasMe={!!me} meId={me?.participantId} avatars={view.avatars} onReplay={openReplay} /></Card>}
          {tab === "relatorio" && (me ? <ReportView editionId={ed.id} participantId={me.participantId} doneDays={doneDays} onReplay={openReplay} /> : <Empty icon="📜" title="Sem relatório">Só participantes recebem o relatório diário.</Empty>)}
        </>
      )}

      {ed && <ReiIntro cfg={ed.cfg} forceKey={introKey} />}

      {replay && (
        <LeagueBattleReplayModal
          playerAName={replay.playerAName} playerBName={replay.playerBName} playerAId={replay.playerAId} winnerId={replay.winnerId} isDraw={replay.isDraw}
          replay={replay.replay} playerASurvivors={replay.survivorsA} playerBSurvivors={replay.survivorsB}
          specialRule={replay.modifiers.length ? { name: "Equilíbrio do Rei do Rio", description: replay.modifiers.join(" · ") } : null}
          lineupA={replay.lineupA} lineupB={replay.lineupB} onFinish={() => setReplay(null)}
        />
      )}
    </div>
  );
}
