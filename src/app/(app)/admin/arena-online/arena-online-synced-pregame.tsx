"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { MascotOption } from "./arena-online-lab";
import type { LivePvpMatchValue } from "../../combates/arena-online/matchmaking-actions";
import {
  closeLivePvpMatchAction,
  chooseLivePvpCoinAction,
  chooseLivePvpFirstPlayerAction,
  getLivePvpMatchAction,
  submitLivePvpBanAction,
  submitLivePvpDraftAction,
} from "../../combates/arena-online/matchmaking-actions";

type Side = "A" | "B";
const TYPE_LABELS: Record<string, string> = {
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
function spriteFallback(
  event: React.SyntheticEvent<HTMLImageElement>,
  pokemonId: number,
) {
  const image = event.currentTarget;
  image.onerror = null;
  image.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

function MascotChip({ mascot }: { mascot: MascotOption }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2">
      <img
        src={mascot.spriteUrl}
        alt=""
        onError={(event) => spriteFallback(event, mascot.pokemonId)}
        className="h-10 w-10 object-contain [image-rendering:pixelated]"
      />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-white">
          {mascot.name}
        </p>
        <p className="text-[9px] text-slate-500">
          Nv.{mascot.level} ·{" "}
          {mascot.types.map((type) => TYPE_LABELS[type] ?? type).join(" / ")}
        </p>
      </div>
    </div>
  );
}

export function ArenaOnlineSyncedPregame({
  initialMatch,
  identity,
  mascots,
  onEvent,
  onComplete,
}: {
  initialMatch: LivePvpMatchValue;
  identity: { playerId: string; playerName: string };
  mascots: MascotOption[];
  onEvent: (event: string) => void;
  onComplete: (
    a: string[],
    b: string[],
    first: Side,
    remoteMascots?: MascotOption[],
  ) => void;
}) {
  const [match, setMatch] = useState(initialMatch);
  const [remoteMascots, setRemoteMascots] = useState<MascotOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [tag, setTag] = useState("ALL");
  const [page, setPage] = useState(1);
  const [seconds, setSeconds] = useState(30);
  const [coinAnimating, setCoinAnimating] = useState(false);
  const animatedCoinRevision = useRef<number | null>(null);
  const [pending, startTransition] = useTransition();
  const completedRevision = useRef<number | null>(null);
  const revisionRef = useRef(initialMatch.revision);
  const mascotPoolLoaded = useRef(false);
  const viewerSide: Side = identity.playerId === match.playerAId ? "A" : "B";
  const ownTeam = viewerSide === "A" ? match.teamAIds : match.teamBIds;
  const isMyTurn =
    (match.phase === "COIN_PICK" &&
      match.coinChooserId === identity.playerId) ||
    (match.phase === "FIRST_PICK" &&
      match.coinWinnerId === identity.playerId) ||
    (match.phase === "BAN" && match.banTurnId === identity.playerId) ||
    (match.phase === "DRAFT" && match.draftTurnId === identity.playerId);
  const allMascots = useMemo(() => {
    const map = new Map<string, MascotOption>();
    [...mascots, ...remoteMascots].forEach((mascot) =>
      map.set(mascot.id, mascot),
    );
    return [...map.values()];
  }, [mascots, remoteMascots]);
  const byId = (id: string) => allMascots.find((mascot) => mascot.id === id);
  const activePlayerId =
    match.phase === "COIN_PICK"
      ? match.coinChooserId
      : match.phase === "FIRST_PICK"
        ? match.coinWinnerId
        : match.phase === "BAN"
          ? match.banTurnId
          : match.phase === "DRAFT"
            ? match.draftTurnId
            : match.orderTurnId;
  const activePlayerName =
    activePlayerId === match.playerAId ? match.playerAName : match.playerBName;
  const waitingAction =
    match.phase === "COIN_PICK"
      ? `${activePlayerName} está escolhendo o lado da moeda.`
      : match.phase === "FIRST_PICK"
        ? `${activePlayerName} está escolhendo quem começa os bans.`
        : match.phase === "BAN"
          ? `${activePlayerName} está escolhendo um mascote adversário para banir.`
          : match.phase === "DRAFT"
            ? `${activePlayerName} está escolhendo ${match.draftQuota} mascote${match.draftQuota === 1 ? "" : "s"} para a equipe.`
            : "Preparando o combate.";

  const refresh = async (force = false, includeMascots = false) => {
    try {
      let state = await getLivePvpMatchAction(
        includeMascots,
        force ? undefined : revisionRef.current,
      );
      if (!state.match) return;
      if (
        !includeMascots &&
        !mascotPoolLoaded.current &&
        (state.match.phase === "BAN" || state.match.phase === "DRAFT")
      ) {
        state = await getLivePvpMatchAction(true);
        if (!state.match) return;
      }
      revisionRef.current = state.match.revision;
      setMatch(state.match);
      if (state.selectedMascots.length) {
        mascotPoolLoaded.current =
          state.match.phase === "BAN" || state.match.phase === "DRAFT";
        setRemoteMascots((current) => {
          const merged = new Map(current.map((mascot) => [mascot.id, mascot]));
          (state.selectedMascots as MascotOption[]).forEach((mascot) =>
            merged.set(mascot.id, mascot),
          );
          return [...merged.values()];
        });
      }
      setSeconds(
        Math.max(
          0,
          Math.ceil(
            (new Date(state.match.deadline).getTime() - Date.now()) / 1000,
          ),
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "A partida foi encerrada.",
      );
    }
  };
  useEffect(() => {
    void refresh(true, true);
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 1_500);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setSeconds(
          Math.max(
            0,
            Math.ceil((new Date(match.deadline).getTime() - Date.now()) / 1000),
          ),
        ),
      500,
    );
    return () => clearInterval(timer);
  }, [match.deadline]);
  useEffect(() => {
    if (
      !match.coinChoice ||
      match.phase !== "FIRST_PICK" ||
      animatedCoinRevision.current === match.revision
    )
      return;
    animatedCoinRevision.current = match.revision;
    setCoinAnimating(true);
    const timer = setTimeout(() => setCoinAnimating(false), 4200);
    return () => clearTimeout(timer);
  }, [match.coinChoice, match.phase, match.revision]);
  useEffect(() => {
    setSelected([]);
    setPage(1);
  }, [
    match.phase,
    match.banTurnId,
    match.draftTurnId,
    match.orderTurnId,
    ownTeam.join(","),
  ]);
  useEffect(() => {
    if (match.phase !== "READY" || completedRevision.current === match.revision)
      return;
    completedRevision.current = match.revision;
    onEvent(
      `PRÉ-JOGO ONLINE · ${match.playerAName} e ${match.playerBName} concluíram o draft sincronizado.`,
    );
    onComplete(
      match.teamAIds,
      match.teamBIds,
      match.firstPickerId === match.playerAId ? "A" : "B",
      remoteMascots,
    );
  }, [match.phase, match.revision, remoteMascots]);

  const act = (action: () => Promise<LivePvpMatchValue>) =>
    startTransition(async () => {
      try {
        const next = await action();
        revisionRef.current = next.revision;
        setMatch(next);
        if (
          !mascotPoolLoaded.current &&
          (next.phase === "BAN" || next.phase === "DRAFT")
        )
          await refresh(true, true);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Ação recusada pelo servidor.",
        );
      }
    });

  const bannedAgainstMe =
    viewerSide === "A" ? match.bansByBIds : match.bansByAIds;
  const opponentId = viewerSide === "A" ? match.playerBId : match.playerAId;
  const banPool = allMascots.filter((mascot) => mascot.ownerId === opponentId);
  const sourceMascots = match.phase === "BAN" ? banPool : mascots;
  const unavailableIds = new Set([
    ...ownTeam,
    ...match.bansByAIds,
    ...match.bansByBIds,
    ...bannedAgainstMe,
  ]);
  const available = sourceMascots.filter(
    (mascot) => !unavailableIds.has(mascot.id),
  );
  const types = [
    ...new Set(sourceMascots.flatMap((mascot) => mascot.types)),
  ].sort();
  const tags = [
    ...new Set(sourceMascots.map((mascot) => mascot.performanceTag)),
  ].sort();
  const strength = (mascot: MascotOption) =>
    mascot.statForce +
    mascot.statAgility +
    mascot.statCharisma +
    mascot.statInstinct +
    mascot.statVitality;
  const filtered = available
    .filter(
      (mascot) =>
        (!search || mascot.name.toLowerCase().includes(search.toLowerCase())) &&
        (type === "ALL" || mascot.types.includes(type)) &&
        (tag === "ALL" || mascot.performanceTag === tag),
    )
    .sort((a, b) => strength(b) - strength(a) || b.level - a.level);
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const visible = filtered.slice(
    (Math.min(page, pages) - 1) * 12,
    Math.min(page, pages) * 12,
  );
  const required =
    match.phase === "BAN" ? 1 : Math.min(match.draftQuota, 6 - ownTeam.length);

  return (
    <section className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-slate-950 to-cyan-500/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">
            Partida conectada · servidor autoritativo
          </p>
          <h2 className="text-lg font-black text-white">
            {match.playerAName} × {match.playerBName}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {match.phase !== "READY" && (
            <span className="font-pixel text-xl text-[#FFCB05]">
              {seconds}s
            </span>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await closeLivePvpMatchAction();
                window.location.reload();
              })
            }
            className="rounded-lg border border-red-500/35 px-3 py-2 text-[10px] font-bold text-red-300"
          >
            Cancelar partida
          </button>
        </div>
      </div>

      {(match.phase === "BAN" ||
        match.bansByAIds.length > 0 ||
        match.bansByBIds.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              [match.playerAName, match.bansByBIds, match.banLimitB],
              [match.playerBName, match.bansByAIds, match.banLimitA],
            ] as const
          ).map(([name, ids, limit]) => (
            <div
              key={name}
              className="rounded-xl border border-red-500/25 bg-red-500/5 p-3"
            >
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-red-300">
                Banidos de {name} · {ids.length}/{limit}
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[...ids]
                  .sort((a, b) => {
                    const first = byId(a),
                      second = byId(b);
                    return first && second
                      ? strength(second) - strength(first)
                      : 0;
                  })
                  .map((id) =>
                    byId(id) ? (
                      <MascotChip key={id} mascot={byId(id)!} />
                    ) : (
                      <div
                        key={id}
                        className="rounded-lg border border-red-500/20 bg-red-950/20 p-2 text-[9px] text-red-200"
                      >
                        Mascote banido indisponível
                      </div>
                    ),
                  )}
                {!ids.length && (
                  <span className="text-[10px] text-slate-600">
                    Nenhum ban confirmado.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(["A", "B"] as const).map((side) => {
          const name = side === "A" ? match.playerAName : match.playerBName;
          const ids = side === "A" ? match.teamAIds : match.teamBIds;
          return (
            <div
              key={side}
              className={`rounded-xl border p-3 ${side === viewerSide ? "border-cyan-500/40 bg-cyan-500/5" : "border-slate-800 bg-slate-950/60"}`}
            >
              <div className="mb-2 flex items-center justify-between">
                <b className="text-xs text-white">{name}</b>
                <span className="text-[10px] text-slate-500">
                  {ids.length}/6 travados
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ids.map((id) =>
                  byId(id) ? (
                    <MascotChip key={id} mascot={byId(id)!} />
                  ) : (
                    <div
                      key={id}
                      className="h-14 animate-pulse rounded-lg bg-slate-900"
                    />
                  ),
                )}
                {!ids.length && (
                  <p className="col-span-full py-3 text-center text-[10px] text-slate-600">
                    Nenhuma escolha confirmada.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {coinAnimating && (
        <div className="overflow-hidden py-10 text-center [perspective:900px]">
          <div
            className={`coin-sync coin-${match.coinResult.toLowerCase()} relative mx-auto h-28 w-28 [transform-style:preserve-3d]`}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-yellow-100 bg-gradient-to-br from-yellow-100 via-[#FFCB05] to-amber-600 text-amber-950 shadow-[0_0_45px_rgba(255,203,5,.55)] [backface-visibility:hidden]">
              <span className="text-4xl">⚡</span>
              <b className="text-[10px] tracking-[.18em]">CARA</b>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-amber-200 bg-gradient-to-br from-amber-300 via-orange-400 to-amber-800 text-amber-950 shadow-[0_0_45px_rgba(251,146,60,.5)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <span className="text-4xl">♛</span>
              <b className="text-[10px] tracking-[.18em]">COROA</b>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-300">
            Moeda lançada por{" "}
            {match.coinChooserId === match.playerAId
              ? match.playerAName
              : match.playerBName}
            ...
          </p>
          <p className="mt-2 text-sm font-bold text-cyan-200">
            Escolha: {match.coinChoice}
          </p>
          <p className="mt-2 text-lg font-black text-[#FFCB05]">
            Resultado: {match.coinResult}
          </p>
          <style jsx>{`
            @keyframes coinSyncCara {
              0% {
                transform: translateY(30px) rotateY(0) scale(0.8);
              }
              45% {
                transform: translateY(-65px) rotateY(900deg) scale(1.12);
              }
              100% {
                transform: translateY(0) rotateY(1800deg) scale(1);
              }
            }
            @keyframes coinSyncCoroa {
              0% {
                transform: translateY(30px) rotateY(0) scale(0.8);
              }
              45% {
                transform: translateY(-65px) rotateY(990deg) scale(1.12);
              }
              100% {
                transform: translateY(0) rotateY(1980deg) scale(1);
              }
            }
            .coin-cara {
              animation: coinSyncCara 1.8s cubic-bezier(0.2, 0.7, 0.2, 1)
                forwards;
            }
            .coin-coroa {
              animation: coinSyncCoroa 1.8s cubic-bezier(0.2, 0.7, 0.2, 1)
                forwards;
            }
          `}</style>
        </div>
      )}
      {!coinAnimating && !isMyTurn && match.phase !== "READY" && (
        <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-8 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          <p className="font-bold text-cyan-100">{waitingAction}</p>
          <p className="mt-1 text-xs text-slate-400">
            A tela será atualizada automaticamente quando a escolha for travada.
          </p>
        </div>
      )}

      {!coinAnimating && isMyTurn && match.phase === "COIN_PICK" && (
        <div className="mt-5 text-center">
          <p className="text-sm text-white">
            {identity.playerName}, escolha o lado da moeda.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {(["CARA", "COROA"] as const).map((face) => (
              <button
                key={face}
                disabled={pending}
                onClick={() => act(() => chooseLivePvpCoinAction(face))}
                className="rounded-xl border border-[#FFCB05] bg-[#FFCB05]/10 px-8 py-4 font-black text-[#FFCB05]"
              >
                {face}
              </button>
            ))}
          </div>
        </div>
      )}

      {!coinAnimating && isMyTurn && match.phase === "FIRST_PICK" && (
        <div className="mt-5 text-center">
          <p className="text-sm text-white">
            Você venceu a moeda ({match.coinResult}). Quem começa os bans e o
            draft?
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              disabled={pending}
              onClick={() =>
                act(() => chooseLivePvpFirstPlayerAction(identity.playerId))
              }
              className="rounded-lg bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950"
            >
              Eu começo
            </button>
            <button
              disabled={pending}
              onClick={() =>
                act(() =>
                  chooseLivePvpFirstPlayerAction(
                    identity.playerId === match.playerAId
                      ? match.playerBId
                      : match.playerAId,
                  ),
                )
              }
              className="rounded-lg border border-slate-700 px-5 py-2 text-xs font-bold text-white"
            >
              Adversário começa
            </button>
          </div>
        </div>
      )}

      {!coinAnimating &&
        isMyTurn &&
        (match.phase === "BAN" || match.phase === "DRAFT") && (
          <div className="mt-4">
            <p className="text-center text-sm text-white">
              {match.phase === "BAN"
                ? "Escolha um mascote da equipe adversária para banir."
                : `Escolha ${required} mascote(s) da sua conta.`}
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_180px]">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar mascote..."
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
              <select
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="ALL">Todos os tipos</option>
                {types.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
              <select
                value={tag}
                onChange={(event) => {
                  setTag(event.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="ALL">Todas as tags</option>
                {tags.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
              {visible.map((mascot) => (
                <button
                  key={mascot.id}
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(mascot.id)
                        ? current.filter((id) => id !== mascot.id)
                        : current.length < required
                          ? [...current, mascot.id]
                          : current,
                    )
                  }
                  className={`rounded-xl border p-3 text-left ${selected.includes(mascot.id) ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950"}`}
                >
                  <img
                    src={mascot.spriteUrl}
                    alt=""
                    onError={(event) => spriteFallback(event, mascot.pokemonId)}
                    className="mx-auto h-14 w-14 object-contain [image-rendering:pixelated]"
                  />
                  <b className="block truncate text-[10px] text-white">
                    {mascot.name}
                  </b>
                  <span className="text-[9px] text-slate-500">
                    Nv.{mascot.level} ·{" "}
                    {mascot.types
                      .map((entry) => TYPE_LABELS[entry] ?? entry)
                      .join(" / ")}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
              <span>
                Página {Math.min(page, pages)} de {pages}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded border border-slate-700 px-3 py-1 disabled:opacity-30"
                >
                  Anterior
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded border border-slate-700 px-3 py-1 disabled:opacity-30"
                >
                  Próxima
                </button>
              </div>
            </div>
            <button
              disabled={pending || selected.length !== required}
              onClick={() =>
                act(() =>
                  match.phase === "BAN"
                    ? submitLivePvpBanAction(selected[0])
                    : submitLivePvpDraftAction(selected),
                )
              }
              className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-35 ${match.phase === "BAN" ? "bg-red-500 text-white" : "bg-[#FFCB05] text-slate-950"}`}
            >
              {match.phase === "BAN"
                ? `Confirmar ban ${selected.length}/1`
                : `Travar ${selected.length}/${required} escolha(s)`}
            </button>
          </div>
        )}

      {match.phase === "READY" && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center font-bold text-emerald-200">
          Draft sincronizado concluído. Preparando o combate...
        </div>
      )}
      {!!match.events.length && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Ações sincronizadas
          </p>
          <div className="space-y-1">
            {match.events.slice(-6).map((event, index) => (
              <p
                key={`${match.revision}-${index}-${event}`}
                className="rounded border border-slate-800 bg-slate-900 px-2 py-1.5 text-[11px] text-cyan-100"
              >
                {event}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
