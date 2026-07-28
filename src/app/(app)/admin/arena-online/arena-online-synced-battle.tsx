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
  type TacticalBattleEvent,
  type TacticalFormation,
  type TacticalUnit,
} from "../../combates/arena-online/matchmaking-actions";
import {
  COMBAT_ROLE_LABELS,
  COMBAT_ROLE_VALUES,
  type CombatRole,
} from "@/lib/combat-roles";
import { tacticalBiomeAt, tacticalFogState } from "@/lib/tactical-arena";

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
    name: "Formação equilibrada",
    detail: "Duas linhas de proteção com atacantes e suportes recuados.",
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
const ACTIONS: Array<{
  id: LivePvpBattleAction["type"];
  label: string;
  detail: string;
}> = [
  {
    id: "AUTO",
    label: "Agir pela postura",
    detail:
      "O servidor escolhe a melhor ação para a postura: atacar, curar, proteger ou se reposicionar.",
  },
  {
    id: "ATTACK",
    label: "Forçar ataque",
    detail:
      "Ataca o alvo prioritário da postura que estiver dentro do alcance após os movimentos.",
  },
  {
    id: "DEFEND",
    label: "Preparar defesa",
    detail:
      "Não ataca nesta rodada e reduz o próximo dano direto recebido: 45% Defensor, 38% Guardião, 32% demais.",
  },
  {
    id: "WAIT",
    label: "Não agir",
    detail:
      "Mantém a posição final e não realiza ataque, cura ou defesa nesta rodada.",
  },
];
const EVENT_LABELS: Record<string, string> = {
  MOVE: "MOVENDO",
  ATTACK: "ATACANDO",
  HEAL: "CURANDO",
  DEFEND: "DEFENDENDO",
  GUARD: "INTERCEPTANDO",
  BUFF: "IMPULSIONADO",
  DEBUFF: "INTERFERÊNCIA",
  MARK: "ALVO MARCADO",
  SABOTAGE: "SABOTANDO",
  REDIRECT: "REDIRECIONANDO",
  PROVOKE: "PROVOCANDO",
  BYPASS: "FLANQUEANDO",
  INTERFERENCE: "REAÇÃO BLOQUEADA",
  SCOUT_BONUS: "ALVO REVELADO",
  SURVIVE: "SOBREVIVEU",
  MITIGATE: "DANO REDUZIDO",
  CONTROL: "ZONA DE CONTROLE",
  BLOCK: "MOVIMENTO BLOQUEADO",
  KO: "K.O.",
  FOG: "NÉVOA",
};
const TYPE_LABELS: Record<string, string> = {
  fire: "Fogo",
  water: "Água",
  grass: "Planta",
  bug: "Inseto",
  ice: "Gelo",
  rock: "Pedra",
  ground: "Terra",
  electric: "Elétrico",
  psychic: "Psíquico",
  fairy: "Fada",
  ghost: "Fantasma",
  dark: "Sombrio",
  dragon: "Dragão",
  steel: "Aço",
  normal: "Normal",
  fighting: "Lutador",
  poison: "Veneno",
  flying: "Voador",
};
const SUPPORT_EFFECT_TEXT: Partial<Record<CombatRole, string>> = {
  ENCOURAGER: "Aura de impulso aumenta o dano dos aliados próximos.",
  SCOUT: "Revela alvos e abre bônus de dano para aliados próximos.",
  GUARDIAN: "Pode interceptar parte do dano destinado a um aliado.",
  DEFENDER: "Pode redirecionar ataques dentro de sua zona de proteção.",
  PROVOKER: "Pode provocar o atacante e assumir o golpe.",
  SABOTEUR: "Pode reduzir suporte inimigo e bloquear reações de postura.",
  HEALER: "Mantém suporte de cura para aliados feridos próximos.",
};
const PERCENT_EVENTS = new Set([
  "DEFEND",
  "BUFF",
  "DEBUFF",
  "MARK",
  "SABOTAGE",
  "REDIRECT",
  "PROVOKE",
  "BYPASS",
  "SCOUT_BONUS",
  "MITIGATE",
]);
const TACTICAL_ROLE_DETAILS: Record<CombatRole, string> = {
  DEFENDER:
    "Protege aliados a até 2 casas, redireciona uma vez por rodada e recebe redução baseada em Vitalidade. Preparar defesa aumenta a chance e reduz 45% do próximo ataque.",
  ATTACKER:
    "Avança sobre alvos fortes, recebe bônus de dano por Força e causa mais 15% contra Defensores.",
  FLANK:
    "Ignora o primeiro custo de zona de controle, prioriza inimigos feridos e pode atravessar o redirecionamento do Defensor.",
  OPPORTUNIST:
    "Pode aplicar por 3 rodadas uma redução visível em Força, Agilidade, Instinto ou Vitalidade.",
  ENCOURAGER:
    "Concede uma aura de dano de até 3 casas. Sabotadores próximos reduzem a aura em 30%.",
  GUARDIAN:
    "Intercepta dano de aliados a até 2 casas. Preparar defesa permite duas interceptações e reduz 38% do próximo ataque direto.",
  DUELIST:
    "Marca o primeiro rival atingido e recebe 12% adicional nos ataques seguintes contra o mesmo alvo.",
  SABOTEUR:
    "Sua aura de 3 casas reduz cura e impulso em 30%; seus ataques podem bloquear a próxima reação de postura.",
  HEALER:
    "Cura o aliado ferido de menor percentual de HP a até 3 casas. A cura escala com Carisma, Vitalidade e nível.",
  SCOUT:
    "Marca o inimigo mais ferido a até 4 casas. Aliados próximos causam 8% a mais contra o alvo marcado.",
  PROVOKER:
    "Pode tomar para si um ataque contra um aliado a até 3 casas e reduz em 8% o dano redirecionado.",
  SPECIALIST:
    "Recebe bônus ofensivo baseado no maior atributo atual, incluindo alterações causadas por efeitos.",
  SURVIVOR:
    "Reduz dano por Vitalidade, fica mais forte abaixo de 30% de HP e sobrevive uma vez com 1 HP.",
};

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
  const [formationPositions, setFormationPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [orders, setOrders] = useState<Record<string, LivePvpBattleAction>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [eventPlayback, setEventPlayback] = useState<{
    signature: string;
    index: number;
  }>({ signature: "", index: -1 });
  const [moveFrame, setMoveFrame] = useState(0);
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
      battle?.phase !== "FORMATION" ||
      !mine.length ||
      Object.keys(formationPositions).length
    )
      return;
    setFormationPositions(
      Object.fromEntries(
        mine.map((unit, index) => {
          const [baseX, y] = FORMATION_SLOTS[formation][index];
          return [unit.id, { x: sideA ? baseX : 11 - baseX, y }];
        }),
      ),
    );
  }, [battle?.phase, mine.length, sideA]);
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
        mine.map((unit) => ({
          mascotId: unit.id,
          ...(formationPositions[unit.id] ?? { x: unit.x, y: unit.y }),
        })),
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
  const eventSignature = useMemo(
    () =>
      (battle?.lastEvents ?? [])
        .map(
          (event) =>
            `${event.kind}:${event.unitId}:${event.targetId ?? ""}:${event.amount ?? ""}:${event.text}`,
        )
        .join("|"),
    [battle?.lastEvents],
  );
  useEffect(() => {
    if (!eventSignature) {
      setEventPlayback({ signature: "", index: 0 });
      return;
    }
    setEventPlayback({ signature: eventSignature, index: 0 });
    const eventCount = battle?.lastEvents.length ?? 0;
    const eventDelay = 2000;
    const timer = setInterval(
      () =>
        setEventPlayback((current) =>
          current.signature !== eventSignature ||
          current.index >= eventCount - 1
            ? current
            : { ...current, index: current.index + 1 },
        ),
      eventDelay,
    );
    const stop = setTimeout(
      () => {
        clearInterval(timer);
        setEventPlayback((current) =>
          current.signature === eventSignature
            ? { signature: eventSignature, index: eventCount }
            : current,
        );
      },
      Math.max(2200, eventCount * eventDelay + 300),
    );
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [eventSignature]);
  const activeEvent: TacticalBattleEvent | null =
    eventPlayback.signature === eventSignature &&
    eventPlayback.index >= 0 &&
    eventPlayback.index < (battle?.lastEvents.length ?? 0)
      ? (battle?.lastEvents[eventPlayback.index] ?? null)
      : null;
  useEffect(() => {
    setMoveFrame(0);
    if (
      activeEvent?.kind !== "MOVE" ||
      activeEvent.fromX == null ||
      activeEvent.fromY == null ||
      activeEvent.toX == null ||
      activeEvent.toY == null
    )
      return;
    const steps =
      Math.abs(activeEvent.toX - activeEvent.fromX) +
      Math.abs(activeEvent.toY - activeEvent.fromY);
    if (!steps) return;
    const timer = setInterval(
      () => setMoveFrame((frame) => Math.min(steps, frame + 1)),
      Math.max(220, Math.floor(1650 / steps)),
    );
    return () => clearInterval(timer);
  }, [eventPlayback.signature, eventPlayback.index]);
  const applyFormationTemplate = (nextFormation: TacticalFormation) => {
    setFormation(nextFormation);
    setFormationPositions(
      Object.fromEntries(
        mine.map((unit, index) => {
          const [baseX, y] = FORMATION_SLOTS[nextFormation][index];
          return [unit.id, { x: sideA ? baseX : 11 - baseX, y }];
        }),
      ),
    );
  };
  const placeMascot = (x: number, y: number) => {
    if (!placementSelected) return;
    const occupied = Object.entries(formationPositions).find(
      ([id, position]) =>
        id !== placementSelected && position.x === x && position.y === y,
    );
    setFormationPositions((current) => {
      const next = { ...current };
      const previous = next[placementSelected];
      next[placementSelected] = { x, y };
      if (occupied && previous) next[occupied[0]] = previous;
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
                  onClick={() => applyFormationTemplate(entry.id)}
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
                  <b className="text-sm text-white">
                    Editor visual de posições iniciais
                  </b>
                  <p className="text-xs text-slate-400">
                    Clique em um mascote abaixo e depois em qualquer casa
                    iluminada da sua zona inicial. Uma casa ocupada troca os
                    dois mascotes de lugar.
                  </p>
                </div>
                {placementSelected && (
                  <span className="rounded-full bg-[#FFCB05] px-3 py-1 text-[10px] font-black text-slate-950">
                    Escolhendo posição de{" "}
                    {mine.find((unit) => unit.id === placementSelected)?.name}
                  </span>
                )}
              </div>
              {!!battle.biomes?.length && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {battle.biomes.map((biome) => (
                    <div
                      key={biome.id}
                      className="rounded-lg border border-slate-700 p-2"
                      style={{ backgroundColor: biome.color }}
                    >
                      <b className="text-[10px] text-white">{biome.name}</b>
                      <p className="text-[8px] text-emerald-300">
                        Favorece{" "}
                        {biome.favoredTypes
                          .map((type) => TYPE_LABELS[type] ?? type)
                          .join("/")}
                      </p>
                      <p className="text-[8px] text-red-300">
                        Penaliza{" "}
                        {biome.penalizedTypes
                          .map((type) => TYPE_LABELS[type] ?? type)
                          .join("/")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto">
                <div className="grid min-w-[720px] grid-cols-12 gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2">
                  {Array.from({ length: 8 }, (_, y) =>
                    Array.from({ length: 12 }, (_, x) => {
                      const biome = tacticalBiomeAt(battle.biomes ?? [], x, y);
                      const validZone = sideA ? x <= 2 : x >= 9;
                      const unit = mine.find((entry) => {
                        const position = formationPositions[entry.id];
                        return position?.x === x && position.y === y;
                      });
                      return (
                        <button
                          key={`formation-${x}-${y}`}
                          type="button"
                          disabled={!validZone}
                          onClick={() => placeMascot(x, y)}
                          style={{ backgroundColor: biome?.color }}
                          className={`relative aspect-square min-h-14 rounded border ${validZone ? (placementSelected ? "border-[#FFCB05] bg-[#FFCB05]/10 hover:bg-[#FFCB05]/25" : "border-cyan-500/40 bg-cyan-500/10") : "border-slate-800 bg-slate-950/70 opacity-35"}`}
                        >
                          {!unit && biome && (
                            <span className="absolute bottom-0.5 left-1 text-[7px] uppercase text-slate-500">
                              {biome.name}
                            </span>
                          )}
                          {validZone && !unit && (
                            <span className="text-[9px] uppercase text-cyan-300/60">
                              Posicionar
                            </span>
                          )}
                          {unit && (
                            <>
                              <img
                                src={unit.spriteUrl}
                                onError={(event) =>
                                  fallback(event, unit.pokemonId)
                                }
                                alt=""
                                className="mx-auto h-9 w-9 object-contain"
                              />
                              <b className="block truncate px-1 text-[9px] text-white">
                                {unit.name}
                              </b>
                            </>
                          )}
                        </button>
                      );
                    }),
                  ).flat()}
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Sua zona inicial está iluminada. O centro e o território
                adversário ficam bloqueados nesta etapa.
              </p>
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
                    mine.map((unit) => ({
                      mascotId: unit.id,
                      ...(formationPositions[unit.id] ?? {
                        x: unit.x,
                        y: unit.y,
                      }),
                    })),
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
  const playbackIndex =
    eventPlayback.signature === eventSignature ? eventPlayback.index : -1;
  const playbackRunning =
    !!eventSignature && playbackIndex < battle.lastEvents.length;
  const animatedMovePosition = (() => {
    if (
      activeEvent?.kind !== "MOVE" ||
      activeEvent.fromX == null ||
      activeEvent.fromY == null ||
      activeEvent.toX == null ||
      activeEvent.toY == null
    )
      return null;
    const dx = activeEvent.toX - activeEvent.fromX;
    const horizontalSteps = Math.abs(dx);
    if (moveFrame <= horizontalSteps)
      return {
        x: activeEvent.fromX + Math.sign(dx) * moveFrame,
        y: activeEvent.fromY,
      };
    const dy = activeEvent.toY - activeEvent.fromY;
    return {
      x: activeEvent.toX,
      y:
        activeEvent.fromY +
        Math.sign(dy) * Math.min(Math.abs(dy), moveFrame - horizontalSteps),
    };
  })();
  const visualUnits = all.map((unit) => {
    let x = unit.x,
      y = unit.y,
      hp = unit.hp;
    const movementIndex = battle.lastEvents.findIndex(
      (event) => event.kind === "MOVE" && event.unitId === unit.id,
    );
    const movement = battle.lastEvents[movementIndex];
    if (
      movement &&
      movementIndex > playbackIndex &&
      movement.fromX != null &&
      movement.fromY != null
    ) {
      x = movement.fromX;
      y = movement.fromY;
    } else if (
      movement &&
      movementIndex === playbackIndex &&
      animatedMovePosition
    ) {
      x = animatedMovePosition.x;
      y = animatedMovePosition.y;
    }
    for (
      let index = battle.lastEvents.length - 1;
      index > playbackIndex;
      index--
    ) {
      const event = battle.lastEvents[index];
      if (event.amount == null) continue;
      if (event.kind === "ATTACK" && event.targetId === unit.id)
        hp += event.amount;
      else if (event.kind === "FOG" && event.targetId === unit.id)
        hp += event.amount;
      else if (event.kind === "GUARD" && event.unitId === unit.id)
        hp += event.amount;
      else if (event.kind === "HEAL" && event.targetId === unit.id)
        hp -= event.amount;
    }
    return { ...unit, x, y, hp: Math.max(0, Math.min(unit.maxHp, hp)) };
  });
  const cinematicActor =
    activeEvent?.kind === "ATTACK"
      ? (visualUnits.find((unit) => unit.id === activeEvent.unitId) ?? null)
      : null;
  const cinematicTarget =
    activeEvent?.kind === "ATTACK"
      ? (visualUnits.find((unit) => unit.id === activeEvent.targetId) ?? null)
      : null;
  const cinematicActorIsA = cinematicActor
    ? battle.teamA.some((unit) => unit.id === cinematicActor.id)
    : false;
  const cinematicAllies =
    cinematicActor && cinematicTarget
      ? visualUnits
          .filter((unit) => {
            if (
              unit.hp <= 0 ||
              unit.id === cinematicActor.id ||
              unit.id === cinematicTarget.id
            )
              return false;
            const unitIsA = battle.teamA.some((entry) => entry.id === unit.id);
            const distanceToActor =
              Math.abs(unit.x - cinematicActor.x) +
              Math.abs(unit.y - cinematicActor.y);
            const distanceToTarget =
              Math.abs(unit.x - cinematicTarget.x) +
              Math.abs(unit.y - cinematicTarget.y);
            return (
              !!SUPPORT_EFFECT_TEXT[unit.role] &&
              ((unitIsA === cinematicActorIsA && distanceToActor <= 3) ||
                (unitIsA !== cinematicActorIsA && distanceToTarget <= 3))
            );
          })
          .slice(0, 4)
      : [];
  const cell = (x: number, y: number) => {
    const positioned = visualUnits.find(
      (unit) =>
        unit.x === x &&
        unit.y === y &&
        (unit.hp > 0 ||
          activeEvent?.targetId === unit.id ||
          battle.lastEvents.some(
            (event, index) =>
              event.kind === "KO" &&
              event.unitId === unit.id &&
              index >= playbackIndex,
          )),
    );
    return positioned;
  };
  const effectiveAgility = (unit: TacticalUnit) =>
    Math.max(
      1,
      Math.round(
        unit.agility *
          (1 +
            (unit.effects ?? [])
              .filter((effect) => effect.stat === "agility")
              .reduce(
                (sum, effect) =>
                  sum + (effect.kind === "BUFF" ? effect.value : -effect.value),
                0,
              )),
      ),
    );
  const initiative = [...all]
    .filter((unit) => unit.hp > 0)
    .sort((a, b) => effectiveAgility(b) - effectiveAgility(a));
  const enemyAverageAgility = opponents.filter((unit) => unit.hp > 0).length
    ? opponents
        .filter((unit) => unit.hp > 0)
        .reduce((sum, unit) => sum + effectiveAgility(unit), 0) /
      opponents.filter((unit) => unit.hp > 0).length
    : 0;
  const mobility = selected
    ? 2 +
      (effectiveAgility(selected) - enemyAverageAgility >= 140
        ? 2
        : effectiveAgility(selected) - enemyAverageAgility >= 60
          ? 1
          : 0) -
      (tacticalFogState(battle.round, selected.x, selected.y) === "ACTIVE"
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
  const postureZoneLabel = selected
    ? selected.role === "DEFENDER"
      ? "Zona de redirecionamento"
      : selected.role === "GUARDIAN"
        ? "Zona de interceptação"
        : selected.role === "PROVOKER"
          ? "Zona de provocação"
          : selected.role === "HEALER"
            ? "Alcance de cura"
            : selected.role === "ENCOURAGER"
              ? "Aura de impulso"
              : selected.role === "SABOTEUR"
                ? "Aura de sabotagem"
                : selected.role === "SCOUT"
                  ? "Alcance de marcação"
                  : null
    : null;
  const postureZoneTheme = selected
    ? selected.role === "HEALER"
      ? "border-emerald-400/80 bg-emerald-500/20"
      : selected.role === "ENCOURAGER"
        ? "border-amber-300/80 bg-amber-400/20"
        : selected.role === "SABOTEUR"
          ? "border-purple-400/80 bg-purple-500/20"
          : selected.role === "PROVOKER"
            ? "border-orange-400/80 bg-orange-500/20"
            : selected.role === "SCOUT"
              ? "border-cyan-300/80 bg-cyan-400/20"
              : "border-blue-400/80 bg-blue-500/20"
    : "border-blue-400/80 bg-blue-500/20";
  const leavingEnemyControl =
    !!selected &&
    selected.role !== "FLANK" &&
    opponents.some(
      (enemy) =>
        enemy.hp > 0 &&
        Math.abs(enemy.x - selected.x) + Math.abs(enemy.y - selected.y) === 1,
    );
  const canMoveTo = (x: number, y: number) =>
    !!selected &&
    Math.abs(x - selected.x) +
      Math.abs(y - selected.y) +
      (leavingEnemyControl && (x !== selected.x || y !== selected.y) ? 1 : 0) <=
      mobility &&
    (!cell(x, y) || cell(x, y)?.id === selected.id);
  const chooseCell = (x: number, y: number) => {
    if (!selected || ownPending || !isMyTurn || playbackRunning) return;
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
  const chooseTarget = (target: TacticalUnit) => {
    if (!selected || ownPending || !isMyTurn || playbackRunning) return;
    if (orders[selected.id]?.type !== "ATTACK") {
      toast.info("Escolha 'Forçar ataque' antes de marcar um alvo inimigo.");
      return;
    }
    const origin = plannedPosition ?? selected;
    if (
      Math.abs(origin.x - target.x) + Math.abs(origin.y - target.y) >
      attackRange
    ) {
      toast.error(
        "Esse alvo ficará fora do alcance após o movimento planejado.",
      );
      return;
    }
    setOrders((old) => ({
      ...old,
      [selected.id]: {
        ...(old[selected.id] ?? { type: "ATTACK", mascotId: selected.id }),
        type: "ATTACK",
        mascotId: selected.id,
        targetId: target.id,
      },
    }));
    toast.success(
      `${selected.name} atacará ${target.name} se o alvo continuar válido.`,
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
              ■ Azul: {postureZoneLabel ?? "proteção/suporte"} (
              {protectionRange})
            </span>
          )}
          <span className="text-orange-300">
            ■ Laranja: zona de controle inimiga; sair custa +1 movimento
          </span>
          <span className="text-[#FFCB05]">■ Amarelo: destino planejado</span>
        </div>
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        <div className="mb-2 flex items-center justify-between">
          <b className="text-xs uppercase tracking-wider text-white">
            Iniciativa da resolução
          </b>
          <span className="text-[10px] text-slate-400">
            Maior Agilidade age primeiro
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {initiative.map((unit, index) => (
            <div
              key={`initiative-${unit.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-2 py-1.5 ${mine.some((entry) => entry.id === unit.id) ? "border-cyan-500/30 bg-cyan-500/10" : "border-red-500/30 bg-red-500/10"}`}
            >
              <b className="text-[#FFCB05]">{index + 1}º</b>
              <img
                src={unit.spriteUrl}
                alt=""
                className="h-7 w-7 object-contain"
              />
              <span className="text-[10px] text-white">
                {unit.name} · AGI {effectiveAgility(unit)}
              </span>
            </div>
          ))}
        </div>
      </div>
      {!!battle.biomes?.length && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {battle.biomes.map((biome) => (
            <div
              key={biome.id}
              className="rounded-xl border border-slate-700 p-2.5"
              style={{ backgroundColor: biome.color }}
            >
              <b className="text-[11px] text-white">{biome.name}</b>
              <p className="mt-1 text-[9px] text-emerald-300">
                +10% atributo da postura:{" "}
                {biome.favoredTypes
                  .map((type) => TYPE_LABELS[type] ?? type)
                  .join(", ")}
              </p>
              <p className="text-[9px] text-red-300">
                −10%:{" "}
                {biome.penalizedTypes
                  .map((type) => TYPE_LABELS[type] ?? type)
                  .join(", ")}
              </p>
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-3 rounded-lg border border-purple-500/25 bg-purple-950/20 px-3 py-2 text-[9px] text-slate-300">
            <b className="text-purple-200">Névoa de combate:</b>
            <span>âmbar = fecha na próxima rodada</span>
            <span className="text-fuchsia-300">
              roxo = −1 movimento, −50% cura e dano crescente de 8% a 20% do HP
              máximo
            </span>
          </div>
        </div>
      )}
      {activeEvent && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-fuchsia-400/50 bg-fuchsia-500/10 px-4 py-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-fuchsia-300">
              Resolução {eventPlayback.index + 1}/{battle.lastEvents.length}
            </p>
            <b className="text-sm text-white">{activeEvent.text}</b>
          </div>
          {activeEvent.amount != null && (
            <span
              className={`text-2xl font-black ${activeEvent.kind === "HEAL" || activeEvent.kind === "BUFF" || activeEvent.kind === "SCOUT_BONUS" ? "text-emerald-300" : activeEvent.kind === "DEBUFF" ? "text-purple-300" : activeEvent.kind === "DEFEND" || activeEvent.kind === "GUARD" || activeEvent.kind === "MITIGATE" ? "text-blue-300" : "text-red-400"}`}
            >
              {activeEvent.kind === "HEAL" ||
              activeEvent.kind === "BUFF" ||
              activeEvent.kind === "SCOUT_BONUS"
                ? "+"
                : activeEvent.kind === "DEFEND" ||
                    activeEvent.kind === "GUARD" ||
                    activeEvent.kind === "MITIGATE"
                  ? "🛡 "
                  : ["ATTACK", "DEBUFF", "SABOTAGE"].includes(activeEvent.kind)
                    ? "−"
                    : ""}
              {activeEvent.amount}
              {PERCENT_EVENTS.has(activeEvent.kind) ? "%" : ""}
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="relative grid min-w-[840px] grid-cols-12 gap-1 rounded-xl border border-slate-700 bg-slate-900 p-2">
          {cinematicActor &&
            cinematicTarget &&
            activeEvent?.kind === "ATTACK" && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-40 w-[min(92%,650px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-fuchsia-300/70 bg-slate-950/95 p-3 shadow-[0_15px_70px_rgba(0,0,0,.8)] backdrop-blur">
                <p className="mb-2 text-center text-[9px] font-black uppercase tracking-[.2em] text-fuchsia-300">
                  Troca de dano · rodada {battle.round}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  {[cinematicActor, cinematicTarget]
                    .map((unit, index) => (
                      <div
                        key={unit.id}
                        className={`rounded-xl border p-2 text-center ${index === 0 ? "border-cyan-400/50 bg-cyan-500/10" : "border-red-400/50 bg-red-500/10"}`}
                      >
                        <img
                          src={unit.spriteUrl}
                          onError={(event) => fallback(event, unit.pokemonId)}
                          alt=""
                          className="mx-auto h-20 w-20 object-contain drop-shadow-[0_0_12px_rgba(255,255,255,.3)]"
                        />
                        <b className="block truncate text-xs text-white">
                          {unit.name}
                        </b>
                        <span className="text-[9px] text-slate-400">
                          {COMBAT_ROLE_LABELS[unit.role]}
                        </span>
                      </div>
                    ))
                    .reduce<React.ReactNode[]>((nodes, card, index) => {
                      if (index === 1)
                        nodes.push(
                          <div
                            key="damage"
                            className="animate-pulse text-center"
                          >
                            <span className="block text-2xl">⚔️</span>
                            <b className="text-2xl text-red-400">
                              −{activeEvent.amount ?? 0}
                            </b>
                            <span className="block text-[8px] uppercase text-slate-400">
                              dano
                            </span>
                          </div>,
                        );
                      nodes.push(card);
                      return nodes;
                    }, [])}
                </div>
                {!!cinematicAllies.length && (
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {cinematicAllies.map((unit) => (
                      <div
                        key={unit.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 p-1.5"
                      >
                        <img
                          src={unit.spriteUrl}
                          onError={(event) => fallback(event, unit.pokemonId)}
                          alt=""
                          className="h-8 w-8 object-contain"
                        />
                        <div className="min-w-0">
                          <b className="block truncate text-[9px] text-white">
                            {unit.name} · {COMBAT_ROLE_LABELS[unit.role]}
                          </b>
                          <p className="text-[8px] leading-tight text-cyan-200">
                            {SUPPORT_EFFECT_TEXT[unit.role]}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          {activeEvent?.kind === "KO" && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-red-950/35 backdrop-blur-[1px]">
              <div className="animate-pulse rounded-2xl border-4 border-red-500 bg-slate-950/95 px-10 py-6 text-center shadow-[0_0_60px_rgba(239,68,68,.8)]">
                <p className="font-pixel text-5xl text-red-500">K.O.</p>
                <p className="mt-3 text-lg font-black text-white">
                  {activeEvent.text}
                </p>
              </div>
            </div>
          )}
          {Array.from({ length: 8 }, (_, y) =>
            Array.from({ length: 12 }, (_, x) => {
              const biome = tacticalBiomeAt(battle.biomes ?? [], x, y),
                fogState = tacticalFogState(battle.round, x, y),
                unit = cell(x, y),
                owned = !!unit && mine.some((entry) => entry.id === unit.id),
                selectedUnit = unit?.id === selectedId,
                acting = !!unit && activeEvent?.unitId === unit.id,
                targeted = !!unit && activeEvent?.targetId === unit.id,
                manuallyTargeted =
                  !!unit &&
                  !!selected &&
                  orders[selected.id]?.targetId === unit.id,
                knockedOut =
                  !!unit &&
                  activeEvent?.kind === "KO" &&
                  activeEvent.unitId === unit.id,
                enemyControlCell = opponents.some(
                  (enemy) =>
                    enemy.hp > 0 &&
                    Math.abs(enemy.x - x) + Math.abs(enemy.y - y) === 1,
                ),
                validMove =
                  isMyTurn &&
                  !ownPending &&
                  !playbackRunning &&
                  canMoveTo(x, y),
                inAttackArea =
                  !playbackRunning &&
                  !!plannedPosition &&
                  Math.abs(x - plannedPosition.x) +
                    Math.abs(y - plannedPosition.y) <=
                    attackRange &&
                  !(x === plannedPosition.x && y === plannedPosition.y),
                inProtectionArea =
                  !playbackRunning &&
                  !!plannedPosition &&
                  protectionRange > 0 &&
                  Math.abs(x - plannedPosition.x) +
                    Math.abs(y - plannedPosition.y) <=
                    protectionRange,
                plannedDestination =
                  !!selected &&
                  orders[selected.id]?.x === x &&
                  orders[selected.id]?.y === y,
                plannedAllies = mine.filter(
                  (ally) =>
                    orders[ally.id]?.x === x &&
                    orders[ally.id]?.y === y &&
                    (ally.x !== x || ally.y !== y),
                );
              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  onClick={() =>
                    unit
                      ? owned
                        ? setSelectedId(unit.id)
                        : chooseTarget(unit)
                      : chooseCell(x, y)
                  }
                  style={{ backgroundColor: biome?.color }}
                  className={`relative aspect-square min-h-16 overflow-visible rounded border text-[9px] transition-all duration-300 ${selectedUnit ? "border-[#FFCB05]" : owned ? "border-cyan-500/50" : unit ? "border-red-500/40" : "border-slate-800"} ${fogState === "WARNING" ? "shadow-[inset_0_0_0_3px_rgba(251,191,36,.55)]" : ""} ${fogState === "ACTIVE" ? "before:pointer-events-none before:absolute before:inset-0 before:z-[1] before:rounded before:bg-purple-950/55 before:content-['']" : ""} ${validMove ? "ring-2 ring-emerald-400/70 hover:bg-emerald-500/20" : ""} ${enemyControlCell && selected ? "shadow-[inset_0_0_12px_rgba(249,115,22,.28)]" : ""} ${inAttackArea ? "after:pointer-events-none after:absolute after:inset-1 after:rounded after:border after:border-red-400/50" : ""} ${inProtectionArea ? "shadow-[inset_0_0_14px_rgba(59,130,246,.22)]" : ""} ${plannedDestination ? "ring-4 ring-[#FFCB05] bg-[#FFCB05]/20" : ""} ${acting ? "z-10 ring-4 ring-fuchsia-400 bg-fuchsia-500/20" : ""} ${targeted ? "z-10 ring-4 ring-red-500 bg-red-500/25" : ""} ${manuallyTargeted ? "z-10 ring-4 ring-orange-400 bg-orange-500/20" : ""} ${knockedOut ? "z-20 ring-4 ring-red-600 bg-red-950" : ""}`}
                >
                  {!unit && biome && (
                    <span className="pointer-events-none absolute bottom-0.5 left-1 z-[2] text-[7px] font-bold uppercase text-slate-500/80">
                      {biome.name}
                    </span>
                  )}
                  {fogState !== "SAFE" && (
                    <span
                      className={`pointer-events-none absolute right-1 top-1 z-[3] text-[8px] ${fogState === "ACTIVE" ? "text-fuchsia-200" : "text-amber-300"}`}
                    >
                      {fogState === "ACTIVE" ? "NÉVOA" : "AVISO"}
                    </span>
                  )}
                  {inProtectionArea && (
                    <span
                      className={`pointer-events-none absolute inset-1 z-0 rounded border-2 ${postureZoneTheme}`}
                    />
                  )}
                  {inAttackArea && (
                    <span className="pointer-events-none absolute inset-2 z-0 rounded border border-red-400/80 bg-red-500/10" />
                  )}
                  {plannedDestination && (
                    <span className="absolute left-1 top-1 z-10 rounded bg-[#FFCB05] px-1 text-[8px] font-black text-slate-950">
                      DESTINO
                    </span>
                  )}
                  {plannedAllies.map((ally, index) => (
                    <span
                      key={`plan-${ally.id}`}
                      className="absolute bottom-1 left-1 z-20 max-w-[90%] truncate rounded bg-[#FFCB05] px-1 py-0.5 text-[7px] font-black text-slate-950 shadow"
                      style={{ bottom: `${4 + index * 14}px` }}
                    >
                      → {ally.name}
                    </span>
                  ))}
                  {manuallyTargeted && (
                    <span className="absolute right-1 top-1 z-30 rounded bg-orange-500 px-1 py-0.5 text-[8px] font-black text-white">
                      ALVO
                    </span>
                  )}
                  {unit && (
                    <>
                      <img
                        src={unit.spriteUrl}
                        loading="lazy"
                        onError={(e) => fallback(e, unit.pokemonId)}
                        className={`relative z-10 mx-auto h-9 w-9 object-contain transition-all duration-300 ${acting ? (activeEvent?.kind === "MOVE" ? "scale-110 drop-shadow-[0_0_8px_rgba(34,211,238,.9)]" : "scale-125 drop-shadow-[0_0_8px_rgba(232,121,249,.9)]") : ""} ${targeted ? "scale-90 brightness-150" : ""} ${knockedOut ? "rotate-12 scale-75 grayscale opacity-50" : ""}`}
                        alt=""
                      />
                      <b className="relative z-10 block truncate px-1 text-white">
                        {unit.name}
                      </b>
                      <span className="relative z-10 text-slate-300">
                        {COMBAT_ROLE_LABELS[unit.role]}
                      </span>
                      {!!unit.effects?.length && (
                        <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                          {unit.effects.map((effect) => (
                            <span
                              key={effect.id}
                              title={`${effect.label}: ${Math.round(effect.value * 100)}% por ${effect.duration} rodada(s)`}
                              className={`rounded px-1 text-[7px] font-black ${effect.kind === "BUFF" ? "bg-emerald-500/25 text-emerald-200" : "bg-purple-500/30 text-purple-200"}`}
                            >
                              {effect.kind === "BUFF" ? "↑" : "↓"}{" "}
                              {effect.duration}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="relative z-10 mx-1 mt-1 h-1 rounded bg-slate-800">
                        <div
                          className="h-full rounded bg-emerald-400"
                          style={{ width: `${(100 * unit.hp) / unit.maxHp}%` }}
                        />
                      </div>
                      {acting && (
                        <span className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-fuchsia-500 px-2 py-0.5 text-[8px] font-black text-white">
                          {EVENT_LABELS[activeEvent?.kind ?? ""] ??
                            activeEvent?.kind}
                        </span>
                      )}
                      {targeted && activeEvent?.amount != null && (
                        <span
                          className={`absolute right-0 top-1/2 z-30 -translate-y-1/2 translate-x-1/2 animate-pulse whitespace-nowrap rounded-lg bg-slate-950/95 px-1.5 py-0.5 text-base font-black shadow-xl ${activeEvent.kind === "HEAL" || activeEvent.kind === "BUFF" || activeEvent.kind === "SCOUT_BONUS" ? "text-emerald-300" : activeEvent.kind === "DEBUFF" ? "text-purple-300" : activeEvent.kind === "GUARD" || activeEvent.kind === "MITIGATE" ? "text-blue-300" : "text-red-400"}`}
                        >
                          {activeEvent.kind === "HEAL" ||
                          activeEvent.kind === "BUFF" ||
                          activeEvent.kind === "SCOUT_BONUS"
                            ? "+"
                            : activeEvent.kind === "GUARD" ||
                                activeEvent.kind === "MITIGATE"
                              ? "🛡 "
                              : ["ATTACK", "DEBUFF", "SABOTAGE"].includes(
                                    activeEvent.kind,
                                  )
                                ? "−"
                                : ""}
                          {activeEvent.amount}
                          {PERCENT_EVENTS.has(activeEvent.kind) ? "%" : ""}
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
      {battle.phase === "PLANNING" &&
        isMyTurn &&
        !ownPending &&
        !playbackRunning && (
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
                    1. Clique em uma célula verde. 2. Escolha a ação. 3. Confira
                    o resumo e confirme todas as ordens.
                  </p>
                  <div className="mt-2 rounded-lg border border-blue-500/25 bg-blue-500/10 p-2 text-[11px] leading-relaxed text-blue-100">
                    <b className="block text-blue-300">
                      Efeito tático de {COMBAT_ROLE_LABELS[selected.role]}
                    </b>
                    {TACTICAL_ROLE_DETAILS[selected.role]}
                    {postureZoneLabel && (
                      <span className="mt-1 block font-bold text-blue-300">
                        {postureZoneLabel}: {protectionRange} casa(s).
                      </span>
                    )}
                  </div>
                  {!!selected.effects?.length && (
                    <div className="mt-2 space-y-1 rounded-lg border border-purple-500/25 bg-purple-500/10 p-2">
                      <b className="text-[10px] uppercase tracking-wider text-purple-200">
                        Efeitos ativos
                      </b>
                      {selected.effects.map((effect) => (
                        <p
                          key={effect.id}
                          className="text-[10px] text-purple-100"
                        >
                          {effect.kind === "BUFF" ? "↑" : "↓"} {effect.label}
                          {effect.value > 0
                            ? ` · ${Math.round(effect.value * 100)}%`
                            : ""}
                          {` · ${effect.duration} rodada(s)`}
                        </p>
                      ))}
                    </div>
                  )}
                  {orders[selected.id]?.type === "ATTACK" && (
                    <p className="mt-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 text-xs text-orange-200">
                      Clique em um inimigo dentro da área vermelha para definir
                      o alvo. Sem alvo manual, a postura escolherá o melhor alvo
                      válido.
                    </p>
                  )}
                  {orders[selected.id]?.x != null && (
                    <p className="mt-2 rounded-lg bg-[#FFCB05]/10 p-2 text-xs text-[#FFCB05]">
                      Destino: coluna {(orders[selected.id].x ?? 0) + 1}, linha{" "}
                      {(orders[selected.id].y ?? 0) + 1} · Ação:{" "}
                      {ACTIONS.find(
                        (action) => action.id === orders[selected.id].type,
                      )?.label ?? orders[selected.id].type}
                      .
                      {orders[selected.id].targetId && (
                        <>
                          {" "}
                          Alvo:{" "}
                          {
                            all.find(
                              (unit) =>
                                unit.id === orders[selected.id].targetId,
                            )?.name
                          }
                          .
                        </>
                      )}
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
                              ...(old[selected.id] ?? {
                                mascotId: selected.id,
                              }),
                              type: action.id,
                              mascotId: selected.id,
                            },
                          }))
                        }
                        className={`rounded-lg border p-2 text-xs ${orders[selected.id]?.type === action.id ? "border-[#FFCB05] bg-[#FFCB05]/10 text-[#FFCB05]" : "border-slate-700 text-slate-300"}`}
                      >
                        <b className="block">{action.label}</b>
                        <span className="mt-1 block text-left text-[10px] font-normal leading-relaxed opacity-75">
                          {action.detail}
                        </span>
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
                          {ACTIONS.find(
                            (action) =>
                              action.id === (orders[unit.id]?.type ?? "AUTO"),
                          )?.label ?? "Agir pela postura"}
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
