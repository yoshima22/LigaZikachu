"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import {
  resolveArenaDraftBattleAction,
  advanceArenaDraftTimeoutAction,
  getDraftSyncStateAction,
  heartbeatArenaDraftAction,
  submitArenaDraftAction,
  submitArenaDraftStrategyAction,
} from "../actions";
const ROLES = [
  "DEFENDER",
  "ATTACKER",
  "FLANK",
  "OPPORTUNIST",
  "ENCOURAGER",
  "GUARDIAN",
  "DUELIST",
  "SABOTEUR",
  "HEALER",
  "SCOUT",
  "PROVOKER",
  "SPECIALIST",
  "SURVIVOR",
] as const;
const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  DEFENDER: "Defensor",
  ATTACKER: "Atacante",
  FLANK: "Flanco",
  OPPORTUNIST: "Oportunista",
  ENCOURAGER: "Encorajador",
  GUARDIAN: "Guardião",
  DUELIST: "Duelista",
  SABOTEUR: "Sabotador",
  HEALER: "Cuidador",
  SCOUT: "Batedor",
  PROVOKER: "Provocador",
  SPECIALIST: "Especialista",
  SURVIVOR: "Sobrevivente",
};
type Role = (typeof ROLES)[number];
// Espelha o pickOrder do servidor (actions.ts): draft em serpentina.
const DRAFT_PICK_ORDER = [
  "A",
  "B",
  "B",
  "A",
  "A",
  "B",
  "B",
  "A",
  "A",
  "B",
  "B",
  "A",
] as const;
const PERSONALITY_LABELS: Record<string, string> = {
  LOYAL: "Leal",
  PROUD: "Orgulhoso",
  MISCHIEVOUS: "Travesso",
  LAZY: "Preguiçoso",
  COMPETITIVE: "Competitivo",
  DRAMATIC: "Dramático",
  PLAYFUL: "Brincalhão",
  ELECTRIC: "Elétrico",
  TIMID: "Tímido",
  CHAOTIC: "Caótico",
  CURIOUS: "Curioso",
  GLUTTON: "Guloso",
  SERENE: "Sereno",
};
// Código de cores das personalidades (borda / fundo / texto), no mesmo espírito
// das tags de arena/liga.
const PERSONALITY_STYLES: Record<string, string> = {
  LOYAL: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  PROUD: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  MISCHIEVOUS: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200",
  LAZY: "border-slate-400/40 bg-slate-400/10 text-slate-200",
  COMPETITIVE: "border-red-400/40 bg-red-400/10 text-red-200",
  DRAMATIC: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  PLAYFUL: "border-lime-400/40 bg-lime-400/10 text-lime-200",
  ELECTRIC: "border-yellow-300/40 bg-yellow-300/10 text-yellow-200",
  TIMID: "border-indigo-400/40 bg-indigo-400/10 text-indigo-200",
  CHAOTIC: "border-purple-400/40 bg-purple-400/10 text-purple-200",
  CURIOUS: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  GLUTTON: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  SERENE: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
};
const personalityLabel = (value?: string | null) =>
  value ? (PERSONALITY_LABELS[value] ?? value) : null;
const personalityStyle = (value?: string | null) =>
  (value && PERSONALITY_STYLES[value]) ||
  "border-slate-500/40 bg-slate-500/10 text-slate-300";
// Som curto de notificação (WebAudio, sem asset) quando chega a vez do jogador.
function playTurnChime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.34);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    window.setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    /* áudio indisponível */
  }
}
type Pet = {
  id: string;
  speciesId: number;
  name: string;
  sprite: string;
  personality?: string | null;
  types: string[];
  advantages: string[];
  weaknesses: string[];
  isMega: boolean;
  status: "AVAILABLE" | "BANNED" | "PICKED";
  posture: Role;
  stats?: {
    force: number;
    agility: number;
    charisma: number;
    instinct: number;
    vitality: number;
  } | null;
  hp: number | null;
  maxHp: number;
};
type Battle = {
  result?: string;
  rounds?: number;
  events?: Array<{
    turn: number;
    actorId?: string;
    targetId?: string;
    actorName: string;
    targetName: string;
    action: string;
    damage: number;
    targetHpAfter?: number;
    effect?: string;
    actorRole?: string;
    targetRole?: string;
    advantageApplied?: boolean;
    multiplier?: number;
  }>;
  checkpoint?: number;
  checkpoints?: number[];
} | null;
type Strategy = {
  activeIds: string[];
  rivalActiveIds: string[];
  ownConfirmed: boolean;
  rivalConfirmed: boolean;
  checkpointTurn: number | null;
  deadlineAt: string | null;
} | null;
export function DraftRoomClient({
  matchId,
  state,
  stateVersion,
  turn,
  ownSide,
  playerNames,
  deadlineAt,
  progress,
  activity,
  own,
  rival,
  battle,
  winnerName,
  strategy,
}: {
  matchId: string;
  state: string;
  stateVersion: number;
  turn: string;
  ownSide: string;
  playerNames: { own: string; rival: string };
  deadlineAt: string | null;
  progress: {
    readyA: boolean;
    readyB: boolean;
    bansA: number;
    bansB: number;
    picksA: number;
    picksB: number;
  };
  activity: Array<{
    sequence: number;
    actor: string;
    type: string;
    targetId: string;
  }>;
  own: Pet[];
  rival: Pet[];
  battle: Battle;
  winnerName: string | null;
  strategy: Strategy;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [connection, setConnection] = useState<
    "connecting" | "live" | "fallback"
  >("connecting");
  const [opponentPresence, setOpponentPresence] = useState<{
    online: boolean;
    grace?: number;
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  // Poll leve estilo Batalha de Terreno: recarrega só quando a versão muda.
  useEffect(() => {
    if (["FINISHED", "CANCELLED"].includes(state)) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
      key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let cleanup = () => {};
    if (url && key) {
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 2 } },
      });
      const channel = supabase
        .channel(`arena-draft-${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "arena_draft_actions",
            filter: `matchId=eq.${matchId}`,
          },
          () => {
            if (document.visibilityState === "visible") router.refresh();
          },
        )
        .subscribe((status) =>
          setConnection(status === "SUBSCRIBED" ? "live" : "connecting"),
        );
      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    } else setConnection("fallback");
    let lastVersion = stateVersion;
    let busy = false;
    let ticks = 0;
    const tick = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        // Prioridade: detectar a mudança de estado o mais rápido possível.
        // Essa consulta é leve (só stateVersion/state/deadline).
        const sync = await getDraftSyncStateAction(matchId);
        if (
          sync.deadlinePassed &&
          ["TEAM_REVEAL", "BAN_PHASE", "PICK_PHASE", "STRATEGY_WINDOW"].includes(
            sync.state,
          )
        ) {
          await advanceArenaDraftTimeoutAction(matchId);
          router.refresh();
          return;
        }
        if (sync.stateVersion !== lastVersion && sync.stateVersion >= 0) {
          lastVersion = sync.stateVersion;
          router.refresh();
        }
        // Presença/desconexão em cadência menor e sem bloquear a sincronização.
        if (ticks % 5 === 0) {
          void heartbeatArenaDraftAction(matchId)
            .then((presence) => {
              if (presence.active)
                setOpponentPresence({
                  online: presence.opponentOnline,
                  grace: presence.graceSeconds,
                });
              if (presence.resolved) router.refresh();
            })
            .catch(() => {});
        }
        ticks += 1;
      } finally {
        busy = false;
      }
    };
    void tick();
    const poll = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      cleanup();
    };
  }, [matchId, router, state, stateVersion]);
  // Bans e picks entram no servidor um alvo por vez (ordem A B B A A B B A A B
  // B A). Quando o jogador tem dois picks seguidos, deixamos escolher os dois e
  // enviamos em sequência num único "Confirmar".
  const submitSelection = (ids: string[]) =>
    start(async () => {
      for (const id of ids) {
        const r = await submitArenaDraftAction(
          matchId,
          id,
          crypto.randomUUID(),
        );
        if (r.error) {
          toast.error(r.error);
          router.refresh();
          return;
        }
      }
      toast.success(ids.length > 1 ? "Escolhas registradas." : "Ação registrada.");
      setSelected([]);
      router.refresh();
    });
  const act = (id: string) => submitSelection([id]);
  const fight = () =>
    start(async () => {
      const r = await resolveArenaDraftBattleAction(matchId);
      r.error ? toast.error(r.error) : toast.success(r.success);
      router.refresh();
    });
  useEffect(() => {
    if (state !== "BATTLE_INIT") return;
    const timer = window.setTimeout(() => fight(), 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const reveal = state === "TEAM_REVEAL",
    banning = state === "BAN_PHASE",
    picking = state === "PICK_PHASE";
  const isMyTurn = turn === ownSide;
  const ownTeamConfirmed = ownSide === "A" ? progress.readyA : progress.readyB;
  const petById = new Map([...own, ...rival].map((pet) => [pet.id, pet]));
  // Reseta a seleção sempre que a vez ou a fase mudam.
  useEffect(() => {
    setSelected([]);
  }, [turn, state]);
  // Toca um som quando chega a vez do jogador (draft) ou abre a janela de troca.
  const chimedRef = useRef(false);
  useEffect(() => {
    const myDraftTurn =
      (state === "BAN_PHASE" || state === "PICK_PHASE") && turn === ownSide;
    const myStrategyTurn =
      state === "STRATEGY_WINDOW" && Boolean(strategy) && !strategy?.ownConfirmed;
    const shouldChime = myDraftTurn || myStrategyTurn;
    if (shouldChime && !chimedRef.current) playTurnChime();
    chimedRef.current = shouldChime;
  }, [state, turn, ownSide, strategy]);

  const pool =
    banning
      ? rival.filter((p) => p.status === "AVAILABLE")
      : picking
        ? own.filter((p) => p.status === "AVAILABLE")
        : [];
  // Quantos alvos o jogador confirma nesta vez: ban é sempre 1; no draft pode
  // ser 2 quando a ordem lhe dá dois picks seguidos.
  const totalPicks = progress.picksA + progress.picksB;
  let picksThisTurn = 0;
  for (
    let i = totalPicks;
    i < DRAFT_PICK_ORDER.length && DRAFT_PICK_ORDER[i] === ownSide;
    i += 1
  )
    picksThisTurn += 1;
  const required = banning ? 1 : Math.max(1, Math.min(picksThisTurn, pool.length));

  const title = reveal
    ? "Inspeção das equipes"
    : banning
      ? isMyTurn
        ? "Sua vez de banir"
        : "Fase de bans"
      : picking
        ? isMyTurn
          ? "Sua vez de escolher"
          : "Montagem das formações"
        : state === "STRATEGY_WINDOW"
          ? `Janela estratégica · T${strategy?.checkpointTurn ?? ""}`
          : state === "FINISHED"
            ? "Partida finalizada"
            : "Preparando combate";
  const subtitle =
    state === "STRATEGY_WINDOW"
      ? "Formação e posturas ficam secretas até os dois confirmarem."
      : reveal
        ? "Confirme sua equipe para começar o draft. O rival só enxerga espécie, tipos e Mega."
        : banning || picking
          ? isMyTurn
            ? "Selecione o mascote e confirme antes do cronômetro zerar."
            : `Vez de ${playerNames.rival} — a tela atualiza sozinha.`
          : state === "FINISHED"
            ? `${playerNames.own} × ${playerNames.rival}`
            : "Sincronizando os combatentes…";

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top,rgba(168,85,247,.2),transparent_45%),#050916] p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">
            Arena Draft · sala sincronizada
          </p>
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-bold ${connection === "live" ? "text-emerald-300" : connection === "fallback" ? "text-amber-300" : "text-slate-500"}`}
          >
            <i
              className={`h-1.5 w-1.5 rounded-full ${connection === "live" ? "bg-emerald-300" : "bg-amber-300"}`}
            />
            {connection === "live"
              ? "Conexão ao vivo"
              : connection === "fallback"
                ? "Sincronização rápida"
                : "Conectando…"}
          </span>
          {opponentPresence && !opponentPresence.online && (
            <span className="inline-flex rounded-full bg-amber-300/10 px-2 py-1 text-[9px] font-bold text-amber-200">
              Adversário reconectando · até {opponentPresence.grace ?? 90}s
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{subtitle}</p>
          </div>
          {(reveal || banning || picking || state === "STRATEGY_WINDOW") &&
            deadlineAt && (
              <div className="flex flex-col items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/5 px-5 py-2.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                  Tempo
                </span>
                <span className="font-pixel text-2xl text-[#FFCB05]">
                  <Countdown deadlineAt={deadlineAt} />
                </span>
              </div>
            )}
        </div>
        {(reveal || banning || picking) && (
          <StepTrail state={state} ownSide={ownSide} progress={progress} />
        )}
        {reveal && (
          <button
            disabled={pending || ownTeamConfirmed}
            onClick={() => act("reveal")}
            className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950 disabled:bg-emerald-300/10 disabled:text-emerald-200"
          >
            {ownTeamConfirmed
              ? "Equipe confirmada · aguardando adversário"
              : "Confirmar equipe e iniciar draft"}
          </button>
        )}
      </header>
      {state === "STRATEGY_WINDOW" && strategy ? (
        <StrategyWindow
          matchId={matchId}
          pets={own}
          rival={rival}
          playerNames={playerNames}
          strategy={strategy}
          battle={battle}
        />
      ) : state === "FINISHED" && battle ? (
        <Replay
          battle={battle}
          winnerName={winnerName}
          playerNames={playerNames}
          own={own}
          rival={rival}
        />
      ) : state === "BATTLE_INIT" ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 text-center">
          <b className="text-amber-200">Draft concluído</b>
          <p className="mt-2 text-sm text-slate-400">
            Seis entram em campo e os três restantes formam o banco. O combate
            pausa nos turnos 20, 35 e 45.
          </p>
          <div className="mx-auto mt-4 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full animate-pulse rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-400" />
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-200">
            Sincronizando combatentes…
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <DraftBoard
            own={own}
            rival={rival}
            progress={progress}
            ownSide={ownSide}
            playerNames={playerNames}
          />
          {(banning || picking) &&
            (isMyTurn ? (
              <SelectionGrid
                phase={banning ? "BAN" : "PICK"}
                pool={pool}
                selected={selected}
                required={required}
                onToggle={(id) =>
                  setSelected((current) =>
                    current.includes(id)
                      ? current.filter((x) => x !== id)
                      : current.length < required
                        ? [...current, id]
                        : required === 1
                          ? [id]
                          : current,
                  )
                }
                onConfirm={() => selected.length === required && submitSelection(selected)}
                pending={pending}
                deadlineAt={deadlineAt}
              />
            ) : (
              <WaitingCard rival={playerNames.rival} phase={banning ? "BAN" : "PICK"} />
            ))}
          {(banning || picking) && activity.length > 0 && (
            <DraftActivity activity={activity} petById={petById} />
          )}
        </div>
      )}
    </div>
  );
}
function StrategyWindow({
  matchId,
  pets,
  rival,
  playerNames,
  strategy,
  battle,
}: {
  matchId: string;
  pets: Pet[];
  rival: Pet[];
  playerNames: { own: string; rival: string };
  strategy: NonNullable<Strategy>;
  battle: Battle;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [active, setActive] = useState(strategy.activeIds);
  const [postures, setPostures] = useState<Record<string, Role>>(() =>
    Object.fromEntries(pets.map((p) => [p.id, p.posture])),
  );
  const living = useMemo(
    () => pets.filter((p) => p.hp === null || p.hp > 0),
    [pets],
  );
  const toggle = (id: string) =>
    setActive((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length < 6
          ? [...cur, id]
          : cur,
    );
  const submit = () =>
    start(async () => {
      const r = await submitArenaDraftStrategyAction({
        matchId,
        activeIds: active,
        postures,
      });
      r.error ? toast.error(r.error) : toast.success(r.success);
      router.refresh();
    });
  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-5 pb-28">
      <CombatStage
        own={pets.filter((pet) => strategy.activeIds.includes(pet.id))}
        rival={rival.filter((pet) => strategy.rivalActiveIds.includes(pet.id))}
        playerNames={playerNames}
        battle={battle}
        checkpoint={strategy.checkpointTurn}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-cyan-200">
            {active.length}/6 em campo ·{" "}
            {Math.max(0, living.length - active.length)} no banco
          </p>
          <p className="text-[11px] text-slate-400">
            Trocas preservam HP. Mascotes derrotados não retornam.
          </p>
        </div>
        <div className="flex gap-3 text-[10px] font-bold">
          {strategy.deadlineAt && (
            <Countdown deadlineAt={strategy.deadlineAt} />
          )}
          <span
            className={
              strategy.ownConfirmed ? "text-emerald-300" : "text-amber-300"
            }
          >
            Você: {strategy.ownConfirmed ? "confirmou" : "decidindo"}
          </span>
          <span
            className={
              strategy.rivalConfirmed ? "text-emerald-300" : "text-slate-400"
            }
          >
            Rival: {strategy.rivalConfirmed ? "confirmou" : "decidindo"}
          </span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pets.map((p) => {
          const selected = active.includes(p.id),
            dead = p.hp !== null && p.hp <= 0;
          const benchFull = !selected && active.length >= 6;
          return (
            <article
              key={p.id}
              className={`rounded-2xl border p-3 ${selected ? "border-cyan-300/60 bg-cyan-300/10" : "border-white/10 bg-white/[.02]"} ${dead ? "opacity-50" : ""}`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={p.sprite}
                  alt=""
                  className={`h-16 w-16 shrink-0 object-contain [image-rendering:pixelated] ${dead ? "grayscale" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm text-white">{p.name}</b>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[8px] font-black ${dead ? "bg-rose-500/15 text-rose-300" : selected ? "bg-cyan-400/15 text-cyan-200" : "bg-slate-500/15 text-slate-300"}`}
                    >
                      {dead ? "DERROTADO" : selected ? "EM CAMPO" : "BANCO"}
                    </span>
                    {personalityLabel(p.personality) && (
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[8px] font-bold ${personalityStyle(p.personality)}`}
                      >
                        {personalityLabel(p.personality)}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full transition-all duration-300"
                        style={{
                          width: `${Math.max(0, Math.min(100, ((p.hp ?? p.maxHp) / p.maxHp) * 100))}%`,
                          background:
                            (p.hp ?? p.maxHp) / p.maxHp > 0.5
                              ? "#6ee7b7"
                              : (p.hp ?? p.maxHp) / p.maxHp > 0.2
                                ? "#fcd34d"
                                : "#fb7185",
                        }}
                      />
                    </span>
                    <small className="w-16 shrink-0 text-right text-[9px] text-slate-400">
                      {Math.max(0, p.hp ?? p.maxHp)}/{p.maxHp}
                    </small>
                  </span>
                </div>
              </div>
              <button
                disabled={
                  strategy.ownConfirmed || (dead && !selected) || benchFull
                }
                onClick={() => toggle(p.id)}
                title={
                  benchFull
                    ? "Já há 6 em campo. Tire um do campo para colocar uma reserva."
                    : dead && selected
                      ? "Derrotado: mande ao banco para liberar a vaga a uma reserva viva."
                      : undefined
                }
                className={`mt-2 w-full rounded-lg px-2 py-2 text-[10px] font-bold transition disabled:opacity-40 ${selected ? "border border-rose-400/40 bg-rose-500/10 text-rose-200" : "border border-cyan-300/40 bg-cyan-300/10 text-cyan-200"}`}
              >
                {dead && selected
                  ? "↓ Liberar vaga (derrotado)"
                  : dead
                    ? "Fora de combate"
                    : selected
                      ? "↓ Mandar ao banco"
                      : benchFull
                        ? "Campo cheio (6/6)"
                        : "↑ Colocar em campo"}
              </button>
              <label className="mt-2 block text-[8px] font-bold uppercase tracking-wider text-slate-500">
                Postura
              </label>
              <select
                disabled={dead || strategy.ownConfirmed}
                value={postures[p.id]}
                onChange={(e) =>
                  setPostures((v) => ({ ...v, [p.id]: e.target.value as Role }))
                }
                className="mt-1 w-full rounded-lg border border-[#FFCB05]/30 bg-slate-900 px-2 py-2 text-[10px] font-bold text-[#FFCB05]"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r} className="text-white">
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </article>
          );
        })}
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
            Resumo até o checkpoint
          </p>
          <div className="mt-3 space-y-2">
            {pets.map((p) => {
              const dealt =
                battle?.events
                  ?.filter((e) => e.actorId === p.id && e.action === "ATTACK")
                  .reduce((sum, e) => sum + e.damage, 0) ?? 0;
              const received =
                battle?.events
                  ?.filter((e) => e.targetId === p.id && e.action === "ATTACK")
                  .reduce((sum, e) => sum + e.damage, 0) ?? 0;
              const kos =
                battle?.events?.filter(
                  (e) => e.actorId === p.id && e.targetHpAfter === 0,
                ).length ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-[10px]"
                >
                  <span className="max-w-32 truncate text-slate-300">
                    {p.name}
                  </span>
                  <span className="text-slate-500">
                    {kos} KO · {dealt} causado · {received} recebido
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">
            Acontecimentos recentes
          </p>
          <div className="mt-3 space-y-2">
            {battle?.events
              ?.slice(-8)
              .reverse()
              .map((event, index) => (
                <div
                  key={`${event.turn}-${index}`}
                  className="rounded-lg bg-slate-950/70 px-3 py-2 text-[10px] text-slate-300"
                >
                  <b className="text-white">
                    T{event.turn} · {event.actorName}
                  </b>{" "}
                  → {event.targetName} · {event.damage}{" "}
                  {event.action === "HEAL" ? "HP" : "dano"}
                  {event.effect && (
                    <span className="mt-1 block text-fuchsia-200">
                      {event.effect}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
      {/* Barra fixa com tempo + travar, sempre visível (padrão Torre dos Rebeldes). */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/90 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          {strategy.deadlineAt && (
            <div className="flex shrink-0 flex-col items-center rounded-xl border border-cyan-300/25 bg-cyan-300/5 px-3 py-1.5">
              <span className="text-[8px] font-black uppercase tracking-widest text-cyan-300">
                Tempo
              </span>
              <span className="font-pixel text-lg text-[#FFCB05]">
                <Countdown deadlineAt={strategy.deadlineAt} />
              </span>
            </div>
          )}
          <span className="shrink-0 text-xs font-bold text-cyan-200">
            {active.length}/6 em campo
          </span>
          <button
            disabled={pending || strategy.ownConfirmed || active.length !== 6}
            onClick={submit}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-40"
          >
            {strategy.ownConfirmed
              ? "Estratégia confirmada · aguardando rival"
              : "Travar estratégia em segredo"}
          </button>
        </div>
      </div>
    </section>
  );
}
type BattleEvent = NonNullable<NonNullable<Battle>["events"]>[number];
// Player de combate por eventos: reproduz as ações em sequência, com sprites
// grandes e barras de vida que descem a cada golpe (feedback real da luta).
function AnimatedBattle({
  leftName,
  rightName,
  leftPets,
  rightPets,
  events,
  from = 0,
  to,
  controls = false,
}: {
  leftName: string;
  rightName: string;
  leftPets: Pet[];
  rightPets: Pet[];
  events: BattleEvent[];
  from?: number;
  to?: number;
  controls?: boolean;
}) {
  const end = to ?? events.length - 1;
  const startCursor = Math.max(-1, from - 1);
  const [cursor, setCursor] = useState(startCursor);
  const [playing, setPlaying] = useState(true);
  // Ritmo lento por padrão para dar tempo de ler cada ação e efeito.
  const [speedMs, setSpeedMs] = useState(1300);
  useEffect(() => {
    setCursor(Math.max(-1, from - 1));
    setPlaying(true);
  }, [from, end, events.length]);
  useEffect(() => {
    if (!playing) return;
    if (cursor >= end) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setCursor((value) => Math.min(end, value + 1)),
      speedMs,
    );
    return () => window.clearTimeout(timer);
  }, [playing, cursor, end, speedMs]);
  const hp = new Map<string, number>();
  const petById = new Map<string, Pet>();
  [...leftPets, ...rightPets].forEach((pet) => {
    hp.set(pet.id, pet.maxHp);
    petById.set(pet.id, pet);
  });
  for (let index = 0; index <= cursor && index < events.length; index += 1) {
    const event = events[index];
    if (event.targetId && event.targetHpAfter !== undefined)
      hp.set(event.targetId, event.targetHpAfter);
  }
  const current = cursor >= from && cursor < events.length ? events[cursor] : null;
  const roleLabel = (value?: string) =>
    value ? (ROLE_LABELS[value as Role] ?? value) : null;
  const togglePlay = () => {
    if (cursor >= end) {
      setCursor(startCursor);
      setPlaying(true);
    } else setPlaying((value) => !value);
  };
  // Fila de ação: próximos mascotes a agir.
  const upcoming = events
    .slice(cursor + 1, Math.min(end + 1, cursor + 6))
    .filter((event) => event.actorId);
  // Efeitos recentes aplicados (lista separada e legível).
  const recentEffects = events
    .slice(from, cursor + 1)
    .map((event, index) => ({ event, index }))
    .filter(
      ({ event }) =>
        event.effect || event.targetHpAfter === 0 || event.advantageApplied,
    )
    .slice(-6)
    .reverse();
  const renderSide = (pets: Pet[], right = false) => (
    <div
      className={`mt-2 flex flex-wrap gap-2 ${right ? "justify-center sm:justify-end" : "justify-center sm:justify-start"}`}
    >
      {pets.map((pet) => {
        const value = Math.max(0, hp.get(pet.id) ?? pet.maxHp);
        const percent = Math.max(0, Math.min(100, (value / pet.maxHp) * 100));
        const isActor = current?.actorId === pet.id;
        const isTarget = current?.targetId === pet.id;
        const beingHit = isTarget && current?.action !== "HEAL";
        const beingHealed = isTarget && current?.action === "HEAL";
        const dead = value <= 0;
        return (
          <div
            key={pet.id}
            className={`relative w-[4.75rem] rounded-xl border p-1.5 transition ${dead ? "border-white/10 opacity-40 grayscale" : isTarget ? "border-rose-400/70 bg-rose-500/10" : isActor ? "border-cyan-300/70 bg-cyan-300/10 ring-1 ring-cyan-300/40" : "border-white/10 bg-slate-950/60"}`}
          >
            {isTarget && (
              <span
                key={cursor}
                className={`adb-float pointer-events-none absolute left-1/2 top-1 z-10 -translate-x-1/2 text-xs font-black ${beingHealed ? "text-emerald-300" : "text-rose-300"}`}
              >
                {beingHealed ? "+" : "-"}
                {current?.damage}
              </span>
            )}
            <div
              key={`sprite-${isTarget || isActor ? cursor : "idle"}`}
              className={
                beingHit
                  ? "adb-shake"
                  : beingHealed
                    ? "adb-heal"
                    : isActor
                      ? "adb-lunge"
                      : ""
              }
            >
              <img
                src={pet.sprite}
                alt=""
                className="mx-auto h-14 w-14 object-contain [image-rendering:pixelated]"
              />
            </div>
            <span className="block truncate text-center text-[8px] font-bold text-white">
              {pet.name}
            </span>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${percent}%`,
                  background:
                    percent > 50 ? "#6ee7b7" : percent > 20 ? "#fcd34d" : "#fb7185",
                }}
              />
            </div>
            <span className="mt-0.5 block text-center text-[7px] tabular-nums text-slate-400">
              {value}/{pet.maxHp}
            </span>
          </div>
        );
      })}
    </div>
  );
  return (
    <div>
      <style>{`
        @keyframes adbShake {0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
        @keyframes adbHeal {0%{filter:brightness(1)}50%{filter:brightness(1.8) drop-shadow(0 0 6px #6ee7b7)}100%{filter:brightness(1)}}
        @keyframes adbLunge {0%,100%{transform:translateY(0)}40%{transform:translateY(-5px) scale(1.06)}}
        @keyframes adbFloat {0%{opacity:0;transform:translate(-50%,4px)}20%{opacity:1}100%{opacity:0;transform:translate(-50%,-16px)}}
        .adb-shake{animation:adbShake .5s ease}
        .adb-heal{animation:adbHeal .6s ease}
        .adb-lunge{animation:adbLunge .4s ease}
        .adb-float{animation:adbFloat 1s ease forwards}
      `}</style>
      <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div>
          <b className="text-[10px] text-slate-300">{leftName}</b>
          {renderSide(leftPets)}
        </div>
        <span className="self-center text-center text-sm font-black text-fuchsia-300">
          VS
        </span>
        <div className="sm:text-right">
          <b className="text-[10px] text-slate-300">{rightName}</b>
          {renderSide(rightPets, true)}
        </div>
      </div>

      {/* Narração da ação atual */}
      <div className="mt-3 min-h-[2.75rem] rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-[11px]">
        {current ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <b className="text-white">
              T{current.turn} · {current.actorName}
            </b>
            {roleLabel(current.actorRole) && (
              <span className="rounded-full border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#FFCB05]">
                {roleLabel(current.actorRole)}
              </span>
            )}
            {personalityLabel(
              current.actorId ? petById.get(current.actorId)?.personality : null,
            ) && (
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${personalityStyle(current.actorId ? petById.get(current.actorId)?.personality : null)}`}
              >
                {personalityLabel(
                  current.actorId
                    ? petById.get(current.actorId)?.personality
                    : null,
                )}
              </span>
            )}
            <span className="text-slate-400">
              {current.action === "HEAL" ? "curou" : "atacou"}
            </span>
            <b className="text-slate-200">{current.targetName}</b>
            {roleLabel(current.targetRole) && (
              <span className="rounded-full border border-slate-600 bg-slate-950 px-1.5 py-0.5 text-[8px] font-bold text-slate-400">
                {roleLabel(current.targetRole)}
              </span>
            )}
            <span
              className={
                current.action === "HEAL" ? "text-emerald-300" : "text-rose-300"
              }
            >
              · {current.damage} {current.action === "HEAL" ? "HP" : "dano"}
            </span>
            {current.advantageApplied && current.action !== "HEAL" && (
              <span className="rounded-full border border-yellow-300/40 bg-yellow-300/10 px-1.5 py-0.5 text-[8px] font-black text-yellow-200">
                ⚡ SUPER EFETIVO
              </span>
            )}
            {current.targetHpAfter === 0 && (
              <span className="font-black text-rose-400">KO!</span>
            )}
          </div>
        ) : (
          <span className="block text-center text-slate-500">
            {cursor < from ? "Preparando o confronto…" : "Fim do segmento."}
          </span>
        )}
      </div>

      {/* Fila de ação */}
      {upcoming.length > 0 && (
        <div className="mt-2 flex items-center gap-2 overflow-x-auto rounded-xl border border-white/5 bg-slate-950/50 px-2 py-1.5">
          <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-slate-500">
            A seguir
          </span>
          {upcoming.map((event, index) => {
            const actor = event.actorId ? petById.get(event.actorId) : null;
            return (
              <div
                key={`${event.turn}-${index}`}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-white/[.04] px-1.5 py-0.5"
              >
                {actor && (
                  <img
                    src={actor.sprite}
                    alt=""
                    className="h-5 w-5 object-contain [image-rendering:pixelated]"
                  />
                )}
                <span className="text-[8px] text-slate-300">
                  {event.actorName}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista de efeitos aplicados */}
      {recentEffects.length > 0 && (
        <div className="mt-2 rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/[.03] p-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-fuchsia-300">
            Efeitos aplicados
          </p>
          <div className="mt-1 space-y-1">
            {recentEffects.map(({ event, index }) => (
              <p
                key={`${event.turn}-${index}`}
                className="text-[10px] leading-tight text-slate-300"
              >
                <b className="text-slate-500">T{event.turn}</b>{" "}
                {event.targetHpAfter === 0 && (
                  <span className="font-black text-rose-300">
                    {event.targetName} sofreu KO ·{" "}
                  </span>
                )}
                {event.advantageApplied && event.action !== "HEAL" && (
                  <span className="text-yellow-200">⚡ super efetivo · </span>
                )}
                {event.effect && (
                  <span className="text-fuchsia-100">{event.effect}</span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {controls && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setPlaying(false);
              setCursor((value) => Math.max(startCursor, value - 1));
            }}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-white"
          >
            ◀
          </button>
          <button
            onClick={togglePlay}
            className="rounded-lg bg-cyan-300 px-4 py-1.5 text-xs font-black text-slate-950"
          >
            {playing ? "Pausar" : cursor >= end ? "Repetir" : "Reproduzir"}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setCursor((value) => Math.min(end, value + 1));
            }}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-white"
          >
            ▶
          </button>
          <div className="flex overflow-hidden rounded-lg border border-slate-700 text-[10px]">
            {(
              [
                ["Lento", 1800],
                ["Normal", 1300],
                ["Rápido", 750],
              ] as const
            ).map(([label, ms]) => (
              <button
                key={label}
                onClick={() => setSpeedMs(ms)}
                className={`px-2 py-1.5 font-bold ${speedMs === ms ? "bg-cyan-300 text-slate-950" : "text-slate-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={startCursor}
            max={end}
            value={cursor}
            onChange={(event) => {
              setPlaying(false);
              setCursor(Number(event.target.value));
            }}
            className="ml-1 flex-1 accent-cyan-300"
          />
          <span className="w-12 shrink-0 text-right text-[10px] text-slate-400">
            {Math.max(0, cursor - from + 1)}/{end - from + 1}
          </span>
        </div>
      )}
    </div>
  );
}
function CombatStage({
  own,
  rival,
  playerNames,
  battle,
  checkpoint,
}: {
  own: Pet[];
  rival: Pet[];
  playerNames: { own: string; rival: string };
  battle: Battle;
  checkpoint: number | null;
}) {
  const events = battle?.events ?? [];
  const previousCheckpoint =
    checkpoint === 35 ? 20 : checkpoint === 45 ? 35 : 0;
  const inSegment = (event: BattleEvent) =>
    event.turn > previousCheckpoint &&
    (checkpoint === null || event.turn <= checkpoint);
  const from = Math.max(0, events.findIndex(inSegment));
  let to = from;
  events.forEach((event, index) => {
    if (inSegment(event)) to = index;
  });
  const segment = events.filter(inSegment);
  const damage = segment
    .filter((event) => event.action === "ATTACK")
    .reduce((sum, event) => sum + event.damage, 0);
  const healing = segment
    .filter((event) => event.action === "HEAL")
    .reduce((sum, event) => sum + event.damage, 0);
  const kos = segment.filter((event) => event.targetHpAfter === 0).length;
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.10),transparent_48%),linear-gradient(135deg,#071324,#170822)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.2em] text-cyan-300">
            Segmento até o turno {checkpoint ?? "final"}
          </p>
          <h2 className="mt-1 text-lg font-black text-white">
            Reveja o combate e decida
          </h2>
        </div>
        <div className="flex gap-2 text-[9px] font-bold">
          <span className="rounded-lg bg-rose-400/10 px-2 py-1 text-rose-200">
            {damage} dano
          </span>
          <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-emerald-200">
            {healing} cura
          </span>
          <span className="rounded-lg bg-amber-300/10 px-2 py-1 text-amber-200">
            {kos} KO
          </span>
        </div>
      </div>
      <div className="mt-4">
        {segment.length > 0 ? (
          <AnimatedBattle
            leftName={playerNames.own}
            rightName={playerNames.rival}
            leftPets={own}
            rightPets={rival}
            events={events}
            from={from}
            to={to}
          />
        ) : (
          <p className="py-6 text-center text-xs text-slate-500">
            Sem ações neste segmento ainda.
          </p>
        )}
      </div>
    </div>
  );
}
function Countdown({ deadlineAt }: { deadlineAt: string }) {
  const [seconds, setSeconds] = useState(() =>
    Math.max(
      0,
      Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000),
    ),
  );
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setSeconds(
          Math.max(
            0,
            Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000),
          ),
        ),
      500,
    );
    return () => window.clearInterval(timer);
  }, [deadlineAt]);
  return (
    <span>
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}
// Placar espelhado das duas equipes, no estilo da Batalha de Terreno.
function DraftBoard({
  own,
  rival,
  progress,
  ownSide,
  playerNames,
}: {
  own: Pet[];
  rival: Pet[];
  progress: {
    bansA: number;
    bansB: number;
    picksA: number;
    picksB: number;
  };
  ownSide: string;
  playerNames: { own: string; rival: string };
}) {
  const ownBansSuffered = ownSide === "A" ? progress.bansB : progress.bansA;
  const rivalBansSuffered = ownSide === "A" ? progress.bansA : progress.bansB;
  const ownPicks = ownSide === "A" ? progress.picksA : progress.picksB;
  const rivalPicks = ownSide === "A" ? progress.picksB : progress.picksA;
  const panels = [
    {
      name: playerNames.own,
      pets: own,
      picks: ownPicks,
      bans: ownBansSuffered,
      mine: true,
    },
    {
      name: playerNames.rival,
      pets: rival,
      picks: rivalPicks,
      bans: rivalBansSuffered,
      mine: false,
    },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {panels.map((panel) => (
        <section
          key={panel.name}
          className={`rounded-2xl border p-4 ${panel.mine ? "border-cyan-400/40 bg-cyan-500/[.04]" : "border-slate-800 bg-slate-950/60"}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <b className="truncate text-sm text-white">
              {panel.name}
              {panel.mine && (
                <span className="ml-2 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[8px] font-black uppercase text-cyan-200">
                  Você
                </span>
              )}
            </b>
            <span className="shrink-0 text-[10px] font-bold text-slate-400">
              <span className="text-cyan-300">{panel.picks}/6</span> ·{" "}
              <span className="text-rose-300">{panel.bans}/3 banidos</span>
            </span>
          </div>
          {panel.mine ? (
            // Time do próprio jogador: revela postura, personalidade e status.
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {panel.pets.map((pet) => (
                <div
                  key={pet.id}
                  className={`relative rounded-lg border p-2 ${pet.status === "BANNED" ? "border-rose-400/40 bg-rose-950/30" : pet.status === "PICKED" ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-slate-950/40"}`}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={pet.sprite}
                      alt=""
                      className={`h-10 w-10 shrink-0 object-contain [image-rendering:pixelated] ${pet.status === "BANNED" ? "opacity-40 grayscale" : ""}`}
                    />
                    <div className="min-w-0 flex-1">
                      <span
                        className={`block break-words text-[11px] font-bold leading-tight ${pet.status === "BANNED" ? "text-rose-300 line-through" : "text-white"}`}
                      >
                        {pet.name}
                        {pet.isMega && (
                          <span className="ml-1 text-[8px] font-black text-amber-300">
                            MEGA
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        <span className="rounded border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-1 text-[8px] font-bold text-[#FFCB05]">
                          {ROLE_LABELS[pet.posture]}
                        </span>
                        {personalityLabel(pet.personality) && (
                          <span
                            className={`rounded border px-1 text-[8px] font-bold ${personalityStyle(pet.personality)}`}
                          >
                            {personalityLabel(pet.personality)}
                          </span>
                        )}
                      </span>
                    </div>
                    {pet.status !== "AVAILABLE" && (
                      <span
                        className={`shrink-0 text-[8px] font-black ${pet.status === "BANNED" ? "text-rose-300" : "text-cyan-300"}`}
                      >
                        {pet.status === "BANNED" ? "BANIDO" : "✓"}
                      </span>
                    )}
                  </div>
                  {pet.stats && (
                    <div className="mt-1.5 grid grid-cols-5 gap-0.5">
                      {(
                        [
                          ["FOR", pet.stats.force],
                          ["AGI", pet.stats.agility],
                          ["CAR", pet.stats.charisma],
                          ["INS", pet.stats.instinct],
                          ["VIT", pet.stats.vitality],
                        ] as const
                      ).map(([label, value]) => (
                        <span
                          key={label}
                          className="rounded bg-slate-950/60 py-0.5 text-center"
                        >
                          <b className="block text-[7px] uppercase leading-none text-slate-500">
                            {label}
                          </b>
                          <strong className="block text-[10px] leading-tight tabular-nums text-slate-100">
                            {value}
                          </strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // Time rival: só espécie, tipos e Mega (build continua secreta).
            <div className="grid grid-cols-3 gap-1.5">
              {panel.pets.map((pet) => (
                <div
                  key={pet.id}
                  className={`relative rounded-lg border p-2 text-center ${pet.status === "BANNED" ? "border-rose-400/40 bg-rose-950/30" : pet.status === "PICKED" ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-slate-950/40"}`}
                >
                  <img
                    src={pet.sprite}
                    alt=""
                    className={`mx-auto h-12 w-12 object-contain [image-rendering:pixelated] ${pet.status === "BANNED" ? "opacity-40 grayscale" : ""}`}
                  />
                  <span
                    className={`mt-1 block break-words text-[10px] font-bold leading-tight ${pet.status === "BANNED" ? "text-rose-300 line-through" : "text-white"}`}
                  >
                    {pet.name}
                  </span>
                  <span className="block truncate text-[8px] text-slate-500">
                    {pet.types.join(" · ")}
                  </span>
                  {pet.isMega && (
                    <span className="absolute left-1 top-1 rounded bg-fuchsia-500/20 px-1 text-[7px] font-black text-fuchsia-200">
                      M
                    </span>
                  )}
                  {pet.status === "PICKED" && (
                    <span className="absolute right-1 top-1 text-[9px] text-cyan-300">
                      ✓
                    </span>
                  )}
                  {pet.status === "BANNED" && (
                    <span className="absolute right-1 top-1 text-[8px] font-black text-rose-300">
                      ✕
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
function WaitingCard({ rival, phase }: { rival: string; phase: "BAN" | "PICK" }) {
  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-8 text-center">
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
      <p className="font-bold text-cyan-100">
        {rival} está {phase === "BAN" ? "banindo" : "escolhendo"}…
      </p>
      <p className="mt-1 text-xs text-slate-400">
        A tela será atualizada automaticamente quando a vez virar.
      </p>
    </div>
  );
}
// Grade de selecionar-e-confirmar. Ban confirma 1; o draft pode confirmar 2 de
// uma vez quando a serpentina dá dois picks seguidos.
function SelectionGrid({
  phase,
  pool,
  selected,
  required,
  onToggle,
  onConfirm,
  pending,
  deadlineAt,
}: {
  phase: "BAN" | "PICK";
  pool: Pet[];
  selected: string[];
  required: number;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  pending: boolean;
  deadlineAt: string | null;
}) {
  const [details, setDetails] = useState<string | null>(null);
  const ban = phase === "BAN";
  const done = selected.length === required;
  return (
    <section
      className={`rounded-2xl border p-4 pb-24 ${ban ? "border-rose-400/30 bg-rose-500/[.04]" : "border-amber-300/30 bg-amber-300/[.04]"}`}
    >
      <p className="text-center text-sm font-bold text-white">
        {ban
          ? "Escolha um mascote da equipe adversária para banir."
          : required > 1
            ? `Escolha ${required} mascotes da sua conta para a formação.`
            : "Escolha um mascote da sua conta para a formação."}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {pool.map((pet) => {
          const index = selected.indexOf(pet.id);
          const isSelected = index >= 0;
          return (
            <div key={pet.id} className="space-y-1">
              <button
                onClick={() => onToggle(pet.id)}
                className={`relative w-full rounded-xl border p-2 text-center transition ${isSelected ? (ban ? "border-rose-400 bg-rose-500/15" : "border-[#FFCB05] bg-[#FFCB05]/15") : "border-slate-800 bg-slate-950 hover:border-slate-600"}`}
              >
                {isSelected && required > 1 && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFCB05] text-[9px] font-black text-slate-950">
                    {index + 1}
                  </span>
                )}
                <img
                  src={pet.sprite}
                  alt=""
                  className="mx-auto h-14 w-14 object-contain [image-rendering:pixelated]"
                />
                <b className="block break-words text-[10px] font-bold leading-tight text-white">
                  {pet.name}
                </b>
                {/* Só o próprio time (fase de picks) revela postura/personalidade/status. */}
                {!ban && (
                  <>
                    <span className="mt-0.5 flex flex-wrap justify-center gap-1">
                      <span className="rounded border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-1 text-[7px] font-bold text-[#FFCB05]">
                        {ROLE_LABELS[pet.posture]}
                      </span>
                      {personalityLabel(pet.personality) && (
                        <span
                          className={`rounded border px-1 text-[7px] font-bold ${personalityStyle(pet.personality)}`}
                        >
                          {personalityLabel(pet.personality)}
                        </span>
                      )}
                    </span>
                    {pet.stats && (
                      <span className="mt-1 grid grid-cols-5 gap-0.5">
                        {(
                          [
                            ["F", pet.stats.force],
                            ["A", pet.stats.agility],
                            ["C", pet.stats.charisma],
                            ["I", pet.stats.instinct],
                            ["V", pet.stats.vitality],
                          ] as const
                        ).map(([label, value]) => (
                          <span
                            key={label}
                            className="rounded bg-slate-950/70 py-0.5 text-center text-[8px] tabular-nums text-slate-300"
                          >
                            <span className="text-slate-500">{label}</span>
                            {value}
                          </span>
                        ))}
                      </span>
                    )}
                  </>
                )}
                <span className="block truncate text-[8px] text-slate-500">
                  {pet.types.join(" · ")}
                  {pet.isMega && " · MEGA"}
                </span>
              </button>
              <button
                onClick={() => setDetails(details === pet.id ? null : pet.id)}
                className="w-full text-[8px] font-bold text-cyan-300"
              >
                {details === pet.id ? "ocultar tipos" : "ver vantagens"}
              </button>
              {details === pet.id && (
                <div className="rounded-lg bg-slate-950 p-2 text-left text-[8px] leading-relaxed">
                  <p className="text-emerald-300">
                    Forte: {pet.advantages.join(", ") || "—"}
                  </p>
                  <p className="text-rose-300">
                    Fraco: {pet.weaknesses.join(", ") || "—"}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Barra fixa: tempo + confirmar sempre visíveis, como na Torre dos Rebeldes. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/90 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          {deadlineAt && (
            <div className="flex shrink-0 flex-col items-center rounded-xl border border-cyan-300/25 bg-cyan-300/5 px-3 py-1.5">
              <span className="text-[8px] font-black uppercase tracking-widest text-cyan-300">
                Tempo
              </span>
              <span className="font-pixel text-lg text-[#FFCB05]">
                <Countdown deadlineAt={deadlineAt} />
              </span>
            </div>
          )}
          <span className="shrink-0 text-xs font-bold text-slate-300">
            {selected.length}/{required} selecionado{required > 1 ? "s" : ""}
          </span>
          <button
            disabled={pending || !done}
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-3 text-xs font-black disabled:opacity-40 ${ban ? "bg-rose-500 text-white" : "bg-[#FFCB05] text-slate-950"}`}
          >
            {pending
              ? "Enviando…"
              : ban
                ? "Confirmar ban"
                : required > 1
                  ? `Confirmar ${required} escolhas`
                  : "Confirmar escolha"}
          </button>
        </div>
      </div>
    </section>
  );
}
// Trilha de etapas compacta no cabeçalho.
function StepTrail({
  state,
  ownSide,
  progress,
}: {
  state: string;
  ownSide: string;
  progress: {
    readyA: boolean;
    readyB: boolean;
    bansA: number;
    bansB: number;
    picksA: number;
    picksB: number;
  };
}) {
  const ownReady = ownSide === "A" ? progress.readyA : progress.readyB;
  const rivalReady = ownSide === "A" ? progress.readyB : progress.readyA;
  const ownBans = ownSide === "A" ? progress.bansA : progress.bansB;
  const ownPicks = ownSide === "A" ? progress.picksA : progress.picksB;
  const steps = [
    {
      label: "Equipes",
      value: `${Number(ownReady) + Number(rivalReady)}/2`,
      done: state !== "TEAM_REVEAL",
    },
    { label: "Seus bans", value: `${ownBans}/3`, done: ownBans === 3 },
    { label: "Sua formação", value: `${ownPicks}/6`, done: ownPicks === 6 },
  ];
  return (
    <div className="mt-5 flex items-center gap-1">
      {steps.map((step, index) => (
        <div key={step.label} className="flex min-w-0 flex-1 items-center">
          <div className="min-w-0 flex-1 text-center">
            <div
              className={`mx-auto h-2 w-2 rounded-full ${step.done ? "bg-cyan-300 shadow-[0_0_12px_#67e8f9]" : "bg-slate-600"}`}
            />
            <b className="mt-1 block truncate text-[8px] uppercase text-slate-400">
              {step.label}
            </b>
            <span className="text-[10px] font-black text-white">
              {step.value}
            </span>
          </div>
          {index < steps.length - 1 && (
            <i
              className={`h-px w-4 sm:w-10 ${step.done ? "bg-cyan-300/60" : "bg-slate-700"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
function DraftActivity({
  activity,
  petById,
}: {
  activity: Array<{
    sequence: number;
    actor: string;
    type: string;
    targetId: string;
  }>;
  petById: Map<string, Pet>;
}) {
  return (
    <aside className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">
        Linha do draft
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {activity
          .filter((entry) => entry.type !== "READY")
          .map((entry) => {
            const pet = petById.get(entry.targetId);
            return (
              <div
                key={entry.sequence}
                className="flex min-w-44 items-center gap-2 rounded-xl bg-white/[.035] px-3 py-2"
              >
                {pet && (
                  <img
                    src={pet.sprite}
                    alt=""
                    className="h-9 w-9 object-contain"
                  />
                )}
                <span className="min-w-0 text-[9px] text-slate-400">
                  <b className="block truncate text-slate-200">{entry.actor}</b>
                  {entry.type === "BAN" ? "baniu" : "escolheu"}{" "}
                  <strong className="text-white">
                    {pet?.name ?? "mascote"}
                  </strong>
                </span>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
function Replay({
  battle,
  winnerName,
  playerNames,
  own,
  rival,
}: {
  battle: NonNullable<Battle>;
  winnerName: string | null;
  playerNames: { own: string; rival: string };
  own: Pet[];
  rival: Pet[];
}) {
  const events = battle.events ?? [];
  const involved = new Set<string>();
  events.forEach((event) => {
    if (event.actorId) involved.add(event.actorId);
    if (event.targetId) involved.add(event.targetId);
  });
  const leftPets = own.filter((pet) => involved.has(pet.id));
  const rightPets = rival.filter((pet) => involved.has(pet.id));
  // HP final (para marcar sobreviventes) e estatísticas por mascote.
  const finalHp = new Map<string, number>();
  [...leftPets, ...rightPets].forEach((pet) => finalHp.set(pet.id, pet.maxHp));
  events.forEach((event) => {
    if (event.targetId && event.targetHpAfter !== undefined)
      finalHp.set(event.targetId, event.targetHpAfter);
  });
  const statFor = (pet: Pet) => {
    const dealt = events
      .filter((event) => event.actorId === pet.id && event.action === "ATTACK")
      .reduce((sum, event) => sum + event.damage, 0);
    const received = events
      .filter((event) => event.targetId === pet.id && event.action === "ATTACK")
      .reduce((sum, event) => sum + event.damage, 0);
    const healing = events
      .filter((event) => event.actorId === pet.id && event.action === "HEAL")
      .reduce((sum, event) => sum + event.damage, 0);
    const kos = new Set(
      events
        .filter(
          (event) =>
            event.actorId === pet.id &&
            event.action === "ATTACK" &&
            event.targetHpAfter === 0,
        )
        .map((event) => event.targetId),
    ).size;
    return {
      pet,
      dealt,
      received,
      healing,
      kos,
      alive: (finalHp.get(pet.id) ?? pet.maxHp) > 0,
    };
  };
  const stats = [...leftPets, ...rightPets]
    .map(statFor)
    .sort((a, b) => b.kos - a.kos || b.dealt - a.dealt);
  const mvp = stats[0];
  return (
    <section className="space-y-4">
      {/* Banner do campeão */}
      <div className="overflow-hidden rounded-3xl border border-[#FFCB05]/30 bg-[radial-gradient(circle_at_top,rgba(255,203,5,.16),transparent_55%),#0a0a12] p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#FFCB05]/40 bg-[#FFCB05]/10 text-4xl">
          {winnerName ? "🏆" : "🤝"}
        </div>
        <p className="mt-3 text-[10px] font-black uppercase tracking-[.25em] text-[#FFCB05]/80">
          {winnerName ? "Campeão da partida" : "Resultado"}
        </p>
        <h2 className="mt-1 text-3xl font-black text-white">
          {winnerName ? winnerName : "Empate"}
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          {playerNames.own} × {playerNames.rival} · {battle.rounds ?? events.length} ações
        </p>
        {mvp && (
          <div className="mx-auto mt-4 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-2">
            <img
              src={mvp.pet.sprite}
              alt=""
              className="h-12 w-12 object-contain [image-rendering:pixelated]"
            />
            <div className="text-left">
              <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">
                Destaque da luta
              </p>
              <b className="text-sm text-white">{mvp.pet.name}</b>
              <p className="text-[10px] text-slate-400">
                {mvp.kos} KO · {mvp.dealt} de dano
              </p>
            </div>
          </div>
        )}
        <div className="mt-5">
          <Link
            href="/combates/arena-draft"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-xs font-black text-white hover:bg-white/15"
          >
            ← Voltar para a Arena Draft
          </Link>
        </div>
      </div>

      {/* Replay animado com controles locais */}
      {events.length > 0 && (
        <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
            Reprodução do combate
          </p>
          <div className="mt-3">
            <AnimatedBattle
              leftName={playerNames.own}
              rightName={playerNames.rival}
              leftPets={leftPets}
              rightPets={rightPets}
              events={events}
              controls
            />
          </div>
        </div>
      )}

      {/* Estatísticas de luta */}
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">
          Estatísticas por mascote
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="text-left">
                <th className="py-2">Mascote</th>
                <th className="text-center">KO</th>
                <th className="text-center">Dano</th>
                <th className="text-center">Recebido</th>
                <th className="text-center">Cura</th>
                <th className="text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(({ pet, dealt, received, healing, kos, alive }) => (
                <tr key={pet.id} className="border-t border-white/5">
                  <td className="flex items-center gap-2 py-2">
                    <img
                      src={pet.sprite}
                      alt=""
                      className="h-8 w-8 object-contain [image-rendering:pixelated]"
                    />
                    <span className="truncate font-bold text-white">
                      {pet.name}
                    </span>
                  </td>
                  <td className="text-center font-black text-amber-300">
                    {kos}
                  </td>
                  <td className="text-center text-rose-200">
                    {dealt.toLocaleString("pt-BR")}
                  </td>
                  <td className="text-center text-slate-400">
                    {received.toLocaleString("pt-BR")}
                  </td>
                  <td className="text-center text-emerald-300">
                    {healing.toLocaleString("pt-BR")}
                  </td>
                  <td className="text-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black ${alive ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}
                    >
                      {alive ? "Vivo" : "KO"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log completo, recolhido por padrão */}
      <details className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-cyan-200">
          Ver log completo ({events.length} eventos)
        </summary>
        <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-2">
          {events.map((event, index) => (
            <div
              key={`${event.turn}-${index}`}
              className="rounded-xl border border-white/5 bg-white/[.025] p-3"
            >
              <p className="text-[9px] font-bold uppercase text-slate-500">
                Evento {event.turn} · {event.action}
              </p>
              <p className="text-xs text-slate-200">
                <b>{event.actorName}</b> → {event.targetName} · {event.damage}{" "}
                {event.action === "HEAL" ? "HP" : "dano"}
              </p>
              {event.effect && (
                <p className="mt-1 text-[10px] text-fuchsia-200">
                  {event.effect}
                </p>
              )}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
