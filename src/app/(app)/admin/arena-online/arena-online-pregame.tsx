"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { MascotOption } from "./arena-online-lab";
import { loadLivePvpMovesAction } from "./actions";
import {
  getLivePvpLobbyAction,
  joinLivePvpQueueAction,
  leaveLivePvpQueueAction,
} from "../../combates/arena-online/matchmaking-actions";
import { ArenaOnlineSyncedPregame } from "./arena-online-synced-pregame";

type Side = "A" | "B";
type Stage =
  | "LOBBY"
  | "COIN_PICK"
  | "COIN_FLIP"
  | "FIRST"
  | "DRAFT"
  | "LEADS"
  | "DONE";
const other = (side: Side): Side => (side === "A" ? "B" : "A");

export function ArenaOnlinePregame({
  mascots,
  onComplete,
  onEvent,
  onlineIdentity,
}: {
  mascots: MascotOption[];
  onComplete: (
    a: string[],
    b: string[],
    first: Side,
    remoteMascots?: MascotOption[],
  ) => void;
  onEvent: (event: string) => void;
  onlineIdentity?: { playerId: string; playerName: string };
}) {
  const [stage, setStage] = useState<Stage>("LOBBY");
  const [queue, setQueue] = useState(0);
  const [nick, setNick] = useState("");
  const [queuePending, setQueuePending] = useState(false);
  const [onlineMatch, setOnlineMatch] =
    useState<Awaited<ReturnType<typeof getLivePvpLobbyAction>>["match"]>(null);
  const [serverCoinResult, setServerCoinResult] = useState<
    "CARA" | "COROA" | null
  >(null);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftType, setDraftType] = useState("ALL");
  const [draftTag, setDraftTag] = useState("ALL");
  const [draftPage, setDraftPage] = useState(1);
  const [seconds, setSeconds] = useState(30);
  const [coinChooser, setCoinChooser] = useState<Side>("A");
  const [face, setFace] = useState<"CARA" | "COROA" | null>(null);
  const [coinResult, setCoinResult] = useState<"CARA" | "COROA" | null>(null);
  const [coinWinner, setCoinWinner] = useState<Side | null>(null);
  const [first, setFirst] = useState<Side>("A");
  const [draftTurn, setDraftTurn] = useState<Side>("A");
  const [quota, setQuota] = useState(1);
  const [pickedThisTurn, setPickedThisTurn] = useState<string[]>([]);
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [leadTurn, setLeadTurn] = useState<Side>("A");
  const [orderA, setOrderA] = useState<string[]>([]);
  const [orderB, setOrderB] = useState<string[]>([]);
  const [orderConfirmed, setOrderConfirmed] = useState({ A: false, B: false });
  const [draftMoves, setDraftMoves] = useState<
    Record<
      string,
      NonNullable<Awaited<ReturnType<typeof loadLivePvpMovesAction>>["moves"]>
    >
  >({});
  const resetTimer = () => setSeconds(30);
  const start = (match = onlineMatch) => {
    const chooser: Side =
      match && onlineIdentity
        ? match.coinChooserId === match.playerAId
          ? "A"
          : "B"
        : Math.random() < 0.5
          ? "A"
          : "B";
    if (match) setServerCoinResult(match.coinResult);
    setCoinChooser(chooser);
    setStage("COIN_PICK");
    resetTimer();
    onEvent(
      `PRÉ-JOGO · Jogador ${chooser} foi sorteado para escolher a moeda.`,
    );
  };
  const players = useMemo(
    () => Array.from(new Set(mascots.map((m) => m.ownerName))),
    [mascots],
  );
  const refreshLobby = async () => {
    if (!onlineIdentity) return;
    try {
      const state = await getLivePvpLobbyAction();
      setQueue(state.queueCount);
      if (state.match && !onlineMatch) {
        setOnlineMatch(state.match);
        onEvent(
          `MATCHMAKING · ${state.match.playerAName} e ${state.match.playerBName} foram conectados pelo servidor.`,
        );
      }
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => {
    if (!onlineIdentity || stage !== "LOBBY") return;
    void refreshLobby();
    const timer = setInterval(() => void refreshLobby(), 3_000);
    return () => clearInterval(timer);
  }, [onlineIdentity, stage, onlineMatch]);
  const joinQueue = async (direct = false) => {
    setQueuePending(true);
    try {
      const state = await joinLivePvpQueueAction(direct ? nick : undefined);
      setQueue(state.queueCount);
      if (state.match) {
        setOnlineMatch(state.match);
      } else {
        toast.success(
          direct
            ? "Desafio enviado. Aguardando busca recíproca."
            : "Você entrou na fila pública.",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar na fila.",
      );
    } finally {
      setQueuePending(false);
    }
  };
  const pool = mascots.filter(
    (m) => !(teamA.includes(m.id) || teamB.includes(m.id)),
  );
  const draftTypes = useMemo(
    () => [...new Set(mascots.flatMap((mascot) => mascot.types))].sort(),
    [mascots],
  );
  const draftTags = useMemo(
    () => [...new Set(mascots.map((mascot) => mascot.performanceTag))].sort(),
    [mascots],
  );
  const filteredPool = pool.filter((mascot) => {
    const query = draftSearch.trim().toLowerCase();
    return (
      (!query ||
        mascot.name.toLowerCase().includes(query) ||
        mascot.ownerName.toLowerCase().includes(query)) &&
      (draftType === "ALL" || mascot.types.includes(draftType)) &&
      (draftTag === "ALL" || mascot.performanceTag === draftTag)
    );
  });
  const draftPageSize = 12;
  const draftPageCount = Math.max(
    1,
    Math.ceil(filteredPool.length / draftPageSize),
  );
  const paginatedPool = filteredPool.slice(
    (Math.min(draftPage, draftPageCount) - 1) * draftPageSize,
    Math.min(draftPage, draftPageCount) * draftPageSize,
  );
  useEffect(
    () => setDraftPage(1),
    [draftSearch, draftType, draftTag, draftTurn],
  );
  const auto = () => {
    if (stage === "COIN_PICK") {
      setFace(Math.random() < 0.5 ? "CARA" : "COROA");
      flip();
    } else if (stage === "FIRST" && coinWinner) {
      chooseFirst(Math.random() < 0.5 ? coinWinner : other(coinWinner));
    } else if (stage === "DRAFT") {
      const need = Math.min(
        quota - pickedThisTurn.length,
        6 - (draftTurn === "A" ? teamA.length : teamB.length),
      );
      confirmDraft([
        ...pickedThisTurn,
        ...pool.slice(0, need).map((m) => m.id),
      ]);
    } else if (stage === "LEADS") {
      confirmOrder();
    }
  };
  useEffect(() => {
    if (["LOBBY", "COIN_FLIP", "DONE"].includes(stage)) return;
    const timer = setTimeout(
      () => (seconds > 1 ? setSeconds((value) => value - 1) : auto()),
      1000,
    );
    return () => clearTimeout(timer);
  });
  const flip = () => {
    const chosen = face ?? (Math.random() < 0.5 ? "CARA" : "COROA");
    if (!face) setFace(chosen);
    setStage("COIN_FLIP");
    onEvent(`MOEDA · Jogador ${coinChooser} escolheu ${chosen}.`);
    setTimeout(() => {
      const result =
        serverCoinResult ?? (Math.random() < 0.5 ? "CARA" : "COROA");
      const winner = result === chosen ? coinChooser : other(coinChooser);
      setCoinResult(result);
      setCoinWinner(winner);
      setStage("FIRST");
      resetTimer();
      onEvent(
        `MOEDA · Resultado ${result}. Jogador ${winner} venceu o sorteio.`,
      );
    }, 1800);
  };
  const chooseFirst = (side: Side) => {
    setFirst(side);
    setDraftTurn(side);
    setQuota(1);
    setStage("DRAFT");
    resetTimer();
    onEvent(`DRAFT · Jogador ${side} fará a primeira seleção.`);
  };
  const toggleDraft = (id: string) =>
    setPickedThisTurn((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length <
            Math.min(
              quota,
              6 - (draftTurn === "A" ? teamA.length : teamB.length),
            )
          ? [...current, id]
          : current,
    );
  const confirmDraft = (picks = pickedThisTurn) => {
    if (!picks.length) return;
    onEvent(
      `DRAFT · Jogador ${draftTurn} escolheu ${picks.map((id) => mascots.find((m) => m.id === id)?.name ?? id).join(", ")}.`,
    );
    const nextA = draftTurn === "A" ? [...teamA, ...picks] : teamA;
    const nextB = draftTurn === "B" ? [...teamB, ...picks] : teamB;
    setTeamA(nextA);
    setTeamB(nextB);
    setPickedThisTurn([]);
    if (nextA.length >= 6 && nextB.length >= 6) {
      setOrderA(nextA);
      setOrderB(nextB);
      setLeadTurn(first);
      setStage("LEADS");
      resetTimer();
      return;
    }
    const next = other(draftTurn);
    setDraftTurn(next);
    setQuota(Math.min(2, 6 - (next === "A" ? nextA.length : nextB.length)));
    resetTimer();
  };
  const reorder = (side: Side, index: number, direction: -1 | 1) => {
    const order = side === "A" ? orderA : orderB;
    const setter = side === "A" ? setOrderA : setOrderB;
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setter(next);
  };
  const confirmOrder = () => {
    const current = leadTurn === "A" ? orderA : orderB;
    if (current.length !== 6) return;
    onEvent(
      `ORDEM SECRETA · Jogador ${leadTurn} confirmou inicial e sequência completa.`,
    );
    const confirmed = { ...orderConfirmed, [leadTurn]: true };
    setOrderConfirmed(confirmed);
    if (!confirmed.A || !confirmed.B) {
      setLeadTurn(other(leadTurn));
      resetTimer();
      return;
    }
    const orderedA = orderA;
    const orderedB = orderB;
    const finalA = orderedA[0],
      finalB = orderedB[0];
    onEvent(
      `REVELAÇÃO · ${mascots.find((m) => m.id === finalA)?.name} enfrenta ${mascots.find((m) => m.id === finalB)?.name}.`,
    );
    onComplete(orderedA, orderedB, first);
    setStage("DONE");
  };
  const inspect = async (m: MascotOption) => {
    if (draftMoves[m.id]) return;
    const result = await loadLivePvpMovesAction(m.pokemonId, m.level);
    setDraftMoves((current) => ({
      ...current,
      [m.id]:
        result.moves?.filter((move) =>
          (result.recommendedIds ?? []).includes(move.id),
        ) ?? [],
    }));
  };
  useEffect(() => {
    if (stage !== "LEADS") return;
    for (const id of [...orderA, ...orderB]) {
      const mascot = mascots.find((m) => m.id === id);
      if (mascot && !draftMoves[id]) void inspect(mascot);
    }
  }, [stage, orderA, orderB]);
  if (onlineIdentity && onlineMatch) {
    return (
      <ArenaOnlineSyncedPregame
        initialMatch={onlineMatch}
        identity={onlineIdentity}
        mascots={mascots}
        onEvent={onEvent}
        onComplete={onComplete}
      />
    );
  }
  return (
    <section className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-slate-950 to-cyan-500/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-purple-300">
            Pré-jogo online · sandbox
          </p>
          <h2 className="text-lg font-black text-white">
            Fluxo de matchmaking e draft
          </h2>
        </div>
        {stage !== "LOBBY" && stage !== "DONE" && (
          <span className="font-pixel text-xl text-[#FFCB05]">{seconds}s</span>
        )}
      </div>
      {stage === "LOBBY" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-cyan-500/25 bg-slate-950/70 p-4">
            <p className="font-bold text-white">Fila pública</p>
            <p className="mt-1 text-xs text-slate-400">
              <b className="text-cyan-300">{queue}</b> jogador(es) procurando
              partida neste teste.
            </p>
            <button
              disabled={queuePending}
              onClick={() => (onlineIdentity ? void joinQueue(false) : start())}
              className="mt-3 w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950"
            >
              {onlineIdentity
                ? "Procurar adversário real"
                : "Procurar adversário"}
            </button>
            {onlineIdentity && (
              <button
                type="button"
                disabled={queuePending}
                onClick={async () => {
                  setQueuePending(true);
                  try {
                    const state = await leaveLivePvpQueueAction();
                    setQueue(state.queueCount);
                    toast.success("Você saiu da fila.");
                  } finally {
                    setQueuePending(false);
                  }
                }}
                className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-2 text-[10px] text-slate-300 disabled:opacity-40"
              >
                Sair da fila
              </button>
            )}
          </div>
          <div className="rounded-xl border border-purple-500/25 bg-slate-950/70 p-4">
            <p className="font-bold text-white">Desafio direto</p>
            <input
              value={nick}
              onChange={(event) => setNick(event.target.value)}
              placeholder="Digite o nick..."
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
            <p className="mt-1 text-[10px] text-slate-500">
              {onlineIdentity
                ? "A partida começa quando os dois jogadores buscam um pelo outro."
                : `Sandbox disponível: ${players.join(", ") || "admins locais"}`}
            </p>
            <button
              disabled={!nick.trim() || queuePending}
              onClick={() => (onlineIdentity ? void joinQueue(true) : start())}
              className="mt-3 w-full rounded-lg bg-purple-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-35"
            >
              {onlineIdentity ? "Buscar jogador" : "Simular busca simultânea"}
            </button>
          </div>
        </div>
      )}
      {stage === "COIN_PICK" && (
        <div className="mt-5 text-center">
          <p className="text-sm text-slate-300">
            Jogador <b className="text-white">{coinChooser}</b> foi sorteado
            para escolher.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            {(["CARA", "COROA"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setFace(value)}
                className={`rounded-xl border px-8 py-4 font-black ${face === value ? "border-[#FFCB05] bg-[#FFCB05]/15 text-[#FFCB05]" : "border-slate-700 text-slate-300"}`}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            disabled={!face}
            onClick={flip}
            className="mt-4 rounded-lg bg-[#FFCB05] px-6 py-2 text-sm font-bold text-slate-950 disabled:opacity-35"
          >
            Lançar moeda
          </button>
        </div>
      )}
      {stage === "COIN_FLIP" && (
        <div className="overflow-hidden py-12 text-center [perspective:900px]">
          <div className="coin-flight relative mx-auto h-28 w-28 [transform-style:preserve-3d]">
            <div className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-yellow-200 bg-gradient-to-br from-yellow-200 via-[#FFCB05] to-amber-600 text-4xl shadow-[0_0_45px_rgba(255,203,5,.55)] [backface-visibility:hidden]">
              ⚡
            </div>
            <div className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-amber-200 bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 text-2xl font-black text-amber-950 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              LZ
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-300">A moeda está no ar...</p>
          <style jsx>{`
            @keyframes coinFlight {
              0% {
                transform: translateY(35px) rotateY(0) rotateX(10deg) scale(0.8);
              }
              45% {
                transform: translateY(-70px) rotateY(900deg) rotateX(35deg)
                  scale(1.12);
              }
              100% {
                transform: translateY(0) rotateY(1800deg) rotateX(0) scale(1);
              }
            }
            .coin-flight {
              animation: coinFlight 1.8s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
            }
          `}</style>
        </div>
      )}
      {stage === "FIRST" && coinWinner && (
        <div className="mt-5 text-center">
          <p className="text-xl font-black text-[#FFCB05]">
            {coinResult}! Jogador {coinWinner} venceu.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Escolha quem fará a primeira seleção.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => chooseFirst(coinWinner)}
              className="rounded-lg bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950"
            >
              Eu começo
            </button>
            <button
              onClick={() => chooseFirst(other(coinWinner))}
              className="rounded-lg border border-slate-700 px-5 py-2 text-xs font-bold text-white"
            >
              Adversário começa
            </button>
          </div>
        </div>
      )}
      {stage === "DRAFT" && (
        <div className="mt-4">
          <p className="text-center text-sm text-white">
            Jogador <b className="text-[#FFCB05]">{draftTurn}</b>: escolha{" "}
            {Math.min(
              quota,
              6 - (draftTurn === "A" ? teamA.length : teamB.length),
            )}{" "}
            mascote(s) · A {teamA.length}/6 · B {teamB.length}/6
          </p>
          <div className="mt-3 grid gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-[1fr_180px_180px]">
            <input
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Buscar por mascote ou jogador..."
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
            <select
              value={draftType}
              onChange={(event) => setDraftType(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">Todos os tipos</option>
              {draftTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              value={draftTag}
              onChange={(event) => setDraftTag(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              <option value="ALL">Todas as tags</option>
              {draftTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3 grid min-h-80 grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
            {paginatedPool.map((m) => (
              <button
                key={m.id}
                onMouseEnter={() => inspect(m)}
                onFocus={() => inspect(m)}
                onClick={() => toggleDraft(m.id)}
                className={`rounded-xl border p-3 text-left ${pickedThisTurn.includes(m.id) ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950"}`}
              >
                <img
                  src={m.spriteUrl}
                  alt=""
                  className="mx-auto h-14 w-14 object-contain [image-rendering:pixelated]"
                />
                <b className="block truncate text-[10px] text-white">
                  {m.name}
                </b>
                <span className="block text-center text-[9px] text-slate-500">
                  Nv.{m.level} · HP {55 + m.level * 6 + m.statVitality * 4}
                </span>
                <span className="mt-1 flex flex-wrap justify-center gap-1">
                  {m.types.map((type) => (
                    <span
                      key={type}
                      className="rounded-full border border-slate-700 px-1 py-0.5 text-[8px] text-slate-300"
                    >
                      {type}
                    </span>
                  ))}
                </span>
                <span className="mt-2 block text-[8px] text-slate-400">
                  FOR {m.statForce} · AGI {m.statAgility} · CAR {m.statCharisma}{" "}
                  · INS {m.statInstinct} · VIT {m.statVitality}
                </span>
                <span className="mt-2 block border-t border-slate-800 pt-1 text-[8px] text-cyan-200">
                  {draftMoves[m.id]
                    ?.map((move) => `${move.name} (${move.pp} PP)`)
                    .join(" · ") ?? "Passe o mouse para carregar ataques"}
                </span>
              </button>
            ))}
          </div>
          {paginatedPool.length === 0 && (
            <p className="py-10 text-center text-xs text-slate-500">
              Nenhum mascote corresponde aos filtros.
            </p>
          )}
          <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-slate-400">
            <span>
              {filteredPool.length} mascote(s) · página{" "}
              {Math.min(draftPage, draftPageCount)} de {draftPageCount}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={draftPage <= 1}
                onClick={() => setDraftPage((page) => Math.max(1, page - 1))}
                className="rounded border border-slate-700 px-3 py-1.5 disabled:opacity-30"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={draftPage >= draftPageCount}
                onClick={() =>
                  setDraftPage((page) => Math.min(draftPageCount, page + 1))
                }
                className="rounded border border-slate-700 px-3 py-1.5 disabled:opacity-30"
              >
                Próxima
              </button>
            </div>
          </div>
          <button
            disabled={
              pickedThisTurn.length !==
              Math.min(
                quota,
                6 - (draftTurn === "A" ? teamA.length : teamB.length),
              )
            }
            onClick={() => confirmDraft()}
            className="mt-3 w-full rounded-lg bg-[#FFCB05] px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-35"
          >
            Confirmar escolhas
          </button>
        </div>
      )}
      {stage === "LEADS" && (
        <div className="mt-4">
          <p className="text-center text-sm text-white">
            Jogador {leadTurn}: organize toda a equipe em segredo.
          </p>
          <p className="mt-1 text-center text-[10px] text-slate-400">
            O 1º será o inicial. Do 2º ao 6º fica definida a sequência de
            entrada. O adversário só verá depois das duas confirmações.
          </p>
          <div className="mt-3 space-y-2">
            {(leadTurn === "A" ? orderA : orderB).map((id, index) => {
              const m = mascots.find((entry) => entry.id === id);
              if (!m) return null;
              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${index === 0 ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-slate-800 bg-slate-950"}`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${index === 0 ? "bg-[#FFCB05] text-slate-950" : "bg-slate-800 text-slate-200"}`}
                  >
                    {index + 1}º
                  </span>
                  <img
                    src={m.spriteUrl}
                    alt=""
                    className="h-14 w-14 object-contain [image-rendering:pixelated]"
                  />
                  <div className="min-w-0 flex-1">
                    <b className="block text-xs text-white">
                      {m.name} · Nv.{m.level}
                    </b>
                    <p className="text-[9px] text-slate-500">
                      {index === 0 ? "Mascote inicial" : "Reserva"} · HP{" "}
                      {55 + m.level * 6 + m.statVitality * 4} ·{" "}
                      {m.types.join(" / ")}
                    </p>
                    <p className="mt-1 text-[8px] text-cyan-200">
                      {draftMoves[m.id]
                        ?.map((move) => `${move.name} (${move.pp} PP)`)
                        .join(" · ") ?? "Ataques ainda não consultados"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => reorder(leadTurn, index, -1)}
                      className="rounded border border-slate-700 px-3 py-2 text-white disabled:opacity-20"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === 5}
                      onClick={() => reorder(leadTurn, index, 1)}
                      className="rounded border border-slate-700 px-3 py-2 text-white disabled:opacity-20"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={confirmOrder}
            className="mt-3 w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950"
          >
            Confirmar inicial e sequência secreta
          </button>
        </div>
      )}
      {stage === "DONE" && (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-center text-sm text-emerald-200">
          Pré-jogo concluído. Iniciais e sequências foram confirmados.
        </div>
      )}
    </section>
  );
}
