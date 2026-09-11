"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  resolveArenaDraftBattleAction,
  advanceArenaDraftTimeoutAction,
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
  isMega: boolean;
  disabled: boolean;
  posture: Role;
  hp: number | null;
};
type Battle = {
  result?: string;
  rounds?: number;
  events?: Array<{
    turn: number;
    actorName: string;
    targetName: string;
    action: string;
    damage: number;
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
  own,
  rival,
  battle,
  strategy,
}: {
  matchId: string;
  state: string;
  turn: string;
  ownSide: string;
  own: Pet[];
  rival: Pet[];
  battle: Battle;
  strategy: Strategy;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    if (["FINISHED", "CANCELLED"].includes(state)) return;
    const timer = window.setInterval(async () => {
      if (state === "STRATEGY_WINDOW")
        await advanceArenaDraftTimeoutAction(matchId);
      router.refresh();
    }, 6000);
    return () => window.clearInterval(timer);
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
  const reveal = state === "TEAM_REVEAL",
    banning = state === "BAN_PHASE",
    picking = state === "PICK_PHASE";
  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top,rgba(168,85,247,.2),transparent_45%),#050916] p-6">
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">
          Arena Draft · sala sincronizada
        </p>
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
            : `Estado ${state} · ${turn ? `vez do lado ${turn}` : "aguarde o servidor"}`}
        </p>
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
        <StrategyWindow matchId={matchId} pets={own} strategy={strategy} />
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
        </div>
      )}
      {state === "BATTLE_INIT" && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 text-center">
          <b className="text-amber-200">Draft concluído</b>
          <p className="mt-2 text-sm text-slate-400">
            Seis entram em campo e os três restantes formam o banco. O combate
            pausa nos turnos 20, 35 e 45.
          </p>
          <button
            disabled={pending}
            onClick={fight}
            className="mt-4 rounded-xl bg-amber-300 px-5 py-3 text-xs font-black text-slate-950"
          >
            Iniciar combate automático
          </button>
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
}: {
  matchId: string;
  pets: Pet[];
  strategy: NonNullable<Strategy>;
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
  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <h2 className="font-black text-white">{title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {pets.map((p) => (
          <article
            key={p.id}
            className={`rounded-xl border p-3 text-center ${p.disabled ? "border-rose-400/20 bg-rose-950/20 opacity-40" : "border-white/10"}`}
          >
            <img
              src={p.sprite}
              alt=""
              className="mx-auto h-16 w-16 object-contain"
            />
            <b className="block truncate text-xs text-white">{p.name}</b>
            <p className="text-[9px] text-slate-500">
              {p.types.join(" · ")} {p.isMega && "· MEGA"}
            </p>
            {actionable && !p.disabled && (
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
