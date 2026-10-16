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
  switchTowerSoloFormationAction,
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
import { buildTowerEntryStatus } from "@/lib/tower/event-disclosure";
import { TowerEventDisclosure } from "./tower-event-disclosure";
import { describeTowerFormation } from "@/lib/tower/ui-formation";

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
  if (!report) return <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5 text-sm text-slate-400">Resumo de dano e K.O. indisponível nesta tentativa. O espólio e seu estado final aparecem abaixo.</div>;
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

function TowerLootReport({ state }: { state: State }) {
  if (!state.rewards) return null;
  const labels = { PENDING_FLOOR: "Encontrado · não garantido", SECURED: state.rewards.settlement ? "Garantido · entregue aos elegíveis" : "Garantido · aguardando fim", LOST: "Perdido neste andar" } as const;
  return <section className="rounded-2xl border border-amber-300/25 bg-amber-950/10 p-4"><h3 className="text-sm font-black text-amber-100">Espólio da tentativa</h3><p className="mt-1 text-xs text-slate-300">Achados do andar só são garantidos ao derrotar o chefe. Ao encerrar, a entrega vai para os participantes, inclusive caídos; quem abandonou por AFK não recebe.</p>{state.rewards.entries.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{state.rewards.entries.map((entry) => <div key={entry.id} className={`rounded-lg border p-2.5 ${entry.status === "SECURED" ? "border-emerald-300/30 bg-emerald-300/10" : entry.status === "LOST" ? "border-red-300/30 bg-red-300/5" : "border-amber-300/30 bg-amber-300/5"}`}><b className="block text-xs text-white">Andar {entry.floor} · {entry.label}</b><span className="text-[10px] text-slate-300">{labels[entry.status]}</span></div>)}</div> : <p className="mt-3 text-xs text-slate-400">Nenhum achado registrado nesta tentativa.</p>}{state.rewards.settlement && <p className="mt-3 text-xs font-semibold text-cyan-100">{state.rewards.eligible ? "Suas recompensas garantidas foram processadas ao fim da tentativa." : "Você abandonou por AFK e não recebeu as recompensas desta tentativa."}</p>}</section>;
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
  const [recoveryTargetId, setRecoveryTargetId] = useState<string>("");
  const [showReplay, setShowReplay] = useState(false);
  const [editingTeam,setEditingTeam]=useState(false); const [lobbyPicks,setLobbyPicks]=useState<string[]>([]); const [lobbySearch,setLobbySearch]=useState("");
  const [editingFormation, setEditingFormation] = useState(false);
  const [formationPicks, setFormationPicks] = useState<string[]>([]);
  const [phaseFlash,setPhaseFlash]=useState<string|null>(null);
  const [discoveryFlash,setDiscoveryFlash]=useState<string|null>(null);
  const inFlight = useRef(false);
  const revisionRef = useRef<string | undefined>(undefined);
  const lastTurnRef=useRef<number|null>(null);
  const replayOpenRef = useRef(false);
  const seenReplayRef = useRef<string | null>(null);
  const seenOutcomeRef = useRef<string | null>(null);
  useEffect(() => { replayOpenRef.current = showReplay; }, [showReplay]);
  useEffect(() => { setShowReplay(false); }, [state?.exploration?.currentRoom.id]);
  useEffect(() => { setRouteId(undefined); setPuzzleChoice(undefined); setRoomAction(undefined); setRecoveryTargetId(""); }, [state?.expedition?.mine.roomId, state?.run.globalTurn]);
  useEffect(() => {
    const replay = state?.exploration?.replay;
    if (!replay) return;
    const key = `${replay.title}:${replay.log.length}:${replay.winner}`;
    if (seenReplayRef.current !== key) { seenReplayRef.current = key; setShowReplay(true); }
  }, [state?.exploration?.replay]);
  useEffect(()=>{ if(!state||state.run.status!=="ACTIVE")return; if(lastTurnRef.current!==null&&lastTurnRef.current!==state.run.globalTurn){setPhaseFlash(state.exploration?.encounter?"ENCONTRO HOSTIL · DECIDAM LUTAR OU ESPERAR":`NOVO TURNO · ${state.exploration?.currentRoom.title??"TORRE"}`);setTimeout(()=>setPhaseFlash(null),1800)} lastTurnRef.current=state.run.globalTurn; },[state?.run.globalTurn,state?.run.status,state?.exploration?.encounter,state?.exploration?.currentRoom.title]);
  useEffect(() => {
    const outcome = state?.exploration?.lastOutcome?.trim();
    if (!outcome || seenOutcomeRef.current === outcome) return;
    seenOutcomeRef.current = outcome;
    if (/pista|descobert|arquivo da torre|conhecimento compartilhado|enigma revel/i.test(outcome)) {
      setDiscoveryFlash(outcome);
      const timer = window.setTimeout(() => setDiscoveryFlash(null), 4200);
      return () => window.clearTimeout(timer);
    }
  }, [state?.exploration?.lastOutcome]);

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
    // Online continua responsivo; lobby e sobretudo o modo lento não precisam
    // baixar um probe de sincronização com a mesma frequência.
    const pollMs = state?.run.status === "LOBBY" ? 10_000 : state?.run.pace === "SLOW" ? 30_000 : 6_000;
    const t = setInterval(tick, pollMs);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refresh, state?.run.pace, state?.run.status]);

  if (error) return <section className={card}><p className="text-sm text-red-300">{error}</p></section>;
  if (!state) return <section className={card}><p className="text-sm text-slate-500">Carregando expedição…</p></section>;

  const run = state.run;
  const solo = state.partyProfile === "SOLO" && state.balanceVersion === 2;
  const requiredMascots = solo ? 4 : 2;
  const ownMember = state.members.find((member) => member.userId === state.mine.userId);
  const ownFormation = describeTowerFormation(state.partyProfile, ownMember?.mascots ?? []);
  const hpById = new Map(state.myMascots.map((mascot) => [mascot.id, mascot.hp]));
  const ended = run.status === "FINISHED" || run.status === "FAILED" || run.status === "ABANDONED";
  const room = state.exploration?.currentRoom;
  const missingTowerChoice = Boolean(state.exploration && !routeId && (state.exploration.encounter ? !roomAction : ((room?.cleared && state.exploration.routes.length > 0) || (room?.kind === "PUZZLE" && !room.cleared && !puzzleChoice) || (["REST","EVENT","LUCK"].includes(room?.kind ?? "") && !room?.cleared && !roomAction))));
  const towerActionLabel = routeId ? "Confirmar rota escolhida" : state.exploration?.encounter ? "Confirmar presença no encontro" : room?.cleared ? "Confirmar rota escolhida" : room?.kind === "PUZZLE" ? "Confirmar resposta do enigma" : room?.kind === "REST" ? "Confirmar decisão sobre a chama" : "Confirmar ação";

  return (
    <section className={card}>
      {phaseFlash&&<div className="fixed inset-0 z-[70] flex pointer-events-none items-center justify-center bg-black/45"><div className="animate-pulse rounded-3xl border-2 border-[#FFCB05] bg-slate-950/95 px-8 py-6 text-center text-xl font-black tracking-widest text-[#FFCB05] shadow-[0_0_70px_rgba(255,203,5,.5)]">{phaseFlash}</div></div>}
      {discoveryFlash&&<div className="pointer-events-none fixed inset-x-3 top-24 z-[75] mx-auto max-w-xl animate-pulse rounded-2xl border-2 border-cyan-300 bg-gradient-to-r from-cyan-950 via-slate-950 to-purple-950 p-4 text-center shadow-[0_0_65px_rgba(34,211,238,.5)]"><p className="text-[10px] font-black uppercase tracking-[.28em] text-cyan-300">✦ Nova pista descoberta</p><h3 className="mt-1 text-lg font-black text-white">Informação adicionada ao Arquivo da Torre</h3><p className="mt-1 line-clamp-2 text-xs text-cyan-100/75">{discoveryFlash}</p></div>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-[#FFCB05]">
          {run.status === "LOBBY" ? "Lobby" : ended ? "Encerrada" : "Expedição · Turno " + run.globalTurn}
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="rounded-full border border-cyan-300/25 px-2 py-1 text-cyan-100">{solo ? "SOLO · 2+2" : state.partyProfile === "GROUP" ? "GRUPO · 2 por pessoa" : "FORMAÇÃO LEGADA"}</span>
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
        const entryStatus = buildTowerEntryStatus(Boolean(state.eventDisclosure?.ticket.required), state.lobbyTicketCounts);
        const missingTicketNames = state.members.filter((member) => entryStatus.missingUserIds.includes(member.userId)).map((member) => member.name);
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
            {state.eventDisclosure && <TowerEventDisclosure disclosure={state.eventDisclosure} compact />}
            {missingTicketNames.length > 0 && <p role="status" className="rounded-xl border border-red-400/30 bg-red-950/15 p-3 text-xs font-semibold text-red-200">Ainda faltam tickets para iniciar: {missingTicketNames.join(", ")}. Ninguém será cobrado até a expedição começar.</p>}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* Equipe na sala */}
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{solo ? "Expedição solo · 1 treinador" : `Equipe na sala · ${state.members.length}/3`}</p>
                {state.members.map((member) => {
                  const mReady = Boolean(state.lobby.ready[member.userId]);
                  return (
                    <article key={member.userId} className={`rounded-xl border p-2.5 ${mReady ? "border-emerald-400/45 bg-emerald-400/10" : "border-slate-700 bg-black/25"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <b className="text-sm text-white">{member.name}{member.userId === state.mine.userId && <span className="ml-1 text-[9px] text-cyan-300">(você)</span>}{state.lobby.hostId === member.userId && <span className="ml-1 text-[8px] font-black uppercase text-[#FFCB05]">dono</span>}</b>
                          <p className="text-[10px] font-bold text-cyan-300">{roleLabel(member.expeditionRole)}</p>
                          <p className={`text-[10px] ${entryStatus.required && entryStatus.missingUserIds.includes(member.userId) ? "text-red-300" : "text-slate-400"}`}>{entryStatus.required ? `Ticket: ${state.lobbyTicketCounts.find((entry) => entry.userId === member.userId)?.count ?? 0} · ${entryStatus.missingUserIds.includes(member.userId) ? "faltando" : "disponível"}` : "Ticket não exigido nesta sala"}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black ${mReady ? "bg-emerald-400 text-emerald-950" : "bg-slate-800 text-slate-400"}`}>{mReady ? "✓ PRONTO" : "PREPARANDO"}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {member.mascots.map((mascot) => (
                          <span key={mascot.id} title={`${mascot.name} · Nv.${mascot.level} · ${getCombatRoleLabel(mascot.stance)}`} className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-[9px] text-slate-300">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-6 w-6 object-contain [image-rendering:pixelated]" />
                            <span className="max-w-24 truncate"><b className="text-white">{mascot.name}</b> · {solo ? (mascot.formationSlot ?? 0) <= 2 ? "Ativo" : "Reserva" : getCombatRoleLabel(mascot.stance)}</span>
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
                     <button disabled={iReady} onClick={() => { setLobbyPicks(me?.mascots.map((mascot) => mascot.id) ?? []); setEditingTeam((value) => !value); }} className="w-full rounded-lg border border-cyan-300/30 bg-cyan-300/5 p-2 text-xs font-black text-cyan-200 disabled:opacity-40">{editingTeam ? "Fechar troca" : `Trocar meus ${requiredMascots} mascotes`}</button>
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
                           <button key={mascot.id} onClick={() => setLobbyPicks((current) => selected ? current.filter((id) => id !== mascot.id) : current.length < requiredMascots ? [...current, mascot.id] : current)} className={`flex items-center gap-2 rounded-lg border p-1.5 text-left ${selected ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-slate-700 hover:border-slate-500"}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-9 w-9 object-contain [image-rendering:pixelated]" />
                            <span className="min-w-0 text-[10px] text-white"><b className="block truncate">{mascot.name}</b><small className="text-slate-500">Nv.{mascot.level}</small></span>
                          </button>
                        );
                      })}
                    </div>
                     {lobbyPicks.length > 0 && <div className="mt-2 space-y-1">{lobbyPicks.map((id, index) => <div key={id} className="flex items-center gap-2 rounded-lg bg-slate-900/70 p-1.5 text-[10px] text-white"><span className="w-5 text-center font-black text-cyan-300">{index + 1}</span><span className="min-w-0 flex-1 truncate">{state.lobbyMascots.find((mascot) => mascot.id === id)?.name ?? me?.mascots.find((mascot) => mascot.id === id)?.name ?? id} · {index < 2 ? "Ativo" : "Reserva"}</span><button type="button" aria-label={`Subir slot ${index + 1}`} disabled={index === 0} onClick={() => setLobbyPicks((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-30">↑</button></div>)}</div>}
                     <button disabled={pending || lobbyPicks.length !== requiredMascots} onClick={() => start(async () => { const result = await updateTowerLobbyMascotsAction(runId, lobbyPicks); if ("error" in result) toast.error(result.error); else { toast.success("Equipe atualizada."); setEditingTeam(false); void refresh(); } })} className="mt-2 w-full rounded-lg bg-cyan-300 py-1.5 text-xs font-black text-cyan-950 disabled:opacity-40">Salvar ({lobbyPicks.length}/{requiredMascots})</button>
                  </div>
                )}

                {/* Formação com postura inline */}
                <div className="space-y-1.5">
                  {me?.mascots.map((mascot) => (
                    <div key={mascot.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-black/25 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-9 w-9 shrink-0 object-contain [image-rendering:pixelated]" />
                       <span className="min-w-0 flex-1 text-[11px] text-white"><b className="block truncate">{mascot.name}</b><small className="text-slate-500">Nv.{mascot.level}{solo ? ` · ${mascot.formationSlot && mascot.formationSlot <= 2 ? "Ativo" : "Reserva"}` : ""}</small></span>
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
                     <button type="button" disabled={pending || !allReady || !entryStatus.canStart || (!solo && state.partyProfile === "GROUP" && state.members.length < 2)} onClick={() => start(async () => { const res = await startTowerExpeditionAction(runId); if ("error" in res) { toast.error(res.error); return; } toast.success("Expedição iniciada!"); void refresh(); })} className="rounded-xl bg-[#FFCB05] px-4 py-3 text-sm font-black text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40">{!solo && state.partyProfile === "GROUP" && state.members.length < 2 ? "Aguardando ao menos mais 1 treinador…" : !entryStatus.canStart ? "Aguardando tickets da equipe…" : allReady ? "🗼 Iniciar — todos confirmaram" : "Aguardando todos ficarem prontos…"}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {run.status === "ACTIVE" && (
        <div className="mt-4 space-y-4">
          {solo && <section className="rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-950/25 to-violet-950/20 p-3 sm:p-4" aria-label="Formação solo">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Formação solo · 2+2</p><h3 className="text-base font-black text-white">Quem luta agora e quem entra depois</h3></div><button type="button" disabled={pending || state.mine.confirmed || !state.expedition?.mine.canAct} onClick={() => { setFormationPicks([...(ownMember?.mascots.map((mascot) => mascot.id) ?? [])]); setEditingFormation((current) => !current); }} className="rounded-lg border border-cyan-300/35 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-40">{editingFormation ? "Fechar edição" : "Reorganizar antes de confirmar"}</button></div>
            <p className="mt-2 text-xs leading-5 text-slate-300">Os slots 1–2 começam o encontro. Quando ambos caem, os slots 3–4 vivos entram no mesmo combate sem restaurar o inimigo. Entre salas, você pode trocar a ordem sem gastar turno; os dois novos ativos precisam estar vivos.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{[...ownFormation.active, ...ownFormation.reserve].map((mascot, index) => <div key={mascot.id} className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 ${index < 2 ? "border-cyan-300/30 bg-cyan-300/5" : "border-violet-300/30 bg-violet-300/5"}`}><span className="w-5 text-center text-xs font-black text-white">{index + 1}</span><img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-9 w-9 shrink-0 object-contain [image-rendering:pixelated]"/><span className="min-w-0 flex-1"><b className="block truncate text-xs text-white">{mascot.name}</b><small className="text-[10px] text-slate-400">{index < 2 ? "Ativo" : "Reserva"} · {Math.max(0, hpById.get(mascot.id) ?? 0)} HP</small></span></div>)}</div>
            {editingFormation && <div className="mt-3 rounded-xl border border-cyan-300/25 bg-black/25 p-3"><p className="text-xs text-slate-300">Use as setas para definir os dois próximos ativos. Nenhum HP é recuperado pela troca.</p><div className="mt-2 grid gap-1.5 sm:grid-cols-2">{formationPicks.map((id, index) => { const mascot = ownMember?.mascots.find((entry) => entry.id === id); return <div key={id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-700 p-2 text-xs text-white"><span className="w-5 font-black text-cyan-300">{index + 1}</span><span className="min-w-0 flex-1 truncate">{mascot?.name ?? id} · {Math.max(0, hpById.get(id) ?? 0)} HP</span><button type="button" aria-label={`Subir ${mascot?.name ?? id}`} disabled={index === 0} onClick={() => setFormationPicks((current) => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-30">↑</button><button type="button" aria-label={`Descer ${mascot?.name ?? id}`} disabled={index === formationPicks.length - 1} onClick={() => setFormationPicks((current) => { const next = [...current]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-30">↓</button></div>; })}</div><button type="button" disabled={pending || formationPicks.length !== 4 || formationPicks.slice(0, 2).some((id) => (hpById.get(id) ?? 0) <= 0)} onClick={() => start(async () => { const result = await switchTowerSoloFormationAction(runId, run.globalTurn, formationPicks); if ("error" in result) toast.error(result.error); else { toast.success("Formação reorganizada sem gastar turno."); setEditingFormation(false); void refresh(); } })} className="mt-3 w-full rounded-lg bg-cyan-300 p-2 text-xs font-black text-slate-950 disabled:opacity-40">Confirmar nova formação</button></div>}
          </section>}
          {state.expedition && state.classGuide && <details className="rounded-xl border border-purple-300/25 bg-purple-950/15 p-3 text-xs text-slate-300"><summary className="cursor-pointer font-black text-purple-100">Minha classe: {state.classGuide.label} · bônus desta run</summary><p className="mt-2 leading-relaxed">{state.classGuide.benefit}</p><p className="mt-1 text-cyan-200">{state.classGuide.gameplayTip}</p>{state.classGuide.activeTalents.length > 0 && <div className="mt-3 border-t border-white/10 pt-2"><b className="text-amber-200">Legado compartilhado ativo</b><div className="mt-2 grid gap-1.5 sm:grid-cols-2">{state.classGuide.activeTalents.map((talent) => <p key={talent.key} className="rounded-lg bg-black/25 p-2"><b className="text-white">{talent.name} · Nv.{talent.rank}</b><span className="mt-1 block text-[10px] text-slate-400">{talent.description}</span></p>)}</div></div>}</details>}
          {state.expedition && !solo && <div className="rounded-xl border border-violet-300/30 bg-violet-300/10 p-3 text-xs text-violet-100"><b>Vantagem de reunião para o próximo chefe: {state.expedition.bossAdvantage.percent}%</b><p className="mt-1 text-slate-300">Duas frentes distintas que vencem salas no mesmo turno guardam 8%; três guardam 16%. A vantagem reduz os atributos inimigos no primeiro combate com o chefe deste andar e é consumida ao iniciar a luta. Dividir a equipe também aumenta a Pressão.</p></div>}
          {state.rewards && state.rewards.entries.length > 0 && <TowerLootReport state={state} />}
          {state.mine.spectator && <div className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100"><b>Modo espectador</b><p className="mt-1 text-xs text-amber-100/70">{solo ? "Seus quatro mascotes caíram e a tentativa terminou." : "Seus dois mascotes caíram. A equipe não espera mais sua confirmação; um aliado ainda poderá reanimá-lo."}</p></div>}
          {solo && state.expedition?.mine.status === "ACTIVE" && state.myMascots.some((mascot) => mascot.hp <= 0) && <div className="rounded-2xl border border-emerald-300/30 bg-emerald-950/20 p-3 sm:p-4"><h3 className="text-sm font-black text-emerald-100">Recuperar mascotes caídos</h3><p className="mt-1 text-xs leading-5 text-slate-300">Uma sala de recuperação ou um Kit de Reanimação devolve os mascotes caídos com metade do HP. A sala só fica disponível outra vez dois andares depois; o kit exige uma unidade no inventário. Esta escolha ocupa sua ação da janela.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" disabled={pending || state.mine.confirmed || !state.expedition.mine.canAct || state.exploration?.currentRoom.kind !== "RECOVERY" || !state.expedition.recoveryAvailability.available} onClick={() => start(async () => { const result = await submitTowerActionAction(runId, { roomId: state.expedition!.mine.roomId, globalTurn: run.globalTurn, action: "REVIVE_ROOM" }); if ("error" in result) toast.error(result.error); else { toast.success("Recuperação confirmada para esta janela."); void refresh(); } })} className="rounded-lg border border-emerald-300/40 p-2 text-xs font-black text-emerald-100 disabled:opacity-40">Usar sala de recuperação</button><button type="button" disabled={pending || state.mine.confirmed || !state.expedition.mine.canAct} onClick={() => start(async () => { const result = await submitTowerActionAction(runId, { roomId: state.expedition!.mine.roomId, globalTurn: run.globalTurn, action: "REVIVE_ITEM" }); if ("error" in result) toast.error(result.error); else { toast.success("Kit confirmado para esta janela."); void refresh(); } })} className="rounded-lg border border-cyan-300/40 p-2 text-xs font-black text-cyan-100 disabled:opacity-40">Usar Kit de Reanimação</button></div>{!state.expedition.recoveryAvailability.available && <p className="mt-2 text-xs text-amber-200">Sala novamente disponível no andar {state.expedition.recoveryAvailability.nextFloor}.</p>}</div>}
          {state.expedition && state.expedition.members.some((member) => member.status === "DOWNED") && state.expedition.mine.status === "ACTIVE" && <div className="rounded-2xl border border-emerald-300/30 bg-emerald-950/20 p-3 sm:p-4"><h3 className="text-sm font-black text-emerald-200">Reanimar um aliado caído</h3><p className="mt-1 text-xs text-slate-300">Ambos os mascotes voltam com metade do HP e agem no próximo turno. A sala de recuperação recarrega por dois andares, não por tempo.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={recoveryTargetId} onChange={(event) => setRecoveryTargetId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white"><option value="">Escolha um aliado caído</option>{state.expedition.members.filter((member) => member.status === "DOWNED").map((member) => <option key={member.id} value={member.id}>{member.name} · {member.roomTitle}</option>)}</select><button type="button" disabled={pending || state.mine.confirmed || !recoveryTargetId || state.exploration?.currentRoom.kind !== "RECOVERY" || !state.expedition.recoveryAvailability.available} onClick={() => start(async () => { const res = await submitTowerActionAction(runId, { roomId: state.expedition!.mine.roomId, globalTurn: run.globalTurn, action: "REVIVE_ROOM", targetMemberId: recoveryTargetId }); if ("error" in res) toast.error(res.error); else { toast.success("Resgate confirmado para este turno."); void refresh(); } })} className="rounded-lg border border-emerald-300/40 px-3 py-2 text-xs font-black text-emerald-100 disabled:opacity-40">Usar sala de recuperação</button><button type="button" disabled={pending || state.mine.confirmed || !recoveryTargetId || state.expedition.members.find((member) => member.id === recoveryTargetId)?.roomId !== state.expedition.mine.roomId} onClick={() => start(async () => { const res = await submitTowerActionAction(runId, { roomId: state.expedition!.mine.roomId, globalTurn: run.globalTurn, action: "REVIVE_ITEM", targetMemberId: recoveryTargetId }); if ("error" in res) toast.error(res.error); else { toast.success("Uso do kit confirmado para este turno."); void refresh(); } })} className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-black text-cyan-100 disabled:opacity-40">Usar Kit de Reanimação</button></div>{!state.expedition.recoveryAvailability.available && <p className="mt-2 text-xs text-amber-200">Sala disponível novamente no andar {state.expedition.recoveryAvailability.nextFloor}.</p>}</div>}
          {state.exploration && <TowerRoomView exploration={state.exploration} expedition={state.expedition} routeId={routeId} puzzleChoice={puzzleChoice} roomAction={roomAction} disabled={state.mine.confirmed || state.mine.spectator || pending || Boolean(state.expedition && !state.expedition.mine.canAct)} onRoute={setRouteId} onPuzzle={setPuzzleChoice} onRoomAction={setRoomAction} decisionFooter={!state.mine.spectator ? <div className="bg-slate-950/95 p-3">
              {state.exploration.lastOutcome && <div className="mb-3 flex items-center gap-3 rounded-xl border border-emerald-300/30 bg-gradient-to-r from-emerald-950/55 to-cyan-950/25 p-3 shadow-[0_0_25px_rgba(52,211,153,.12)]"><img src={state.scene?.characterUrl || "/events/torre-dos-rebeldes/chandelure.png"} alt={state.scene?.speaker || "Xandinho Guia"} className="h-14 w-14 shrink-0 object-contain"/><div className="min-w-0"><b className="block text-[9px] uppercase tracking-widest text-emerald-300">✓ Resultado da ação anterior · {state.scene?.speaker || "Xandinho Guia"}</b><p className="mt-1 text-xs font-semibold leading-relaxed text-emerald-50">{state.exploration.lastOutcome}</p><span className="mt-1 inline-block text-[9px] text-cyan-200">A consequência já foi aplicada ao estado compartilhado da run.</span></div></div>}
              <div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#FFCB05]">Confirmar esta decisão</p><p className="text-xs text-slate-400">{state.mine.confirmed ? "Sua escolha foi registrada; aguardando os demais." : missingTowerChoice ? "Escolha uma das opções deste painel antes de confirmar." : "A decisão será travada e ficará visível para seus aliados."}</p></div><Countdown deadline={run.nextDeadline} /></div>
              <button type="button" disabled={pending || state.mine.confirmed || missingTowerChoice || Boolean(state.expedition && !state.expedition.mine.canAct)} onClick={() => start(async () => {
                  const payload = { routeId, puzzleChoice, action: roomAction ?? "RESOLVE_ROOM", ...(state.expedition ? { roomId: state.expedition.mine.roomId, globalTurn: run.globalTurn } : {}) };
                  const res = await submitTowerActionAction(runId, payload);
                  if ("error" in res) { toast.error(res.error); return; }
                  toast.success(res.resolved ? "Todos confirmaram — turno resolvido." : "Decisão confirmada.");
                  setRouteId(undefined); setPuzzleChoice(undefined); setRoomAction(undefined); void refresh();
                })} className="w-full rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 py-2.5 text-sm font-black text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40">{state.mine.confirmed ? "Aguardando os demais jogadores" : towerActionLabel}</button>
            </div> : null} />}
          {state.exploration?.replay && <button type="button" onClick={() => setShowReplay(true)} className="w-full rounded-xl border border-cyan-300/35 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100">▶ Assistir ao combate convencional completo</button>}
          {showReplay && state.exploration?.replay && <LeagueBattleReplayModal playerAName="Expedição" playerBName={state.exploration.replay.title} playerAId={state.mine.userId} winnerId={state.exploration.replay.winner === "A" ? state.mine.userId : state.exploration.replay.winner === "B" ? "TORRE" : null} isDraw={state.exploration.replay.winner === "DRAW"} replay={state.exploration.replay.log as TurnLog[]} playerASurvivors={state.exploration.replay.teamASurvivors} playerBSurvivors={state.exploration.replay.teamBSurvivors} lineupA={state.exploration.replay.lineupA as ReplayLineupFighter[]} lineupB={state.exploration.replay.lineupB as ReplayLineupFighter[]} reserveLineupA={state.exploration.replay.reserveLineupA as ReplayLineupFighter[] | undefined} onFinish={() => setShowReplay(false)} />}
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
          {!state.exploration && !state.battle?.over && !state.mine.spectator && (
            <div className="sticky bottom-3 z-30 overflow-hidden rounded-2xl border border-[#FFCB05]/40 bg-slate-950/95 shadow-2xl backdrop-blur"><div className="p-3"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-[#FFCB05]">Janela da ação atual</p><p className="text-xs text-slate-400">{state.mine.confirmed ? "Sua escolha foi registrada; aguardando os demais." : missingTowerChoice ? "Escolha uma opção destacada antes de confirmar." : "Ao confirmar, esta decisão fica travada até a resolução coletiva."}</p></div><Countdown deadline={run.nextDeadline} /></div><button type="button" disabled={pending || state.mine.confirmed || missingTowerChoice} onClick={() => start(async () => {
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

      {ended && <div className="mt-4 space-y-3"><p className={`rounded-2xl border p-4 text-center text-lg font-black ${run.status==="FAILED"?"border-red-400/30 bg-red-950/20 text-red-200":"border-emerald-400/30 bg-emerald-950/20 text-emerald-200"}`}>{run.status === "FINISHED" ? "🏆 A Torre foi superada!" : run.status==="FAILED"?"☠️ A expedição caiu — mas deixou conhecimento para a próxima run.":"Expedição encerrada"}</p><TowerRunReport state={state}/><TowerLootReport state={state}/><section className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-950/10 p-4"><h3 className="text-sm font-black text-fuchsia-100">Mascotes que permaneceram cativos</h3>{state.captiveMascots.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{state.captiveMascots.map((mascot) => <div key={mascot.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-fuchsia-300/15 bg-black/20 p-2"><img src={getStaticSpriteUrl(mascot.pokemonId)} alt="" className="h-10 w-10 shrink-0 object-contain [image-rendering:pixelated]"/><div className="min-w-0 text-xs"><b className="block truncate text-white">{mascot.name}</b><span className="text-fuchsia-200">{mascot.owner} · Andar {mascot.floor}</span></div></div>)}</div> : <p className="mt-2 text-xs text-slate-400">Nenhum mascote desta tentativa permanece sob controle da Torre.</p>}</section>{state.exploration?.replay && <button type="button" onClick={() => setShowReplay(true)} className="w-full rounded-xl border border-cyan-300/35 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100">▶ Rever o último combate completo</button>}{showReplay && state.exploration?.replay && <LeagueBattleReplayModal playerAName="Expedição" playerBName={state.exploration.replay.title} playerAId={state.mine.userId} winnerId={state.exploration.replay.winner === "A" ? state.mine.userId : state.exploration.replay.winner === "B" ? "TORRE" : null} isDraw={state.exploration.replay.winner === "DRAW"} replay={state.exploration.replay.log as TurnLog[]} playerASurvivors={state.exploration.replay.teamASurvivors} playerBSurvivors={state.exploration.replay.teamBSurvivors} lineupA={state.exploration.replay.lineupA as ReplayLineupFighter[]} lineupB={state.exploration.replay.lineupB as ReplayLineupFighter[]} reserveLineupA={state.exploration.replay.reserveLineupA as ReplayLineupFighter[] | undefined} onFinish={() => setShowReplay(false)} />}</div>}

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
