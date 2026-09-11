"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
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
type Pet = {
  id: string;
  speciesId: number;
  name: string;
  sprite: string;
  types: string[];
  advantages: string[];
  weaknesses: string[];
  isMega: boolean;
  status: "AVAILABLE" | "BANNED" | "PICKED";
  posture: Role;
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
  const [selected, setSelected] = useState<string | null>(null);
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
        // Presença/desconexão não precisa da mesma cadência do estado.
        if (ticks % 4 === 0) {
          const presence = await heartbeatArenaDraftAction(matchId);
          if (presence.active)
            setOpponentPresence({
              online: presence.opponentOnline,
              grace: presence.graceSeconds,
            });
          if (presence.resolved) {
            router.refresh();
            return;
          }
        }
        ticks += 1;
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
      } finally {
        busy = false;
      }
    };
    void tick();
    const poll = window.setInterval(tick, 1800);
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
  const act = (id: string) =>
    start(async () => {
      const r = await submitArenaDraftAction(matchId, id, crypto.randomUUID());
      r.error ? toast.error(r.error) : toast.success(r.success);
      setSelected(null);
      router.refresh();
    });
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
    setSelected(null);
  }, [turn, state]);

  const pool =
    banning
      ? rival.filter((p) => p.status === "AVAILABLE")
      : picking
        ? own.filter((p) => p.status === "AVAILABLE")
        : [];

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
                onSelect={setSelected}
                onConfirm={() => selected && act(selected)}
                pending={pending}
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
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-950/80 p-5">
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
          return (
            <article
              key={p.id}
              className={`rounded-2xl border p-3 ${selected ? "border-cyan-300/60 bg-cyan-300/10" : "border-white/10 bg-white/[.02]"} ${dead ? "opacity-40" : ""}`}
            >
              <button
                disabled={dead || strategy.ownConfirmed}
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-3 text-left"
              >
                <img
                  src={p.sprite}
                  alt=""
                  className="h-14 w-14 object-contain"
                />
                <span className="min-w-0">
                  <b className="block truncate text-sm text-white">{p.name}</b>
                  <small className="text-slate-400">
                    {dead ? "Derrotado" : selected ? "Em campo" : "Banco"} ·{" "}
                    {p.hp ?? "—"} HP
                  </small>
                </span>
              </button>
              <select
                disabled={dead || strategy.ownConfirmed}
                value={postures[p.id]}
                onChange={(e) =>
                  setPostures((v) => ({ ...v, [p.id]: e.target.value as Role }))
                }
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-2 text-[10px] text-white"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
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
      <button
        disabled={pending || strategy.ownConfirmed || active.length !== 6}
        onClick={submit}
        className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-40"
      >
        {strategy.ownConfirmed
          ? "Estratégia confirmada · aguardando rival"
          : "Travar estratégia em segredo"}
      </button>
    </section>
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
  const previousCheckpoint =
    checkpoint === 35 ? 20 : checkpoint === 45 ? 35 : 0;
  const segment =
    battle?.events?.filter(
      (event) =>
        event.turn > previousCheckpoint &&
        (checkpoint === null || event.turn <= checkpoint),
    ) ?? [];
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
            Segmento encerrado · ações {previousCheckpoint + 1}–{checkpoint}
          </p>
          <h2 className="mt-1 text-lg font-black text-white">
            A arena aguarda suas decisões
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
      <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Formation name={playerNames.own} pets={own} />
        <span className="text-center text-sm font-black text-fuchsia-300">
          VS
        </span>
        <Formation name={playerNames.rival} pets={rival} rival />
      </div>
      {segment.some((event) => event.targetHpAfter === 0 || event.effect) && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {segment
            .filter((event) => event.targetHpAfter === 0 || event.effect)
            .slice(-6)
            .map((event, index) => (
              <div
                key={`${event.turn}-${index}`}
                className={`min-w-52 rounded-xl border px-3 py-2 text-[9px] ${event.targetHpAfter === 0 ? "border-rose-400/25 bg-rose-400/5" : "border-fuchsia-300/20 bg-fuchsia-300/5"}`}
              >
                <b className="text-white">
                  T{event.turn} · {event.actorName}
                </b>
                <span className="block text-slate-400">
                  {event.targetHpAfter === 0
                    ? `${event.targetName} sofreu KO`
                    : event.effect}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
function Formation({
  name,
  pets,
  rival = false,
}: {
  name: string;
  pets: Pet[];
  rival?: boolean;
}) {
  return (
    <div className={rival ? "sm:text-right" : ""}>
      <b className="text-[10px] text-slate-300">{name}</b>
      <div
        className={`mt-2 flex flex-wrap gap-2 ${rival ? "sm:justify-end" : ""}`}
      >
        {pets.map((pet) => {
          const hp = pet.hp ?? pet.maxHp;
          const percent = Math.max(0, Math.min(100, (hp / pet.maxHp) * 100));
          return (
            <div
              key={pet.id}
              className={`w-16 rounded-xl border border-white/10 bg-slate-950/70 p-1.5 ${hp <= 0 ? "grayscale opacity-35" : ""}`}
            >
              <img
                src={pet.sprite}
                alt=""
                className="mx-auto h-9 w-9 object-contain"
              />
              <span className="block truncate text-center text-[7px] font-bold text-white">
                {pet.name}
              </span>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full ${percent > 50 ? "bg-emerald-300" : percent > 20 ? "bg-amber-300" : "bg-rose-400"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="mt-0.5 block text-center text-[6px] text-slate-500">
                {Math.max(0, hp)} HP
              </span>
            </div>
          );
        })}
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
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {panel.pets.map((pet) => (
              <div
                key={pet.id}
                className={`relative rounded-lg border p-1 text-center ${pet.status === "BANNED" ? "border-rose-400/40 bg-rose-950/30" : pet.status === "PICKED" ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-slate-950/40"}`}
              >
                <img
                  src={pet.sprite}
                  alt=""
                  className={`mx-auto h-9 w-9 object-contain ${pet.status === "BANNED" ? "opacity-40 grayscale" : ""}`}
                />
                <span
                  className={`block truncate text-[7px] font-bold ${pet.status === "BANNED" ? "text-rose-300 line-through" : "text-white"}`}
                >
                  {pet.name}
                </span>
                {pet.isMega && (
                  <span className="absolute left-0.5 top-0.5 text-[7px] font-black text-amber-300">
                    M
                  </span>
                )}
                {pet.status === "PICKED" && (
                  <span className="absolute right-0.5 top-0.5 text-[8px]">
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>
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
// Grade de selecionar-e-confirmar (um alvo por vez), no estilo do pré-jogo online.
function SelectionGrid({
  phase,
  pool,
  selected,
  onSelect,
  onConfirm,
  pending,
}: {
  phase: "BAN" | "PICK";
  pool: Pet[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const [details, setDetails] = useState<string | null>(null);
  const ban = phase === "BAN";
  return (
    <section
      className={`rounded-2xl border p-4 ${ban ? "border-rose-400/30 bg-rose-500/[.04]" : "border-amber-300/30 bg-amber-300/[.04]"}`}
    >
      <p className="text-center text-sm font-bold text-white">
        {ban
          ? "Escolha um mascote da equipe adversária para banir."
          : "Escolha um mascote da sua conta para a formação."}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {pool.map((pet) => {
          const isSelected = selected === pet.id;
          return (
            <div key={pet.id} className="space-y-1">
              <button
                onClick={() => onSelect(isSelected ? null : pet.id)}
                className={`w-full rounded-xl border p-2 text-center transition ${isSelected ? (ban ? "border-rose-400 bg-rose-500/15" : "border-[#FFCB05] bg-[#FFCB05]/15") : "border-slate-800 bg-slate-950 hover:border-slate-600"}`}
              >
                <img
                  src={pet.sprite}
                  alt=""
                  className="mx-auto h-14 w-14 object-contain [image-rendering:pixelated]"
                />
                <b className="block truncate text-[10px] text-white">
                  {pet.name}
                </b>
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
      <button
        disabled={pending || !selected}
        onClick={onConfirm}
        className={`mt-4 w-full rounded-xl px-4 py-3 text-xs font-black disabled:opacity-40 ${ban ? "bg-rose-500 text-white" : "bg-[#FFCB05] text-slate-950"}`}
      >
        {pending
          ? "Enviando…"
          : ban
            ? "Confirmar ban"
            : "Confirmar escolha"}
      </button>
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
}: {
  battle: NonNullable<Battle>;
  winnerName: string | null;
  playerNames: { own: string; rival: string };
}) {
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
            Replay por eventos
          </p>
          <h2 className="text-2xl font-black text-white">
            {winnerName ? `Vitória de ${winnerName}` : "Empate"}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {playerNames.own} × {playerNames.rival}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          {battle.rounds} ações registradas
        </p>
      </div>
      <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-2">
        {battle.events?.map((event, index) => (
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
    </section>
  );
}
