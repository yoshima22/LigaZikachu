"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  closeLivePvpMatchAction,
  getLivePvpMatchAction,
  initializeLivePvpBattleAction,
  submitLivePvpBattleAction,
  submitLivePvpFormationAction,
  surrenderLivePvpBattleAction,
  type LivePvpBattleAction,
  type LivePvpMatchValue,
  type TacticalFormation,
  type TacticalUnit,
} from "../../combates/arena-online/matchmaking-actions";
import {
  COMBAT_ROLE_LABELS,
  COMBAT_ROLE_VALUES,
  type CombatRole,
} from "@/lib/combat-roles";

const FORMATIONS: Array<{
  id: TacticalFormation;
  name: string;
  detail: string;
}> = [
  {
    id: "WALL",
    name: "Muralha",
    detail: "Seis mascotes próximos da linha de frente.",
  },
  {
    id: "WEDGE",
    name: "Cunha",
    detail: "Dois na frente, dois no meio e dois atrás.",
  },
  {
    id: "SPLIT",
    name: "Dividida",
    detail: "Pressão separada pelas partes superior e inferior.",
  },
];
const ACTIONS: Array<{ id: LivePvpBattleAction["type"]; label: string }> = [
  { id: "AUTO", label: "Automático" },
  { id: "ATTACK", label: "Atacar" },
  { id: "DEFEND", label: "Defender" },
  { id: "WAIT", label: "Aguardar" },
];

function fallback(
  event: React.SyntheticEvent<HTMLImageElement>,
  pokemonId: number,
) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

export function ArenaOnlineSyncedBattle({
  identity,
}: {
  identity: { playerId: string; playerName: string };
}) {
  const [match, setMatch] = useState<LivePvpMatchValue | null>(null);
  const [formation, setFormation] = useState<TacticalFormation>("WEDGE");
  const [roles, setRoles] = useState<Record<string, CombatRole>>({});
  const [orders, setOrders] = useState<Record<string, LivePvpBattleAction>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [pending, startTransition] = useTransition();
  const refreshing = useRef(false),
    timeoutKey = useRef("");

  const refresh = async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const state = await getLivePvpMatchAction(false);
      setMatch(state.match);
      if (!state.match.battle) {
        await initializeLivePvpBattleAction();
        setMatch((await getLivePvpMatchAction(false)).match);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Partida indisponível.",
      );
    } finally {
      refreshing.current = false;
    }
  };
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 1500);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const deadline = match?.battle?.deadline;
    if (!deadline) return;
    const update = () =>
      setSeconds(
        Math.max(
          0,
          Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000),
        ),
      );
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [match?.battle?.deadline]);

  const battle = match?.battle;
  const sideA = !!match && identity.playerId === match.playerAId;
  const mine = battle ? (sideA ? battle.teamA : battle.teamB) : [];
  const ownPending = battle
    ? sideA
      ? battle.pendingA
      : battle.pendingB
    : null;
  const formationLocked = battle
    ? sideA
      ? battle.formationA
      : battle.formationB
    : null;
  useEffect(() => {
    if (
      !battle ||
      seconds > 0 ||
      battle.winnerId ||
      ownPending ||
      (battle.phase === "FORMATION" && formationLocked)
    )
      return;
    const key = `${battle.phase}:${battle.round}:${battle.deadline}:${identity.playerId}`;
    if (timeoutKey.current === key) return;
    timeoutKey.current = key;
    if (battle.phase === "FORMATION")
      void submitLivePvpFormationAction(
        "WEDGE",
        Object.fromEntries(
          mine.map((unit) => [unit.id, roles[unit.id] ?? unit.role]),
        ),
      ).then(refresh);
    else if (battle.phase === "PLANNING")
      void submitLivePvpBattleAction(
        mine
          .filter((unit) => unit.hp > 0)
          .map((unit) => ({ type: "AUTO", mascotId: unit.id })),
      ).then(refresh);
  }, [seconds, battle?.phase, battle?.round, battle?.deadline, ownPending]);

  const run = (action: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await action();
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ação recusada.");
        await refresh();
      }
    });
  const selected = mine.find((unit) => unit.id === selectedId) ?? null;
  const lastByUnit = useMemo(
    () =>
      new Map((battle?.lastEvents ?? []).map((event) => [event.unitId, event])),
    [battle?.lastEvents],
  );

  if (!match || !battle)
    return (
      <div className="rounded-xl border border-cyan-500/30 p-10 text-center text-cyan-200">
        Preparando a Arena Tática...
      </div>
    );

  if (battle.phase === "FORMATION")
    return (
      <section className="space-y-5 rounded-2xl border border-purple-500/35 bg-purple-500/5 p-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-purple-300">
              Arena Tática · formação secreta
            </p>
            <h2 className="text-lg font-black text-white">
              Escolha a formação e as posturas
            </h2>
          </div>
          <b className="font-pixel text-xl text-[#FFCB05]">{seconds}s</b>
        </header>
        {formationLocked ? (
          <div className="rounded-xl border border-cyan-500/30 p-10 text-center text-cyan-100">
            Formação confirmada. Aguardando o adversário.
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              {FORMATIONS.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setFormation(entry.id)}
                  className={`rounded-xl border p-4 text-left ${formation === entry.id ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950"}`}
                >
                  <b className="text-white">{entry.name}</b>
                  <p className="mt-1 text-xs text-slate-400">{entry.detail}</p>
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {mine.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-xl border border-cyan-500/20 bg-slate-950 p-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={unit.spriteUrl}
                      onError={(event) => fallback(event, unit.pokemonId)}
                      className="h-14 w-14 object-contain"
                      alt=""
                    />
                    <div>
                      <b className="text-white">{unit.name}</b>
                      <p className="text-[10px] text-slate-500">
                        FOR {unit.force} · AGI {unit.agility} · VIT{" "}
                        {unit.vitality}
                      </p>
                    </div>
                  </div>
                  <select
                    value={roles[unit.id] ?? unit.role}
                    onChange={(event) =>
                      setRoles((old) => ({
                        ...old,
                        [unit.id]: event.target.value as CombatRole,
                      }))
                    }
                    className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                  >
                    {COMBAT_ROLE_VALUES.map((role) => (
                      <option key={role} value={role}>
                        {COMBAT_ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              disabled={pending}
              onClick={() =>
                run(() =>
                  submitLivePvpFormationAction(
                    formation,
                    Object.fromEntries(
                      mine.map((unit) => [
                        unit.id,
                        roles[unit.id] ?? unit.role,
                      ]),
                    ),
                  ),
                )
              }
              className="w-full rounded-xl bg-[#FFCB05] px-4 py-3 font-black text-slate-950"
            >
              Confirmar formação secreta
            </button>
          </>
        )}
      </section>
    );

  const all = [...battle.teamA, ...battle.teamB];
  const cell = (x: number, y: number) =>
    all.find((unit) => unit.hp > 0 && unit.x === x && unit.y === y);
  const chooseCell = (x: number, y: number) => {
    if (!selected || ownPending) return;
    setOrders((old) => ({
      ...old,
      [selected.id]: {
        ...(old[selected.id] ?? { type: "AUTO", mascotId: selected.id }),
        x,
        y,
      },
    }));
  };
  const surrendered = async () => {
    await surrenderLivePvpBattleAction();
    await refresh();
  };
  return (
    <section className="space-y-4 rounded-2xl border border-cyan-500/30 bg-slate-950/60 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-cyan-300">
            Arena Online Tática · protótipo 1
          </p>
          <h2 className="font-black text-white">
            Rodada {battle.round} · {match.playerAName} × {match.playerBName}
          </h2>
        </div>
        {battle.phase !== "FINISHED" && (
          <b className="font-pixel text-xl text-[#FFCB05]">{seconds}s</b>
        )}
      </header>
      <div className="overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-12 gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2">
          {Array.from({ length: 8 }, (_, y) =>
            Array.from({ length: 12 }, (_, x) => {
              const unit = cell(x, y),
                owned = !!unit && mine.some((entry) => entry.id === unit.id),
                selectedUnit = unit?.id === selectedId,
                event = unit ? lastByUnit.get(unit.id) : null;
              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  onClick={() =>
                    unit && owned ? setSelectedId(unit.id) : chooseCell(x, y)
                  }
                  className={`relative aspect-square min-h-16 rounded border text-[9px] ${selectedUnit ? "border-[#FFCB05] bg-[#FFCB05]/15" : owned ? "border-cyan-500/50 bg-cyan-500/10" : unit ? "border-red-500/40 bg-red-500/10" : "border-slate-800 bg-slate-950/70 hover:bg-slate-800"}`}
                >
                  {unit && (
                    <>
                      <img
                        src={unit.spriteUrl}
                        loading="lazy"
                        onError={(e) => fallback(e, unit.pokemonId)}
                        className="mx-auto h-9 w-9 object-contain"
                        alt=""
                      />
                      <b className="block truncate px-1 text-white">
                        {unit.name}
                      </b>
                      <span className="text-slate-400">
                        {COMBAT_ROLE_LABELS[unit.role]}
                      </span>
                      <div className="mx-1 mt-1 h-1 rounded bg-slate-800">
                        <div
                          className="h-full rounded bg-emerald-400"
                          style={{ width: `${(100 * unit.hp) / unit.maxHp}%` }}
                        />
                      </div>
                      {event && (
                        <span className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 rounded bg-[#FFCB05] px-1 text-[8px] font-black text-slate-950">
                          {event.kind}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            }),
          ).flat()}
        </div>
      </div>
      {battle.phase === "PLANNING" && !ownPending && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4">
            {selected ? (
              <>
                <div className="flex items-center gap-3">
                  <img
                    src={selected.spriteUrl}
                    className="h-16 w-16 object-contain"
                    alt=""
                  />
                  <div>
                    <b className="text-white">{selected.name}</b>
                    <p className="text-xs text-cyan-200">
                      {COMBAT_ROLE_LABELS[selected.role]} · HP {selected.hp}/
                      {selected.maxHp}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Clique em uma célula para definir o destino. A distância
                  válida depende da Agilidade.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() =>
                        setOrders((old) => ({
                          ...old,
                          [selected.id]: {
                            ...(old[selected.id] ?? { mascotId: selected.id }),
                            type: action.id,
                            mascotId: selected.id,
                          },
                        }))
                      }
                      className={`rounded-lg border p-2 text-xs ${orders[selected.id]?.type === action.id ? "border-[#FFCB05] bg-[#FFCB05]/10 text-[#FFCB05]" : "border-slate-700 text-slate-300"}`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">
                Selecione um dos seus mascotes no grid.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-slate-800 p-4">
            <p className="mb-3 text-xs font-bold uppercase text-slate-400">
              Ordens da equipe
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {mine
                .filter((unit) => unit.hp > 0)
                .map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => setSelectedId(unit.id)}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2 text-left text-xs"
                  >
                    <span className="text-white">{unit.name}</span>
                    <b className="text-cyan-300">
                      {orders[unit.id]?.type ?? "AUTO"}
                    </b>
                  </button>
                ))}
            </div>
            <button
              disabled={pending}
              onClick={() =>
                run(() =>
                  submitLivePvpBattleAction(
                    mine
                      .filter((unit) => unit.hp > 0)
                      .map(
                        (unit) =>
                          orders[unit.id] ?? {
                            type: "AUTO",
                            mascotId: unit.id,
                          },
                      ),
                  ),
                )
              }
              className="mt-4 w-full rounded-xl bg-[#FFCB05] px-4 py-3 font-black text-slate-950"
            >
              Confirmar todas as ordens
            </button>
          </div>
        </div>
      )}
      {battle.phase === "PLANNING" && ownPending && (
        <div className="rounded-xl border border-cyan-500/25 p-6 text-center text-cyan-100">
          Ordens confirmadas. O adversário ainda está planejando.
        </div>
      )}
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3">
        {battle.logs.slice(-30).map((log, index) => (
          <p
            key={`${index}-${log}`}
            className="rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
          >
            {log}
          </p>
        ))}
      </div>
      {battle.phase !== "FINISHED" ? (
        <button
          disabled={pending}
          onClick={() => run(surrendered)}
          className="w-full rounded-lg border border-red-500/40 bg-red-500/10 p-3 font-bold text-red-300"
        >
          Desistir
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-lg font-black text-[#FFCB05]">
            {battle.winnerId
              ? `${battle.winnerId === match.playerAId ? match.playerAName : match.playerBName} venceu!`
              : "Empate!"}
          </p>
          <button
            onClick={() =>
              run(async () => {
                await closeLivePvpMatchAction();
                window.location.href = "/combates/arena-online";
              })
            }
            className="w-full rounded-xl bg-cyan-500 p-3 font-black text-slate-950"
          >
            Voltar ao lobby
          </button>
        </div>
      )}
    </section>
  );
}
