"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getTowerRunStateAction,
  startTowerExpeditionAction,
  submitTowerActionAction,
  abandonTowerRunAction,
  advanceToBossAction,
  setTowerReadyAction,
  updateTowerLobbyClassAction,
  updateTowerLobbyMascotsAction,
  updateTowerLobbyStanceAction,
  removeTowerLobbyMemberAction,
  leaveTowerRoomAction,
} from "../actions";
import { TowerBattleGrid } from "./tower-battle-grid";
import { TowerNarrative } from "./tower-narrative";
import { TowerCombatScene } from "./tower-combat-scene";
import { TowerRoomView } from "./tower-room-view";
import { LeagueBattleReplayModal, type TurnLog, type ReplayLineupFighter } from "../../liga-semanal/_components/league-battle-replay";
import { getStaticSpriteUrl } from "@/lib/mascot-data";
import { getCombatRoleLabel } from "@/lib/combat-roles";

type State = Extract<Awaited<ReturnType<typeof getTowerRunStateAction>>, { ok: true; unchanged: false }>;
type Intent = "ADVANCE" | "DEFEND";

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

function TowerRunReport({ state }: { state: State }) {
  const report = state.exploration?.runReport;
  if (!report) return <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5 text-sm text-slate-400">Esta run terminou antes do novo relatório detalhado registrar combates.</div>;
  const mascots = Object.values(report.mascots);
  const dealt = mascots.reduce((sum, mascot) => sum + mascot.damageDealt, 0);
  const received = mascots.reduce((sum, mascot) => sum + mascot.damageReceived, 0);
  const kos = mascots.reduce((sum, mascot) => sum + mascot.kos, 0);
  const score = Math.max(0, Math.round(dealt + kos * 500 + report.alliesRecovered * 750 + report.bossesDefeated * 2500 + report.roomsCleared * 300 - received * .2));
  return <section className="overflow-hidden rounded-3xl border border-purple-400/35 bg-gradient-to-br from-purple-950/45 via-slate-950 to-cyan-950/30 shadow-2xl">
    <div className="border-b border-white/10 p-5 text-center"><p className="text-[10px] font-black uppercase tracking-[.25em] text-purple-300">Relatório final da expedição</p><p className="mt-2 text-4xl font-black text-white">{score.toLocaleString("pt-BR")}</p><p className="text-xs font-bold text-[#FFCB05]">PONTOS DE RUN</p></div>
    <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5">{[["Dano causado",dealt],["Dano recebido",received],["K.O.",kos],["Resgates",report.alliesRecovered],["Chefes",report.bossesDefeated]].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-black/25 p-3 text-center"><b className="block text-lg text-white">{Number(value).toLocaleString("pt-BR")}</b><span className="text-[9px] uppercase text-slate-400">{label}</span></div>)}</div>
    <div className="space-y-2 px-4 pb-4">{mascots.map((mascot)=>{const owner=state.members.find((member)=>member.userId===mascot.ownerUserId)?.name??"Jogador";return <div key={mascot.mascotId} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-slate-700 bg-slate-950/80 p-3 sm:grid-cols-[auto_1fr_repeat(4,minmax(70px,auto))] sm:items-center"><img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-12 w-12 object-contain [image-rendering:pixelated]"/><div><b className="text-white">{mascot.name} · Nv.{mascot.level}</b><p className="text-[10px] text-cyan-300">{owner}</p></div>{[["Dano",mascot.damageDealt],["Recebido",mascot.damageReceived],["Cura",mascot.healing],["K.O.",mascot.kos]].map(([label,value])=><div key={label} className="text-xs"><span className="text-slate-500">{label}</span><b className="ml-1 text-slate-100">{Number(value).toLocaleString("pt-BR")}</b></div>)}</div>})}</div>
    <p className="border-t border-white/10 px-5 py-3 text-[10px] text-slate-500">Score = dano + 500 por K.O. + 750 por resgate + 2.500 por chefe + 300 por sala vencida − 20% do dano recebido. Pontos de talento conquistados: <b className="text-purple-200">{report.talentPoints}</b>.</p>
  </section>;
}

export function TowerRunPanel({ runId, onLeft }: { runId: string; onLeft: () => void }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [intents, setIntents] = useState<Record<string, Intent>>({});
  const [interacting, setInteracting] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<Record<string, { x: number; y: number }>>({});
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [routeId, setRouteId] = useState<string>();
  const [puzzleChoice, setPuzzleChoice] = useState<string>();
  const [roomAction, setRoomAction] = useState<string>();
  const [showReplay, setShowReplay] = useState(false);
  const [editingTeam,setEditingTeam]=useState(false); const [lobbyPicks,setLobbyPicks]=useState<string[]>([]); const [lobbySearch,setLobbySearch]=useState("");
  const [phaseFlash,setPhaseFlash]=useState<string|null>(null);
  const inFlight = useRef(false);
  const revisionRef = useRef<string | undefined>(undefined);
  const lastTurnRef=useRef<number|null>(null);
  const replayOpenRef = useRef(false);
  const seenReplayRef = useRef<string | null>(null);
  useEffect(() => { replayOpenRef.current = showReplay; }, [showReplay]);
  useEffect(() => { setShowReplay(false); }, [state?.exploration?.currentRoom.id]);
  useEffect(() => {
    const replay = state?.exploration?.replay;
    if (!replay) return;
    const key = `${replay.title}:${replay.log.length}:${replay.winner}`;
    if (seenReplayRef.current !== key) { seenReplayRef.current = key; setShowReplay(true); }
  }, [state?.exploration?.replay]);
  useEffect(()=>{ if(!state||state.run.status!=="ACTIVE")return; if(lastTurnRef.current!==null&&lastTurnRef.current!==state.run.globalTurn){setPhaseFlash(state.exploration?.encounter?"ENCONTRO HOSTIL · DECIDAM LUTAR OU ESPERAR":`NOVO TURNO · ${state.exploration?.currentRoom.title??"TORRE"}`);setTimeout(()=>setPhaseFlash(null),1800)} lastTurnRef.current=state.run.globalTurn; },[state?.run.globalTurn,state?.run.status,state?.exploration?.encounter,state?.exploration?.currentRoom.title]);

  const refresh = useCallback(async () => {
    if (replayOpenRef.current) return;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await getTowerRunStateAction(runId, revisionRef.current);
      if ("error" in res) setError(res.error ?? "Erro ao carregar a expedição.");
      else if (!res.unchanged) {
        revisionRef.current = res.revision;
        setState(res);
      }
    } finally {
      inFlight.current = false;
    }
  }, [runId]);

  useEffect(() => {
    void refresh();
    const tick = () => { if (document.visibilityState === "visible") void refresh(); };
    const t = setInterval(tick, 6000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh]);

  if (error) return <section className={card}><p className="text-sm text-red-300">{error}</p></section>;
  if (!state) return <section className={card}><p className="text-sm text-slate-500">Carregando expedição…</p></section>;

  const run = state.run;
  const ended = run.status === "FINISHED" || run.status === "FAILED" || run.status === "ABANDONED";
  const room = state.exploration?.currentRoom;
  const missingTowerChoice = Boolean(state.exploration && (state.exploration.encounter ? !roomAction : ((room?.cleared && state.exploration.routes.length > 0 && !routeId) || (room?.kind === "PUZZLE" && !room.cleared && !puzzleChoice) || (["REST","EVENT","LUCK"].includes(room?.kind ?? "") && !room?.cleared && !roomAction))));
  const towerActionLabel = state.exploration?.encounter ? "Confirmar presença no encontro" : room?.cleared ? "Confirmar rota escolhida" : room?.kind === "PUZZLE" ? "Confirmar resposta do enigma" : room?.kind === "REST" ? "Confirmar decisão sobre a chama" : "Confirmar ação";

  return (
    <section className={card}>
      {phaseFlash&&<div className="fixed inset-0 z-[70] flex pointer-events-none items-center justify-center bg-black/45"><div className="animate-pulse rounded-3xl border-2 border-[#FFCB05] bg-slate-950/95 px-8 py-6 text-center text-xl font-black tracking-widest text-[#FFCB05] shadow-[0_0_70px_rgba(255,203,5,.5)]">{phaseFlash}</div></div>}
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

      {run.status === "LOBBY" && (() => {
        const me = state.members.find((member) => member.userId === state.mine.userId);
        const amHost = state.lobby.hostId === state.mine.userId;
        const iReady = Boolean(state.lobby.ready[state.mine.userId]);
        const allReady = state.members.every((member) => state.lobby.ready[member.userId]);
        const roleLabel = (key: string) => state.roles.find((role) => role.key === key)?.label ?? key;
        return (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-purple-400/25 bg-purple-950/20 px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-300">Sala {state.lobby.code}</p>
                <h2 className="text-base font-black text-white">Preparação da equipe</h2>
              </div>
              <span className="rounded-full border border-purple-300/30 px-3 py-1 text-[10px] font-black text-purple-200">{run.pace === "ONLINE" ? "ONLINE · 5 MIN" : "LENTO · 4 H"}</span>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* Equipe na sala */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Equipe na sala · {state.members.length}/3</p>
                {state.members.map((member) => {
                  const mReady = Boolean(state.lobby.ready[member.userId]);
                  return (
                    <article key={member.userId} className={`rounded-xl border p-2.5 ${mReady ? "border-emerald-400/45 bg-emerald-400/10" : "border-slate-700 bg-black/25"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <b className="text-sm text-white">{member.name}{member.userId === state.mine.userId && <span className="ml-1 text-[9px] text-cyan-300">(você)</span>}{state.lobby.hostId === member.userId && <span className="ml-1 text-[8px] font-black uppercase text-[#FFCB05]">dono</span>}</b>
                          <p className="text-[10px] font-bold text-cyan-300">{roleLabel(member.expeditionRole)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${mReady ? "bg-emerald-400 text-emerald-950" : "bg-slate-800 text-slate-400"}`}>{mReady ? "✓ PRONTO" : "PREPARANDO"}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {member.mascots.map((mascot) => (
                          <span key={mascot.id} title={`${mascot.name} · Nv.${mascot.level} · ${getCombatRoleLabel(mascot.stance)}`} className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-[9px] text-slate-300">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-6 w-6 object-contain [image-rendering:pixelated]" />
                            <span className="max-w-24 truncate"><b className="text-white">{mascot.name}</b> · {getCombatRoleLabel(mascot.stance)}</span>
                          </span>
                        ))}
                      </div>
                      {amHost && member.userId !== state.mine.userId && (
                        <button onClick={() => start(async () => { const result = await removeTowerLobbyMemberAction(runId, member.userId); if ("error" in result) toast.error(result.error); else { toast.success("Jogador removido da sala."); void refresh(); } })} className="mt-2 rounded-lg border border-red-400/30 px-2 py-1 text-[9px] font-black text-red-300 hover:bg-red-500/10">Expulsar</button>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* Minha preparação */}
              <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-cyan-950/10 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Minha preparação</p>
                  {iReady && <span className="text-[9px] font-black text-emerald-300">Travado no Pronto — cancele para editar</span>}
                </div>

                {/* Classe + trocar mascotes lado a lado */}
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-[10px] text-slate-400">
                    <span className="mb-1 block font-black uppercase tracking-wider text-slate-300">Classe</span>
                    <select disabled={pending || iReady} value={me?.expeditionRole} onChange={(event) => start(async () => { const res = await updateTowerLobbyClassAction(runId, event.target.value as never); if ("error" in res) toast.error(res.error); else { toast.success("Classe atualizada."); void refresh(); } })} className="w-full rounded-lg border border-purple-300/30 bg-slate-950 p-2 text-xs text-white disabled:opacity-50">
                      {state.roles.map((role) => <option key={role.key} value={role.key}>{role.label}</option>)}
                    </select>
                  </label>
                  <div className="text-[10px] text-slate-400">
                    <span className="mb-1 block font-black uppercase tracking-wider text-slate-300">Mascotes</span>
                    <button disabled={iReady} onClick={() => { setLobbyPicks(me?.mascots.map((mascot) => mascot.id) ?? []); setEditingTeam((value) => !value); }} className="w-full rounded-lg border border-cyan-300/30 bg-cyan-300/5 p-2 text-xs font-black text-cyan-200 disabled:opacity-40">{editingTeam ? "Fechar troca" : "Trocar meus 2 mascotes"}</button>
                  </div>
                </div>

                {/* Picker de mascotes (só ao trocar) */}
                {editingTeam && (
                  <div className="rounded-lg border border-slate-800 bg-black/30 p-2">
                    <input value={lobbySearch} onChange={(event) => setLobbySearch(event.target.value)} placeholder="Buscar mascote..." className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2 text-xs text-white" />
                    <div className="mt-2 grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
                      {state.lobbyMascots.filter((mascot) => mascot.name.toLowerCase().includes(lobbySearch.toLowerCase())).map((mascot) => {
                        const selected = lobbyPicks.includes(mascot.id);
                        return (
                          <button key={mascot.id} onClick={() => setLobbyPicks((current) => selected ? current.filter((id) => id !== mascot.id) : current.length < 2 ? [...current, mascot.id] : current)} className={`flex items-center gap-2 rounded-lg border p-1.5 text-left ${selected ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-slate-700 hover:border-slate-500"}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-9 w-9 object-contain [image-rendering:pixelated]" />
                            <span className="min-w-0 text-[10px] text-white"><b className="block truncate">{mascot.name}</b><small className="text-slate-500">Nv.{mascot.level}</small></span>
                          </button>
                        );
                      })}
                    </div>
                    <button disabled={pending || lobbyPicks.length !== 2} onClick={() => start(async () => { const result = await updateTowerLobbyMascotsAction(runId, lobbyPicks); if ("error" in result) toast.error(result.error); else { toast.success("Equipe atualizada."); setEditingTeam(false); void refresh(); } })} className="mt-2 w-full rounded-lg bg-cyan-300 py-1.5 text-xs font-black text-cyan-950 disabled:opacity-40">Salvar ({lobbyPicks.length}/2)</button>
                  </div>
                )}

                {/* Meus 2 mascotes com postura inline */}
                <div className="space-y-1.5">
                  {me?.mascots.map((mascot) => (
                    <div key={mascot.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-black/25 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-9 w-9 shrink-0 object-contain [image-rendering:pixelated]" />
                      <span className="min-w-0 flex-1 text-[11px] text-white"><b className="block truncate">{mascot.name}</b><small className="text-slate-500">Nv.{mascot.level}</small></span>
                      <select disabled={pending || iReady} value={mascot.stance} onChange={(event) => start(async () => { const result = await updateTowerLobbyStanceAction(runId, mascot.id, event.target.value); if ("error" in result) toast.error(result.error); else void refresh(); })} className="shrink-0 rounded-lg border border-slate-700 bg-slate-950 p-1.5 text-[11px] text-cyan-200 disabled:opacity-50">
                        {mascot.allowedStances.map((stance) => <option key={stance} value={stance}>{getCombatRoleLabel(stance)}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Ações */}
                <div className="grid gap-2">
                  <button type="button" disabled={pending} onClick={() => start(async () => { const next = !iReady; const res = await setTowerReadyAction(runId, next); if ("error" in res) toast.error(res.error); else void refresh(); })} className={`rounded-xl border py-2.5 text-sm font-black disabled:opacity-40 ${iReady ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"}`}>{iReady ? "Cancelar pronto" : "✓ Estou pronto"}</button>
                  {amHost && (
                    <button type="button" disabled={pending || !allReady} onClick={() => start(async () => { const res = await startTowerExpeditionAction(runId); if ("error" in res) { toast.error(res.error); return; } toast.success("Expedição iniciada!"); void refresh(); })} className="rounded-xl bg-[#FFCB05] px-4 py-3 text-sm font-black text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40">{allReady ? "🗼 Iniciar — todos confirmaram" : "Aguardando todos ficarem prontos…"}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {run.status === "ACTIVE" && (
        <div className="mt-4 space-y-4">
          {state.mine.spectator && <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"><b>Modo espectador</b><p className="mt-1 text-xs text-amber-100/70">Seus dois mascotes caíram. A equipe não espera mais sua confirmação, mas você recebe todas as atualizações e poderá voltar a agir se for revivido.</p></div>}
          {state.exploration && <TowerRoomView exploration={state.exploration} routeId={routeId} puzzleChoice={puzzleChoice} roomAction={roomAction} disabled={state.mine.confirmed || state.mine.spectator || pending} onRoute={setRouteId} onPuzzle={setPuzzleChoice} onRoomAction={setRoomAction} />}
          {state.exploration?.replay && <button type="button" onClick={() => setShowReplay(true)} className="w-full rounded-xl border border-cyan-300/35 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100">▶ Assistir ao combate convencional completo</button>}
          {showReplay && state.exploration?.replay && <LeagueBattleReplayModal playerAName="Expedição" playerBName={state.exploration.replay.title} playerAId={state.mine.userId} winnerId={state.exploration.replay.winner === "A" ? state.mine.userId : state.exploration.replay.winner === "B" ? "TORRE" : null} isDraw={state.exploration.replay.winner === "DRAW"} replay={state.exploration.replay.log as TurnLog[]} playerASurvivors={state.exploration.replay.teamASurvivors} playerBSurvivors={state.exploration.replay.teamBSurvivors} lineupA={state.exploration.replay.lineupA as ReplayLineupFighter[]} lineupB={state.exploration.replay.lineupB as ReplayLineupFighter[]} onFinish={() => setShowReplay(false)} />}
          {!state.exploration && state.battle && <TowerCombatScene
            events={state.lastEvents} units={state.battle.units} turn={state.lastResolvedTurn}
          />}
          <TowerNarrative scene={state.scene} />
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
                    <span className={`font-semibold ${isMe ? "text-[#FFCB05]" : "text-slate-200"}`}>{isMe ? `Você (${m?.name ?? ""})` : m?.name ?? "Jogador"} · {m?.expeditionRole ?? "?"}</span>
                    <span className="ml-auto">
                      {m?.afkRemoved
                        ? <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-300">AFK removido</span>
                        : m?.spectator
                          ? <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-300">ESPECTADOR · não bloqueia</span>
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

          {state.battle?.isBoss && (
            <p className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-center text-xs font-black uppercase tracking-widest text-purple-200">👑 Batalha de Boss</p>
          )}

          {/* Sala + fog */}
          {!state.exploration && state.battle && <TowerBattleGrid battle={state.battle} mineId={state.mine.userId} disabled={state.mine.confirmed || pending || state.battle.over} destinations={destinations} targets={targets}
            onDestination={(id, p) => { setDestinations((cur) => ({ ...cur, [id]: p })); setIntents((cur) => ({ ...cur, [id]: "ADVANCE" })); }}
            onTarget={(id, target) => setTargets((cur) => ({ ...cur, [id]: target }))}
            onDefend={(id) => setIntents((cur) => ({ ...cur, [id]: "DEFEND" }))} />}

          {state.lastEvents?.length > 0 && (
            <div className="rounded-2xl border border-purple-400/30 bg-gradient-to-r from-red-950/45 via-slate-950 to-blue-950/45 p-4">
              <p className="text-center text-[10px] font-black uppercase tracking-[.24em] text-purple-200">Confronto · rodada {state.lastResolvedTurn}</p>
              <div className="mt-3 space-y-2">{state.lastEvents.filter((event) => event.kind !== "MOVE").map((event, index) => (
                <div key={`${event.kind}-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
                  <span className="text-right font-bold text-cyan-200">{event.unitId ? state.battle?.units.find((u) => u.id === event.unitId)?.name ?? "Aliado" : "Torre"}</span>
                  <span className={`rounded-full px-2 py-1 font-black ${event.kind === "KO" ? "bg-red-500 text-white" : "bg-purple-500/20 text-purple-100"}`}>{event.kind === "KO" ? "K.O." : event.kind === "ATTACK" ? `⚔ ${event.amount ?? ""}` : "✦"}</span>
                  <span className="font-bold text-red-200">{event.targetId ? state.battle?.units.find((u) => u.id === event.targetId)?.name ?? "Alvo" : event.text}</span>
                </div>
              ))}</div>
            </div>
          )}

          {/* Mecanismos ao alcance */}
          {!state.battle?.over && state.battle && state.battle.objects.some((o) => !o.resolved) && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Mecanismos à vista</p>
              {state.battle.objects.filter((o) => !o.resolved).map((o) => {
                const on = interacting.includes(o.id);
                return <button type="button" key={o.id} disabled={!o.interactable||state.mine.confirmed} onClick={()=>setInteracting(cur=>on?cur.filter(x=>x!==o.id):[...cur,o.id])} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${on?"border-amber-300 bg-amber-300/15 ring-2 ring-amber-300/20":o.interactable?"border-purple-400/30 bg-purple-950/20 hover:border-purple-300":"border-slate-800 bg-slate-900/40 opacity-55"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}<img src={o.spriteUrl} alt="" className="h-14 w-14 object-contain drop-shadow-[0_0_8px_#a855f7]"/><span className="min-w-0 flex-1"><strong className="block text-white">{o.name}</strong><span className="mt-1 block text-[10px] leading-relaxed text-slate-400">{o.effect}</span><span className="mt-1 block text-[10px] font-bold text-purple-200">Progresso {o.progress}/{o.required}{o.suppression?" · enfraquece os inimigos":""}</span></span><span className="rounded-lg border border-amber-300/30 px-2 py-1 text-[9px] font-black text-amber-200">{on?"SELECIONADO":o.interactable?"INTERAGIR":"FORA DE ALCANCE"}</span>
                </button>;
              })}
            </div>
          )}
          {state.battle?.over && (
            <p className={`rounded-lg border px-3 py-2 text-xs font-bold ${state.battle.outcome === "WIN" ? "border-green-500/30 bg-green-500/5 text-green-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
              {state.battle.outcome === "WIN" ? (state.battle.isBoss ? "🏆 Boss derrotado! Andar conquistado." : "🏆 Encounter vencido!") : "☠️ Seus mascotes caíram no encounter."}
            </p>
          )}

          {/* Avançar para o boss após vencer o encounter normal */}
          {state.battle?.over && state.battle.outcome === "WIN" && !state.battle.isBoss && (
            <button type="button" disabled={pending} onClick={() => start(async () => {
              const res = await advanceToBossAction(runId);
              if ("error" in res) { toast.error(res.error); return; }
              toast.success("Rumo à câmara do boss!"); setInteracting([]); void refresh();
            })} className="w-full rounded-xl bg-purple-500 py-2.5 text-sm font-black text-white hover:bg-purple-400 disabled:opacity-40">
              {state.run.roomIndex<3?`🚪 Completar sala e avançar para a sala ${state.run.roomIndex+1}`:`👑 Abrir a câmara do Boss${state.battle.suppression.total-state.battle.suppression.resolved>0?` · ${state.battle.suppression.total-state.battle.suppression.resolved} mecanismo(s) ativo(s)`:""}`}
            </button>
          )}

          {/* Confirmar ações do turno */}
          {(state.exploration || !state.battle?.over) && !state.mine.spectator && (
            <div className="sticky bottom-3 z-30 overflow-hidden rounded-2xl border border-[#FFCB05]/40 bg-slate-950/95 shadow-2xl backdrop-blur">{state.exploration?.lastOutcome&&<div className="flex items-center gap-3 border-b border-purple-400/25 bg-purple-950/25 p-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={state.scene?.characterUrl || "/events/torre-dos-rebeldes/chandelure.png"} alt={state.scene?.speaker || "Chandelure"} className="h-14 w-14 shrink-0 object-contain"/><p className="text-xs leading-relaxed text-purple-100"><b className="mb-1 block text-[9px] uppercase tracking-widest text-purple-300">{state.scene?.speaker || "Chandelure, o Arquivista"}</b>{state.exploration.lastOutcome}</p></div>}<div className="p-3"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#FFCB05]">Janela da ação atual</p><p className="text-xs text-slate-400">{state.mine.confirmed ? "Sua escolha foi registrada; aguardando os demais." : missingTowerChoice ? "Escolha uma opção destacada antes de confirmar." : "Ao confirmar, esta decisão fica travada até a resolução coletiva."}</p></div><Countdown deadline={run.nextDeadline} /></div><button type="button" disabled={pending || state.mine.confirmed || missingTowerChoice} onClick={() => start(async () => {
              const payload = state.exploration ? { routeId, puzzleChoice, action: roomAction ?? "RESOLVE_ROOM" } : { intents: Object.fromEntries(state.myMascots.map((m) => [m.id, intents[m.id] ?? "ADVANCE"])), interactions: interacting, destinations, targets };
              const res = await submitTowerActionAction(runId, payload);
              if ("error" in res) { toast.error(res.error); return; }
              toast.success(res.resolved ? "Todos confirmaram — turno resolvido." : "Ordens confirmadas.");
              setDestinations({}); setTargets({}); setRouteId(undefined); setPuzzleChoice(undefined); setRoomAction(undefined); void refresh();
            })} className="w-full rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-2.5 text-sm font-black text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40">{state.mine.confirmed ? "Aguardando os demais jogadores" : towerActionLabel}</button></div></div>
          )}

          {/* Log recente */}
          {state.log.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-[10px] text-slate-400">
              {state.log.slice().reverse().map((line, i) => <p key={i}>· {line}</p>)}
            </div>
          )}
        </div>
      )}

      {ended && <div className="mt-4 space-y-3"><p className={`rounded-2xl border p-4 text-center text-lg font-black ${run.status==="FAILED"?"border-red-400/30 bg-red-950/20 text-red-200":"border-emerald-400/30 bg-emerald-950/20 text-emerald-200"}`}>{run.status === "FINISHED" ? "🏆 A Torre foi superada!" : run.status==="FAILED"?"☠️ A expedição caiu — mas deixou conhecimento para a próxima run.":"Expedição encerrada"}</p><TowerRunReport state={state}/>{state.exploration?.replay && <button type="button" onClick={() => setShowReplay(true)} className="w-full rounded-xl border border-cyan-300/35 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100">▶ Rever o último combate completo</button>}{showReplay && state.exploration?.replay && <LeagueBattleReplayModal playerAName="Expedição" playerBName={state.exploration.replay.title} playerAId={state.mine.userId} winnerId={state.exploration.replay.winner === "A" ? state.mine.userId : state.exploration.replay.winner === "B" ? "TORRE" : null} isDraw={state.exploration.replay.winner === "DRAW"} replay={state.exploration.replay.log as TurnLog[]} playerASurvivors={state.exploration.replay.teamASurvivors} playerBSurvivors={state.exploration.replay.teamBSurvivors} lineupA={state.exploration.replay.lineupA as ReplayLineupFighter[]} lineupB={state.exploration.replay.lineupB as ReplayLineupFighter[]} onFinish={() => setShowReplay(false)} />}</div>}

      {(() => {
        const isLobby = state.run.status === "LOBBY";
        const amHost = state.lobby?.hostId === state.mine.userId;
        // Membro (não-dono) no lobby: sai só a si, sem encerrar a sala.
        if (isLobby && !amHost) {
          return (
            <button type="button" disabled={pending} onClick={() => start(async () => {
              const res = await leaveTowerRoomAction(runId);
              if ("error" in res) { toast.error(res.error); return; }
              toast.success("Você saiu da sala."); onLeft();
            })} className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/5 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-400/10 disabled:opacity-40">
              Sair da sala
            </button>
          );
        }
        // Dono (cancela a sala) / run ativa (encerra) / encerrada (voltar).
        return (
          <button type="button" disabled={pending} onClick={() => start(async () => {
            if (!ended && !confirm(isLobby ? "Cancelar a sala? Todos os membros serão liberados." : "Encerrar a expedição em andamento?")) return;
            const res = await abandonTowerRunAction(runId);
            if ("error" in res) { toast.error(res.error); return; }
            toast.success(isLobby ? "Sala cancelada." : "Expedição encerrada."); onLeft();
          })} className="mt-4 rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-40">
            {ended ? "Voltar ao lobby" : isLobby ? "Cancelar sala" : "Encerrar expedição"}
          </button>
        );
      })()}
    </section>
  );
}
