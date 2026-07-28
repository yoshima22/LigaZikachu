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
  const [pending, startTransition] = useTransition();
  const logRef = useRef<HTMLDivElement>(null);
  const refresh = async () => {
    const state = await getLivePvpMatchAction();
    setMatch(state.match);
    if (!state.match.battle) setMatch(await initializeLivePvpBattleAction());
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
  if (!match?.battle)
    return (
      <div className="rounded-xl border border-cyan-500/25 p-8 text-center text-cyan-200">
        Preparando golpes e equipes no servidor...
      </div>
    );
  const battle = match.battle;
  const sideA = identity.playerId === match.playerAId;
  const myTurn = battle.choiceTurnId === identity.playerId && !battle.winnerId;
  const activeA = battle.teamA.find((f) => f.id === battle.activeAId)!;
  const activeB = battle.teamB.find((f) => f.id === battle.activeBId)!;
  const act = (fn: () => Promise<LivePvpMatchValue>) =>
    startTransition(async () => {
      try {
        setMatch(await fn());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Ação recusada.");
      }
    });
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
  const mine = sideA ? activeA : activeB;
  const myTeam = sideA ? battle.teamA : battle.teamB;
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
        <span className="text-xs text-slate-400">
          {battle.winnerId
            ? `${battle.winnerId === match.playerAId ? match.playerAName : match.playerBName} venceu`
            : myTurn
              ? "Sua vez"
              : `Aguardando ${battle.choiceTurnId === match.playerAId ? match.playerAName : match.playerBName}`}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {card(activeA, match.playerAName)}
        {card(activeB, match.playerBName)}
      </div>
      {myTurn && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-2">
            {battle.moves[mine.id].map((move) => (
              <button
                key={move.id}
                disabled={pending || (battle.pp[mine.id]?.[move.id] ?? 0) <= 0}
                onClick={() =>
                  act(() =>
                    submitLivePvpBattleAction({
                      type: "MOVE",
                      moveId: move.id,
                    }),
                  )
                }
                className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-left text-xs"
              >
                <b>{move.name}</b>
                <span className="ml-2 text-slate-500">
                  Poder {move.power ?? 0} · Precisão {move.accuracy ?? "—"}
                  {move.accuracy != null ? "%" : ""} · PP{" "}
                  {battle.pp[mine.id]?.[move.id] ?? 0}/{move.pp}
                </span>
                <p className="mt-1 text-[10px] text-slate-400">{move.effect}</p>
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 text-[10px] uppercase text-slate-500">
              Trocar consome a ação
            </p>
            <div className="grid grid-cols-3 gap-2">
              {myTeam.map((fighter) => (
                <button
                  key={fighter.id}
                  disabled={
                    pending || fighter.hp <= 0 || fighter.id === mine.id
                  }
                  onClick={() =>
                    act(() =>
                      submitLivePvpBattleAction({
                        type: "SWITCH",
                        mascotId: fighter.id,
                      }),
                    )
                  }
                  className="rounded-lg border border-slate-700 p-2 text-[10px] disabled:opacity-30"
                >
                  <img
                    src={fighter.spriteUrl}
                    alt=""
                    onError={(event) =>
                      spriteFallback(event, fighter.pokemonId)
                    }
                    className="mx-auto h-12 w-12 object-contain"
                  />
                  <b className="block truncate">{fighter.name}</b>
                  <span>
                    {fighter.hp}/{fighter.maxHp}
                  </span>
                </button>
              ))}
            </div>
          </div>
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
