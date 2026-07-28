"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { LivePvpMatchValue } from "../../combates/arena-online/matchmaking-actions";
import {
  closeLivePvpMatchAction,
  getLivePvpMatchAction,
  initializeLivePvpBattleAction,
  submitLivePvpBattleAction,
  surrenderLivePvpBattleAction,
} from "../../combates/arena-online/matchmaking-actions";

function spriteFallback(
  event: React.SyntheticEvent<HTMLImageElement>,
  pokemonId: number,
) {
  const image = event.currentTarget;
  image.onerror = null;
  image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

const TYPES: Record<string, string> = {
  normal: "Normal",
  fire: "Fogo",
  water: "Água",
  electric: "Elétrico",
  grass: "Planta",
  ice: "Gelo",
  fighting: "Lutador",
  poison: "Veneno",
  ground: "Terra",
  flying: "Voador",
  psychic: "Psíquico",
  bug: "Inseto",
  rock: "Pedra",
  ghost: "Fantasma",
  dragon: "Dragão",
  dark: "Sombrio",
  steel: "Aço",
  fairy: "Fada",
};

export function ArenaOnlineSyncedBattle({
  identity,
}: {
  identity: { playerId: string; playerName: string };
}) {
  const [match, setMatch] = useState<LivePvpMatchValue | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [pending, startTransition] = useTransition();
  const logRef = useRef<HTMLDivElement>(null);
  const timeoutHandledRef = useRef("");
  const refreshingRef = useRef(false);
  const refresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const state = await getLivePvpMatchAction(false);
      setMatch(state.match);
      if (!state.match.battle) {
        await initializeLivePvpBattleAction();
        setMatch((await getLivePvpMatchAction(false)).match);
      }
    } finally {
      refreshingRef.current = false;
    }
  };
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 1200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [match?.battle?.logs.length]);
  useEffect(() => {
    if (!match?.battle) return;
    const update = () =>
      setSeconds(
        Math.max(
          0,
          Math.ceil(
            (new Date(match.battle!.deadline).getTime() - Date.now()) / 1000,
          ),
        ),
      );
    update();
    const timer = setInterval(update, 500);
    return () => clearInterval(timer);
  }, [match?.battle?.deadline]);
  useEffect(() => {
    const battle = match?.battle;
    if (!battle || battle.winnerId || seconds > 0) return;
    const sideA = identity.playerId === match.playerAId;
    if (sideA ? battle.pendingA : battle.pendingB) return;
    const activeId = sideA ? battle.activeAId : battle.activeBId;
    const move = (battle.moves[activeId] ?? []).find(
      (entry) => (battle.pp[activeId]?.[entry.id] ?? 0) > 0,
    );
    if (!move) return;
    const key = `${battle.deadline}:${identity.playerId}`;
    if (timeoutHandledRef.current === key) return;
    timeoutHandledRef.current = key;
    void submitLivePvpBattleAction({ type: "MOVE", moveId: move.id })
      .then(refresh)
      .catch(() => refresh());
  }, [seconds, match, identity.playerId]);
  if (!match?.battle)
    return (
      <div className="rounded-xl border border-cyan-500/25 p-8 text-center text-cyan-200">
        Preparando golpes e equipes no servidor...
      </div>
    );
  const battle = match.battle;
  const sideA = identity.playerId === match.playerAId;
  const ownPending = sideA ? battle.pendingA : battle.pendingB;
  const myTurn = !ownPending && !battle.winnerId;
  const activeA = battle.teamA.find((f) => f.id === battle.activeAId)!;
  const activeB = battle.teamB.find((f) => f.id === battle.activeBId)!;
  const act = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await fn();
        await refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ação recusada.");
      }
    });
  const choose = (action: Parameters<typeof submitLivePvpBattleAction>[0]) => {
    setMatch((current) => {
      if (!current?.battle) return current;
      const next = structuredClone(current);
      if (identity.playerId === next.playerAId) next.battle!.pendingA = action;
      else next.battle!.pendingB = action;
      return next;
    });
    act(() => submitLivePvpBattleAction(action));
  };
  const card = (fighter: typeof activeA, name: string) => (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="mb-2 text-xs font-bold text-cyan-200">{name}</p>
      <div className="flex flex-col items-center text-center">
        <img
          src={fighter.spriteUrl}
          alt=""
          onError={(event) => spriteFallback(event, fighter.pokemonId)}
          className="h-28 w-28 object-contain [image-rendering:pixelated]"
        />
        <b className="mt-1 text-white">
          {fighter.name} · Nv.{fighter.level}
        </b>
        <div className="mt-2 flex gap-1">
          {fighter.types.map((type) => (
            <span
              key={type}
              className="rounded-full border border-slate-700 px-2 py-1 text-[9px] text-slate-300"
            >
              {TYPES[type] ?? type}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex justify-between text-[10px]">
        <span className="text-slate-500">HP</span>
        <b>
          {fighter.hp}/{fighter.maxHp}
        </b>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800">
        <div
          className="h-full bg-emerald-400"
          style={{
            width: `${Math.max(0, (fighter.hp / fighter.maxHp) * 100)}%`,
          }}
        />
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[9px] text-slate-500">
        {[
          ["FOR", fighter.force],
          ["AGI", fighter.agility],
          ["CAR", fighter.charisma],
          ["INS", fighter.instinct],
          ["VIT", fighter.vitality],
        ].map(([label, value]) => (
          <span key={label}>
            {label}
            <b className="block text-white">{value}</b>
          </span>
        ))}
      </div>
    </div>
  );
  const battlePanel = (
    fighter: typeof activeA,
    team: typeof battle.teamA,
    owned: boolean,
  ) => (
    <div className="space-y-3">
      <div className="grid gap-2">
        {(battle.moves[fighter.id] ?? []).map((move) => (
          <button
            key={move.id}
            type="button"
            disabled={
              !owned ||
              !myTurn ||
              pending ||
              (battle.pp[fighter.id]?.[move.id] ?? 0) <= 0
            }
            onClick={() => owned && choose({ type: "MOVE", moveId: move.id })}
            className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-left text-xs disabled:cursor-default disabled:opacity-70"
          >
            <b>{move.name}</b>
            <span className="ml-2 text-slate-500">
              Poder {move.power ?? 0} · Precisão {move.accuracy ?? "—"}
              {move.accuracy != null ? "%" : ""} · PP{" "}
              {battle.pp[fighter.id]?.[move.id] ?? 0}/{move.pp}
            </span>
            <p className="mt-1 text-[10px] text-slate-400">{move.effect}</p>
          </button>
        ))}
      </div>
      <div>
        <p className="mb-2 text-[10px] uppercase text-slate-500">
          {owned ? "Trocar consome a ação" : "Equipe visível do adversário"}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {team.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={
                !owned ||
                !myTurn ||
                pending ||
                entry.hp <= 0 ||
                entry.id === fighter.id
              }
              onClick={() =>
                owned && choose({ type: "SWITCH", mascotId: entry.id })
              }
              className="rounded-lg border border-slate-700 p-2 text-[10px] disabled:cursor-default disabled:opacity-50"
            >
              <img
                src={entry.spriteUrl}
                alt=""
                loading="lazy"
                onError={(event) => spriteFallback(event, entry.pokemonId)}
                className="mx-auto h-12 w-12 object-contain"
              />
              <b className="block truncate">{entry.name}</b>
              <span>
                {entry.hp}/{entry.maxHp}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  return (
    <section className="space-y-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-cyan-300">
            Combate online sincronizado
          </p>
          <h2 className="font-bold text-white">
            Round {battle.round} · {match.playerAName} × {match.playerBName}
          </h2>
        </div>
        <span className="text-right text-xs text-slate-400">
          {battle.winnerId
            ? `${battle.winnerId === match.playerAId ? match.playerAName : match.playerBName} venceu`
            : myTurn
              ? "Sua vez"
              : `Ação confirmada · aguardando ${sideA ? match.playerBName : match.playerAName}`}
          {!battle.winnerId && (
            <b className="ml-3 font-pixel text-lg text-[#FFCB05]">{seconds}s</b>
          )}
        </span>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {card(activeA, match.playerAName)}
          {battlePanel(activeA, battle.teamA, sideA)}
        </div>
        <div className="space-y-4">
          {card(activeB, match.playerBName)}
          {battlePanel(activeB, battle.teamB, !sideA)}
        </div>
      </div>
      {!myTurn && !battle.winnerId && (
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-center text-xs text-cyan-100">
          Sua ação foi registrada. Aguardando a escolha de{" "}
          {sideA ? match.playerBName : match.playerAName}.
        </div>
      )}
      <div
        ref={logRef}
        className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3"
      >
        {battle.logs.map((log, index) => (
          <p
            key={`${index}-${log}`}
            className="rounded bg-slate-900 px-2 py-1 text-[11px] text-slate-300"
          >
            {log}
          </p>
        ))}
      </div>
      {!battle.winnerId && (
        <button
          disabled={pending}
          onClick={() => act(surrenderLivePvpBattleAction)}
          className="w-full rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300"
        >
          Desistir
        </button>
      )}
      {battle.winnerId && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await closeLivePvpMatchAction();
              window.location.reload();
            })
          }
          className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-200"
        >
          Encerrar partida e voltar ao lobby
        </button>
      )}
    </section>
  );
}
