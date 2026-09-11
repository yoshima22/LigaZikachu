"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import {
  resolveArenaDraftBattleAction,
  advanceArenaDraftTimeoutAction,
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
} | null;
type Strategy = {
  activeIds: string[];
  ownConfirmed: boolean;
  rivalConfirmed: boolean;
  checkpointTurn: number | null;
  deadlineAt: string | null;
} | null;
export function DraftRoomClient({
  matchId,
  state,
  turn,
  ownSide,
  playerNames,
  deadlineAt,
  progress,
  activity,
  own,
  rival,
  battle,
  strategy,
}: {
  matchId: string;
  state: string;
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
    const pulse = async () => {
      const presence = await heartbeatArenaDraftAction(matchId);
      if (presence.active)
        setOpponentPresence({
          online: presence.opponentOnline,
          grace: presence.graceSeconds,
        });
      if (presence.resolved) router.refresh();
    };
    void pulse();
    const fallback = window.setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      await pulse();
      await advanceArenaDraftTimeoutAction(matchId);
      router.refresh();
    }, 30000);
    return () => {
      window.clearInterval(fallback);
      cleanup();
    };
  }, [matchId, router, state]);
  const act = (id: string) =>
    start(async () => {
      const r = await submitArenaDraftAction(matchId, id, crypto.randomUUID());
      r.error ? toast.error(r.error) : toast.success(r.success);
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
  }, [state]);
  const reveal = state === "TEAM_REVEAL",
    banning = state === "BAN_PHASE",
    picking = state === "PICK_PHASE";
  const isMyTurn = turn === ownSide;
  const petById = new Map([...own, ...rival].map((pet) => [pet.id, pet]));
  const stateLabel: Record<string, string> = {
    TEAM_REVEAL: "Apresentação",
    BAN_PHASE: "Bans",
    PICK_PHASE: "Draft",
    BATTLE_INIT: "Preparação",
    STRATEGY_WINDOW: "Combate",
    FINISHED: "Resultado",
    CANCELLED: "Cancelada",
  };
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top,rgba(168,85,247,.2),transparent_45%),#050916] p-6">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">
          Arena Draft · sala sincronizada
        </p>
        <span
          className={`mt-2 inline-flex items-center gap-1 text-[9px] font-bold ${connection === "live" ? "text-emerald-300" : connection === "fallback" ? "text-amber-300" : "text-slate-500"}`}
        >
          <i
            className={`h-1.5 w-1.5 rounded-full ${connection === "live" ? "bg-emerald-300" : "bg-amber-300"}`}
          />
          {connection === "live"
            ? "Conexão ao vivo"
            : connection === "fallback"
              ? "Reconexão econômica"
              : "Conectando…"}
        </span>
        {opponentPresence && !opponentPresence.online && (
          <span className="ml-3 inline-flex rounded-full bg-amber-300/10 px-2 py-1 text-[9px] font-bold text-amber-200">
            Adversário reconectando · até {opponentPresence.grace ?? 90}s
          </span>
        )}
        <h1 className="mt-2 text-3xl font-black text-white">
          {reveal
            ? "Inspeção das equipes"
            : banning
              ? "Fase de bans"
              : picking
                ? "Picks progressivos"
                : state === "STRATEGY_WINDOW"
                  ? `Janela estratégica · T${strategy?.checkpointTurn}`
                  : state === "FINISHED"
                    ? "Partida finalizada"
                    : "Preparando combate"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {state === "STRATEGY_WINDOW"
            ? "Formação e posturas ficam secretas até os dois confirmarem."
            : banning || picking
              ? isMyTurn
                ? "Sua vez — escolha destacada e confirme antes do cronômetro acabar."
                : `Vez de ${playerNames.rival} — acompanhe a escolha em tempo real.`
              : `Etapa: ${stateLabel[state] ?? state}`}
        </p>
        {(reveal || banning || picking) && (
          <DraftProgress
            state={state}
            ownSide={ownSide}
            progress={progress}
            deadlineAt={deadlineAt}
          />
        )}
        {reveal && (
          <button
            disabled={pending}
            onClick={() => act("reveal")}
            className="mt-4 rounded-xl bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950"
          >
            Estou pronto para o draft
          </button>
        )}
      </header>
      {state === "STRATEGY_WINDOW" && strategy ? (
        <StrategyWindow
          matchId={matchId}
          pets={own}
          strategy={strategy}
          battle={battle}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Team
            title="Sua equipe"
            pets={own}
            actionable={picking && turn === ownSide}
            action="Escolher"
            onAction={act}
          />
          <Team
            title="Equipe adversária"
            pets={rival}
            actionable={banning && turn === ownSide}
            action="Banir"
            onAction={act}
          />
          {(banning || picking) && activity.length > 0 && (
            <DraftActivity activity={activity} petById={petById} />
          )}
        </div>
      )}
      {state === "BATTLE_INIT" && (
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
      )}
      {state === "FINISHED" && battle && <Replay battle={battle} />}
    </div>
  );
}
function StrategyWindow({
  matchId,
  pets,
  strategy,
  battle,
}: {
  matchId: string;
  pets: Pet[];
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
      1000,
    );
    return () => window.clearInterval(timer);
  }, [deadlineAt]);
  return (
    <span className="text-cyan-200">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}
function Team({
  title,
  pets,
  actionable,
  action,
  onAction,
}: {
  title: string;
  pets: Pet[];
  actionable: boolean;
  action: string;
  onAction: (id: string) => void;
}) {
  const [typeDetails, setTypeDetails] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <h2 className="font-black text-white">{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {pets.map((p) => (
          <article
            key={p.id}
            className={`relative rounded-xl border p-3 text-center ${p.status === "BANNED" ? "border-rose-400/30 bg-rose-950/30 opacity-55" : p.status === "PICKED" ? "border-cyan-300/45 bg-cyan-300/10" : "border-white/10"}`}
          >
            {p.status !== "AVAILABLE" && (
              <span
                className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[8px] font-black ${p.status === "BANNED" ? "bg-rose-500/20 text-rose-200" : "bg-cyan-300/15 text-cyan-200"}`}
              >
                {p.status === "BANNED" ? "BANIDO" : "ESCOLHIDO"}
              </span>
            )}
            <img
              src={p.sprite}
              alt=""
              className="mx-auto h-16 w-16 object-contain"
            />
            <b className="block truncate text-xs text-white">{p.name}</b>
            <p className="text-[9px] text-slate-500">
              {p.types.join(" · ")} {p.isMega && "· MEGA"}
            </p>
            <button
              onClick={() => setTypeDetails(typeDetails === p.id ? null : p.id)}
              className="mt-1 text-[9px] font-bold text-cyan-300"
            >
              {typeDetails === p.id ? "Ocultar tipos" : "Ver vantagens"}
            </button>
            {typeDetails === p.id && (
              <div className="mt-2 rounded-lg bg-slate-950 p-2 text-left text-[8px]">
                <p className="text-emerald-300">
                  Vantagem: {p.advantages.join(", ") || "—"}
                </p>
                <p className="mt-1 text-rose-300">
                  Fraqueza: {p.weaknesses.join(", ") || "—"}
                </p>
              </div>
            )}
            {actionable && p.status === "AVAILABLE" && (
              <button
                onClick={() => onAction(p.id)}
                className="mt-2 w-full rounded-lg bg-fuchsia-500 px-2 py-2 text-[10px] font-bold text-white"
              >
                {action}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
function DraftProgress({
  state,
  ownSide,
  progress,
  deadlineAt,
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
  deadlineAt: string | null;
}) {
  const ownReady = ownSide === "A" ? progress.readyA : progress.readyB;
  const rivalReady = ownSide === "A" ? progress.readyB : progress.readyA;
  const ownBans = ownSide === "A" ? progress.bansA : progress.bansB;
  const rivalBans = ownSide === "A" ? progress.bansB : progress.bansA;
  const ownPicks = ownSide === "A" ? progress.picksA : progress.picksB;
  const rivalPicks = ownSide === "A" ? progress.picksB : progress.picksA;
  const steps = [
    {
      label: "Equipes",
      value: `${Number(ownReady) + Number(rivalReady)}/2`,
      done: state !== "TEAM_REVEAL",
    },
    { label: "Seus bans", value: `${ownBans}/3`, done: ownBans === 3 },
    { label: "Bans rivais", value: `${rivalBans}/3`, done: rivalBans === 3 },
    { label: "Sua formação", value: `${ownPicks}/6`, done: ownPicks === 6 },
    {
      label: "Formação rival",
      value: `${rivalPicks}/6`,
      done: rivalPicks === 6,
    },
  ];
  return (
    <div className="mt-5 rounded-2xl bg-slate-950/65 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-1">
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
                  className={`h-px w-3 sm:w-7 ${step.done ? "bg-cyan-300/60" : "bg-slate-700"}`}
                />
              )}
            </div>
          ))}
        </div>
        {deadlineAt && (
          <span className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs font-black text-cyan-200">
            <Countdown deadlineAt={deadlineAt} />
          </span>
        )}
      </div>
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
    <aside className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
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
function Replay({ battle }: { battle: NonNullable<Battle> }) {
  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">
            Replay por eventos
          </p>
          <h2 className="text-2xl font-black text-white">
            {battle.result === "ATTACKER_WIN"
              ? "Vitória do lado A"
              : battle.result === "DEFENDER_WIN"
                ? "Vitória do lado B"
                : "Empate"}
          </h2>
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
