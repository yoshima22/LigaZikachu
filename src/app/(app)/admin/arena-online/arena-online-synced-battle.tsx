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
const FORMATION_SLOTS: Record<TacticalFormation, Array<[number, number]>> = {
  WALL: [
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 4],
    [2, 5],
    [2, 6],
  ],
  WEDGE: [
    [2, 2],
    [2, 5],
    [1, 1],
    [1, 6],
    [0, 2],
    [0, 5],
  ],
  SPLIT: [
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 5],
    [1, 6],
    [0, 7],
  ],
};
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
  const [placement, setPlacement] = useState<string[]>([]);
  const [placementSelected, setPlacementSelected] = useState<string | null>(
    null,
  );
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
  const isMyTurn = !!battle && battle.turnPlayerId === identity.playerId;
  useEffect(() => {
    setOrders({});
    setSelectedId(null);
  }, [battle?.round]);
  useEffect(() => {
    if (battle?.phase === "FORMATION" && mine.length && placement.length === 0)
      setPlacement(mine.map((unit) => unit.id));
  }, [battle?.phase, mine.length, placement.length]);
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
        placement.length === mine.length
          ? placement
          : mine.map((unit) => unit.id),
      ).then(refresh);
    else if (battle.phase === "PLANNING" && isMyTurn)
      void submitLivePvpBattleAction(
        mine
          .filter((unit) => unit.hp > 0)
          .map((unit) => ({ type: "AUTO", mascotId: unit.id })),
      ).then(refresh);
  }, [
    seconds,
    battle?.phase,
    battle?.round,
    battle?.deadline,
    ownPending,
    isMyTurn,
    formationLocked,
  ]);

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
  const assignPlacementSlot = (slot: number) => {
    if (!placementSelected) return;
    setPlacement((current) => {
      const next =
        current.length === mine.length
          ? [...current]
          : mine.map((unit) => unit.id);
      const from = next.indexOf(placementSelected);
      if (from < 0) return next;
      [next[from], next[slot]] = [next[slot], next[from]];
      return next;
    });
    setPlacementSelected(null);
  };

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
            <div className="rounded-xl border border-purple-500/25 bg-slate-950/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <b className="text-sm text-white">Posições iniciais</b>
                  <p className="text-xs text-slate-400">
                    Clique em um mascote abaixo e depois no espaço da formação
                    onde ele deve começar.
                  </p>
                </div>
                {placementSelected && (
                  <span className="rounded-full bg-[#FFCB05] px-3 py-1 text-[10px] font-black text-slate-950">
                    Escolhendo posição de{" "}
                    {mine.find((unit) => unit.id === placementSelected)?.name}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {FORMATION_SLOTS[formation].map(([x, y], slot) => {
                  const unit = mine.find(
                    (entry) => entry.id === placement[slot],
                  );
                  const displayX = sideA ? x : 11 - x;
                  return (
                    <button
                      key={`${formation}-${slot}`}
                      type="button"
                      onClick={() => assignPlacementSlot(slot)}
                      className={`min-h-20 rounded-xl border p-2 text-center ${placementSelected ? "border-[#FFCB05]/60 bg-[#FFCB05]/5" : "border-slate-700 bg-slate-900"}`}
                    >
                      <span className="block text-[9px] uppercase text-slate-500">
                        Espaço {slot + 1} · coluna {displayX + 1}, linha {y + 1}
                      </span>
                      {unit && (
                        <>
                          <img
                            src={unit.spriteUrl}
                            alt=""
                            className="mx-auto h-10 w-10 object-contain"
                          />
                          <b className="block truncate text-xs text-white">
                            {unit.name}
                          </b>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {mine.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-xl border border-cyan-500/20 bg-slate-950 p-3"
                >
                  <button
                    type="button"
                    onClick={() => setPlacementSelected(unit.id)}
                    className={`flex w-full items-center gap-3 rounded-lg text-left ${placementSelected === unit.id ? "ring-2 ring-[#FFCB05]" : ""}`}
                  >
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
                  </button>
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
                    placement.length === mine.length
                      ? placement
                      : mine.map((unit) => unit.id),
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
  const opponents = sideA ? battle.teamB : battle.teamA;
  const cell = (x: number, y: number) =>
    all.find((unit) => unit.hp > 0 && unit.x === x && unit.y === y);
  const enemyAverageAgility = opponents.filter((unit) => unit.hp > 0).length
    ? opponents
        .filter((unit) => unit.hp > 0)
        .reduce((sum, unit) => sum + unit.agility, 0) /
      opponents.filter((unit) => unit.hp > 0).length
    : 0;
  const mobility = selected
    ? 2 +
      (selected.agility - enemyAverageAgility >= 140
        ? 2
        : selected.agility - enemyAverageAgility >= 60
          ? 1
          : 0)
    : 0;
  const plannedPosition = selected
    ? {
        x: orders[selected.id]?.x ?? selected.x,
        y: orders[selected.id]?.y ?? selected.y,
      }
    : null;
  const attackRange = selected
    ? ["DEFENDER", "ATTACKER", "GUARDIAN", "PROVOKER", "SURVIVOR"].includes(
        selected.role,
      )
      ? 1
      : ["SCOUT", "HEALER", "ENCOURAGER"].includes(selected.role)
        ? 3
        : 2
    : 0;
  const protectionRange = selected
    ? selected.role === "PROVOKER"
      ? 3
      : ["DEFENDER", "GUARDIAN"].includes(selected.role)
        ? 2
        : ["HEALER", "ENCOURAGER", "SCOUT", "SABOTEUR"].includes(selected.role)
          ? 3
          : 0
    : 0;
  const canMoveTo = (x: number, y: number) =>
    !!selected &&
    Math.abs(x - selected.x) + Math.abs(y - selected.y) <= mobility &&
    (!cell(x, y) || cell(x, y)?.id === selected.id);
  const chooseCell = (x: number, y: number) => {
    if (!selected || ownPending || !isMyTurn) return;
    if (!canMoveTo(x, y)) {
      toast.error("Célula inválida: fora do alcance ou já ocupada.");
      return;
    }
    setOrders((old) => ({
      ...old,
      [selected.id]: {
        ...(old[selected.id] ?? { type: "AUTO", mascotId: selected.id }),
        x,
        y,
      },
    }));
    toast.success(
      `${selected.name} planeja mover para coluna ${x + 1}, linha ${y + 1}.`,
    );
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
      {battle.phase === "PLANNING" && (
        <div
          className={`rounded-xl border p-4 ${isMyTurn ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-cyan-500/30 bg-cyan-500/5"}`}
        >
          <b className={isMyTurn ? "text-[#FFCB05]" : "text-cyan-200"}>
            {isMyTurn
              ? `Seu turno de movimentação — ${identity.playerName}`
              : `${battle.turnPlayerId === match.playerAId ? match.playerAName : match.playerBName} está movimentando e definindo ações`}
          </b>
          <p className="mt-1 text-xs text-slate-400">
            Os movimentos deste turno são aplicados primeiro. Depois dos dois
            turnos, ataques, curas e defesas são resolvidos pela Agilidade.
          </p>
        </div>
      )}
      {selected && isMyTurn && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px]">
          <span className="text-white">
            <b>{selected.name}</b>: mobilidade {mobility} · alcance de ataque{" "}
            {attackRange}
          </span>
          <span className="text-emerald-300">■ Verde: movimento possível</span>
          <span className="text-red-300">□ Vermelho: área de ataque</span>
          {protectionRange > 0 && (
            <span className="text-blue-300">
              ■ Azul: proteção/suporte ({protectionRange})
            </span>
          )}
          <span className="text-[#FFCB05]">■ Amarelo: destino planejado</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[840px] grid-cols-12 gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2">
          {Array.from({ length: 8 }, (_, y) =>
            Array.from({ length: 12 }, (_, x) => {
              const unit = cell(x, y),
                owned = !!unit && mine.some((entry) => entry.id === unit.id),
                selectedUnit = unit?.id === selectedId,
                event = unit ? lastByUnit.get(unit.id) : null,
                validMove = isMyTurn && !ownPending && canMoveTo(x, y),
                inAttackArea =
                  !!plannedPosition &&
                  Math.abs(x - plannedPosition.x) +
                    Math.abs(y - plannedPosition.y) <=
                    attackRange &&
                  !(x === plannedPosition.x && y === plannedPosition.y),
                inProtectionArea =
                  !!plannedPosition &&
                  protectionRange > 0 &&
                  Math.abs(x - plannedPosition.x) +
                    Math.abs(y - plannedPosition.y) <=
                    protectionRange,
                plannedDestination =
                  !!selected &&
                  orders[selected.id]?.x === x &&
                  orders[selected.id]?.y === y;
              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  onClick={() =>
                    unit && owned ? setSelectedId(unit.id) : chooseCell(x, y)
                  }
                  className={`relative aspect-square min-h-16 rounded border text-[9px] transition-all duration-500 ${selectedUnit ? "border-[#FFCB05] bg-[#FFCB05]/15" : owned ? "border-cyan-500/50 bg-cyan-500/10" : unit ? "border-red-500/40 bg-red-500/10" : "border-slate-800 bg-slate-950/70"} ${validMove ? "ring-2 ring-emerald-400/70 hover:bg-emerald-500/20" : ""} ${inAttackArea ? "after:pointer-events-none after:absolute after:inset-1 after:rounded after:border after:border-red-400/50" : ""} ${inProtectionArea ? "shadow-[inset_0_0_14px_rgba(59,130,246,.22)]" : ""} ${plannedDestination ? "ring-4 ring-[#FFCB05] bg-[#FFCB05]/20" : ""}`}
                >
                  {plannedDestination && (
                    <span className="absolute left-1 top-1 z-10 rounded bg-[#FFCB05] px-1 text-[8px] font-black text-slate-950">
                      DESTINO
                    </span>
                  )}
                  {unit && (
                    <>
                      <img
                        src={unit.spriteUrl}
                        loading="lazy"
                        onError={(e) => fallback(e, unit.pokemonId)}
                        className={`mx-auto h-9 w-9 object-contain ${event?.kind === "MOVE" ? "animate-bounce" : event?.kind === "ATTACK" ? "animate-pulse" : ""}`}
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
      {battle.phase === "PLANNING" && isMyTurn && !ownPending && (
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
                  1. Clique em uma célula verde. 2. Escolha a ação. 3. Confira o
                  resumo e confirme todas as ordens.
                </p>
                {orders[selected.id]?.x != null && (
                  <p className="mt-2 rounded-lg bg-[#FFCB05]/10 p-2 text-xs text-[#FFCB05]">
                    Destino: coluna {(orders[selected.id].x ?? 0) + 1}, linha{" "}
                    {(orders[selected.id].y ?? 0) + 1} · Ação:{" "}
                    {orders[selected.id].type}.
                  </p>
                )}
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
                    <span className="text-right">
                      <b className="block text-cyan-300">
                        {orders[unit.id]?.type ?? "AUTO"}
                      </b>
                      {orders[unit.id]?.x != null && (
                        <span className="text-[9px] text-[#FFCB05]">
                          C{(orders[unit.id].x ?? 0) + 1}/L
                          {(orders[unit.id].y ?? 0) + 1}
                        </span>
                      )}
                    </span>
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
      {battle.phase === "PLANNING" && !isMyTurn && (
        <div className="rounded-xl border border-cyan-500/25 p-6 text-center text-cyan-100">
          {ownPending
            ? "Sua movimentação foi concluída. O adversário está realizando o segundo turno desta rodada."
            : "Aguarde: o adversário está realizando o primeiro turno de movimentação desta rodada."}
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
