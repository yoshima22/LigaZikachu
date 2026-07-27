"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { LivePvpMove } from "@/lib/live-pvp-moves";
import type { LivePvpFighter } from "@/lib/live-pvp-engine";
import { loadLivePvpMovesAction, resolveLivePvpTurnAction } from "./actions";

type Side = "A" | "B";
type MascotOption = {
  id: string;
  pokemonId: number;
  name: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  performanceTag: string;
  gameStatus: string;
  level: number;
  types: string[];
  spriteUrl: string;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
};

function toFighter(m: MascotOption): LivePvpFighter {
  const maxHp = Math.max(10, Math.round(55 + m.level * 6 + m.statVitality * 4));
  return {
    id: m.id,
    pokemonId: m.pokemonId,
    spriteUrl: m.spriteUrl,
    name: m.name,
    level: m.level,
    types: m.types,
    hp: maxHp,
    maxHp,
    force: m.statForce,
    agility: m.statAgility,
    charisma: m.statCharisma,
    instinct: m.statInstinct,
    vitality: m.statVitality,
  };
}

const TYPE_ICONS: Record<string, string> = {
  normal: "⚪",
  fire: "🔥",
  water: "💧",
  electric: "⚡",
  grass: "🌿",
  ice: "❄️",
  fighting: "🥊",
  poison: "☠️",
  ground: "⛰️",
  flying: "🪽",
  psychic: "🔮",
  bug: "🐛",
  rock: "🪨",
  ghost: "👻",
  dragon: "🐉",
  dark: "🌑",
  steel: "⚙️",
  fairy: "✨",
};
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
const TYPE_ADVANTAGE: Record<string, string[]> = {
  fire: ["grass", "ice", "bug", "steel"],
  water: ["fire", "ground", "rock"],
  grass: ["water", "ground", "rock"],
  electric: ["water", "flying"],
  psychic: ["fighting", "poison"],
  ghost: ["psychic", "ghost"],
  dragon: ["dragon"],
  fighting: ["normal", "rock", "ice", "dark", "steel"],
  ground: ["fire", "electric", "poison", "rock", "steel"],
  rock: ["fire", "flying", "bug", "ice"],
  ice: ["grass", "ground", "flying", "dragon"],
  poison: ["grass", "fairy"],
  bug: ["grass", "psychic", "dark"],
  normal: [],
};
const STAT_NAMES: Record<string, string> = {
  attack: "Ataque",
  defense: "Defesa",
  "special-attack": "Ataque especial",
  "special-defense": "Defesa especial",
  speed: "Velocidade",
  accuracy: "Precisão",
  evasion: "Evasão",
};
const AILMENT_LABELS: Record<string, string> = {
  paralysis: "⚡ Paralisia",
  sleep: "💤 Sono",
  confusion: "💫 Confusão",
  poison: "☠️ Veneno",
  burn: "🔥 Queimadura",
  freeze: "❄️ Congelamento",
  trap: "🪤 Aprisionamento",
};
const ACTIVE_STATUS_LABELS: Record<string, string> = {
  paralysis: "⚡ PAR",
  sleep: "💤 SLP",
  poison: "☠️ PSN",
  "badly-poisoned": "☠️ TOX",
  burn: "🔥 BRN",
  freeze: "❄️ FRZ",
};
function moveScaling(move: LivePvpMove) {
  if (move.damageClass === "physical")
    return "Poder: Força · Defesa rival: Vitalidade";
  if (move.damageClass === "special")
    return "Poder: Instinto + Carisma · Defesa rival: Vitalidade + Carisma";
  return "Golpe de suporte: não usa poder de ataque";
}
function effectSummary(move: LivePvpMove) {
  const changes = move.statChanges
    .map(
      (change) =>
        `${STAT_NAMES[change.stat] ?? change.stat} ${change.change > 0 ? "+" : ""}${change.change}`,
    )
    .join(" · ");
  const ailment =
    move.ailment !== "none"
      ? `${AILMENT_LABELS[move.ailment] ?? `✦ ${move.ailment}`} ${move.ailmentChance || move.effectChance || "?"}%`
      : null;
  return [
    ailment,
    move.flinchChance ? `💥 Recuo do alvo ${move.flinchChance}%` : null,
    move.drain
      ? `${move.drain > 0 ? "🩸 Drena" : "💔 Recuo"} ${Math.abs(move.drain)}%`
      : null,
    move.healing ? `💚 Cura ${move.healing}%` : null,
    changes || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function ArenaOnlineLab({ mascots }: { mascots: MascotOption[] }) {
  const [pending, startTransition] = useTransition();
  const [idA, setIdA] = useState(mascots[0]?.id ?? "");
  const [idB, setIdB] = useState(mascots[1]?.id ?? mascots[0]?.id ?? "");
  const [teamIdsA, setTeamIdsA] = useState<string[]>(
    mascots[0] ? [mascots[0].id] : [],
  );
  const [teamIdsB, setTeamIdsB] = useState<string[]>(
    mascots[1] ? [mascots[1].id] : mascots[0] ? [mascots[0].id] : [],
  );
  const [teamA, setTeamA] = useState<LivePvpFighter[]>([]);
  const [teamB, setTeamB] = useState<LivePvpFighter[]>([]);
  const [movesA, setMovesA] = useState<LivePvpMove[]>([]);
  const [movesB, setMovesB] = useState<LivePvpMove[]>([]);
  const [setA, setSetA] = useState<number[]>([]);
  const [setB, setSetB] = useState<number[]>([]);
  const [ppA, setPpA] = useState<Record<number, number>>({});
  const [ppB, setPpB] = useState<Record<number, number>>({});
  const [teamMovePreview, setTeamMovePreview] = useState<
    Record<string, LivePvpMove[]>
  >({});
  const [fighterA, setFighterA] = useState<LivePvpFighter | null>(null);
  const [fighterB, setFighterB] = useState<LivePvpFighter | null>(null);
  const [choiceA, setChoiceA] = useState<number | null>(null);
  const [choiceB, setChoiceB] = useState<number | null>(null);
  const [activeSide, setActiveSide] = useState<Side>("A");
  const [seconds, setSeconds] = useState(60);
  const [afk, setAfk] = useState({ A: 0, B: 0 });
  const [winner, setWinner] = useState<Side | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const mascotA = useMemo(
    () => mascots.find((m) => m.id === idA),
    [mascots, idA],
  );
  const mascotB = useMemo(
    () => mascots.find((m) => m.id === idB),
    [mascots, idB],
  );
  const selectedA = movesA.filter((m) => setA.includes(m.id));
  const selectedB = movesB.filter((m) => setB.includes(m.id));

  const toggleTeam = (side: Side, id: string) => {
    const ids = side === "A" ? teamIdsA : teamIdsB;
    const setter = side === "A" ? setTeamIdsA : setTeamIdsB;
    if (ids.includes(id)) {
      if (ids.length === 1) {
        toast.error("A equipe precisa de ao menos um mascote.");
        return;
      }
      setter(ids.filter((value) => value !== id));
    } else {
      if (ids.length >= 6) {
        toast.error("O limite é de seis mascotes.");
        return;
      }
      setter([...ids, id]);
      const mascot = mascots.find((entry) => entry.id === id);
      if (mascot && !teamMovePreview[id])
        startTransition(async () => {
          const result = await loadLivePvpMovesAction(
            mascot.pokemonId,
            mascot.level,
          );
          if (result.moves)
            setTeamMovePreview((current) => ({
              ...current,
              [id]: result.moves!.filter((move) =>
                (result.recommendedIds ?? []).includes(move.id),
              ),
            }));
        });
    }
  };

  const load = () =>
    startTransition(async () => {
      const firstA = mascots.find((m) => m.id === teamIdsA[0]);
      const firstB = mascots.find((m) => m.id === teamIdsB[0]);
      if (!firstA || !firstB) {
        toast.error("Cada equipe precisa de ao menos um mascote.");
        return;
      }
      const [a, b] = await Promise.all([
        loadLivePvpMovesAction(firstA.pokemonId, firstA.level),
        loadLivePvpMovesAction(firstB.pokemonId, firstB.level),
      ]);
      if (a.error || b.error || !a.moves || !b.moves) {
        toast.error(a.error ?? b.error ?? "Falha ao carregar golpes.");
        return;
      }
      setMovesA(a.moves);
      setMovesB(b.moves);
      setSetA(a.recommendedIds ?? []);
      setSetB(b.recommendedIds ?? []);
      setPpA(Object.fromEntries(a.moves.map((move) => [move.id, move.pp])));
      setPpB(Object.fromEntries(b.moves.map((move) => [move.id, move.pp])));
      setTeamMovePreview((current) => ({
        ...current,
        [firstA.id]: a.moves!.filter((move) =>
          (a.recommendedIds ?? []).includes(move.id),
        ),
        [firstB.id]: b.moves!.filter((move) =>
          (b.recommendedIds ?? []).includes(move.id),
        ),
      }));
      setIdA(firstA.id);
      setIdB(firstB.id);
      setFighterA(null);
      setFighterB(null);
      setWinner(null);
      setLogs([
        "Quatro golpes legais foram pré-selecionados conforme nível e ordem de aprendizado.",
      ]);
    });
  const begin = () => {
    if (!mascotA || !mascotB || setA.length !== 4 || setB.length !== 4) {
      toast.error("O sistema precisa de quatro golpes para cada mascote.");
      return;
    }
    const preparedA = teamIdsA
      .map((id) => mascots.find((m) => m.id === id))
      .filter((m): m is MascotOption => !!m)
      .map(toFighter);
    const preparedB = teamIdsB
      .map((id) => mascots.find((m) => m.id === id))
      .filter((m): m is MascotOption => !!m)
      .map(toFighter);
    setTeamA(preparedA);
    setTeamB(preparedB);
    setFighterA(preparedA[0]);
    setFighterB(preparedB[0]);
    setChoiceA(null);
    setChoiceB(null);
    setActiveSide("A");
    setSeconds(60);
    setAfk({ A: 0, B: 0 });
    setWinner(null);
    setLogs((old) => [...old, "A batalha começou. Jogador A tem 60 segundos."]);
    toast.success("Batalha iniciada!");
  };
  const resolveRound = (aId: number | null, bId: number | null) =>
    startTransition(async () => {
      if (!fighterA || !fighterB) return;
      const moveA = selectedA.find((m) => m.id === aId) ?? null;
      const moveB = selectedB.find((m) => m.id === bId) ?? null;
      const result = await resolveLivePvpTurnAction({
        fighterA,
        fighterB,
        moveA,
        moveB,
      });
      if (moveA)
        setPpA((pp) => ({
          ...pp,
          [moveA.id]: Math.max(0, (pp[moveA.id] ?? moveA.pp) - 1),
        }));
      if (moveB)
        setPpB((pp) => ({
          ...pp,
          [moveB.id]: Math.max(0, (pp[moveB.id] ?? moveB.pp) - 1),
        }));
      setFighterA(result.fighterA);
      setFighterB(result.fighterB);
      if (result.fighterA.transformedFromName) {
        setMovesA(selectedB);
        setSetA(selectedB.map((move) => move.id));
        setPpA(Object.fromEntries(selectedB.map((move) => [move.id, 5])));
      }
      if (result.fighterB.transformedFromName) {
        setMovesB(selectedA);
        setSetB(selectedA.map((move) => move.id));
        setPpB(Object.fromEntries(selectedA.map((move) => [move.id, 5])));
      }
      setTeamA((team) =>
        team.map((member) =>
          member.id === result.fighterA.id ? result.fighterA : member,
        ),
      );
      setTeamB((team) =>
        team.map((member) =>
          member.id === result.fighterB.id ? result.fighterB : member,
        ),
      );
      setLogs((old) => [...old, ...result.events]);
      setChoiceA(null);
      setChoiceB(null);
      setActiveSide("A");
      setSeconds(60);
      if (result.winner) {
        const defeated = result.winner === "A" ? "B" : "A";
        const reserves = (defeated === "A" ? teamA : teamB).filter(
          (member) =>
            member.id !==
              (defeated === "A" ? result.fighterA.id : result.fighterB.id) &&
            member.hp > 0,
        );
        if (reserves.length) {
          const next = reserves[0];
          const loaded = await loadLivePvpMovesAction(
            next.pokemonId,
            next.level,
          );
          if (defeated === "A") {
            setFighterA(next);
            setMovesA(loaded.moves ?? []);
            setSetA(loaded.recommendedIds ?? []);
            setPpA(
              Object.fromEntries(
                (loaded.moves ?? []).map((move) => [move.id, move.pp]),
              ),
            );
          } else {
            setFighterB(next);
            setMovesB(loaded.moves ?? []);
            setSetB(loaded.recommendedIds ?? []);
            setPpB(
              Object.fromEntries(
                (loaded.moves ?? []).map((move) => [move.id, move.pp]),
              ),
            );
          }
          setLogs((old) => [
            ...old,
            `${next.name} entrou automaticamente após a derrota do aliado.`,
          ]);
          return;
        }
        setWinner(result.winner);
        toast.success(
          `${result.winner === "A" ? result.fighterA.name : result.fighterB.name} venceu!`,
        );
      }
    });
  const confirm = () => {
    if (activeSide === "A") {
      if (choiceA == null) {
        toast.error("Escolha um golpe.");
        return;
      }
      setAfk((v) => ({ ...v, A: 0 }));
      setActiveSide("B");
      setSeconds(60);
      setLogs((v) => [...v, "Jogador A confirmou. Vez do Jogador B."]);
    } else {
      if (choiceB == null) {
        toast.error("Escolha um golpe.");
        return;
      }
      setAfk((v) => ({ ...v, B: 0 }));
      resolveRound(choiceA, choiceB);
    }
  };
  const surrender = () => {
    const defeated = activeSide;
    const victorious = defeated === "A" ? "B" : "A";
    setWinner(victorious);
    setLogs((v) => [
      ...v,
      `Jogador ${defeated} desistiu. Jogador ${victorious} venceu a batalha.`,
    ]);
    toast.success(`Jogador ${victorious} venceu por desistência.`);
  };
  const switchMascot = (side: Side, targetId: string) =>
    startTransition(async () => {
      const target = mascots.find((m) => m.id === targetId);
      if (!target) return;
      const loaded = await loadLivePvpMovesAction(
        target.pokemonId,
        target.level,
      );
      if (loaded.error || !loaded.moves) {
        toast.error(loaded.error ?? "Falha ao carregar golpes.");
        return;
      }
      const next =
        side === "A"
          ? teamA.find((m) => m.id === targetId)
          : teamB.find((m) => m.id === targetId);
      if (!next || next.hp <= 0) {
        toast.error("Esse mascote não pode entrar.");
        return;
      }
      setLogs((v) => [
        ...v,
        `Jogador ${side} trocou para ${next.name}. A troca consumiu sua ação.`,
      ]);
      if (side === "A") {
        if (fighterA)
          setTeamA((team) =>
            team.map((member) =>
              member.id === fighterA.id ? fighterA : member,
            ),
          );
        setFighterA(next);
        setMovesA(loaded.moves);
        setSetA(loaded.recommendedIds ?? []);
        setPpA(
          Object.fromEntries(loaded.moves.map((move) => [move.id, move.pp])),
        );
        setChoiceA(null);
        setActiveSide("B");
        setSeconds(60);
        return;
      }
      if (fighterB)
        setTeamB((team) =>
          team.map((member) => (member.id === fighterB.id ? fighterB : member)),
        );
      if (fighterA && choiceA != null) {
        const moveA = selectedA.find((move) => move.id === choiceA) ?? null;
        const result = await resolveLivePvpTurnAction({
          fighterA,
          fighterB: next,
          moveA,
          moveB: null,
        });
        if (moveA)
          setPpA((pp) => ({
            ...pp,
            [moveA.id]: Math.max(0, (pp[moveA.id] ?? moveA.pp) - 1),
          }));
        setFighterA(result.fighterA);
        setFighterB(result.fighterB);
        setTeamA((team) =>
          team.map((m) => (m.id === result.fighterA.id ? result.fighterA : m)),
        );
        setTeamB((team) =>
          team.map((m) => (m.id === result.fighterB.id ? result.fighterB : m)),
        );
        setLogs((v) => [
          ...v,
          ...result.events.filter((event) => !event.includes("tempo esgotado")),
        ]);
      } else setFighterB(next);
      setMovesB(loaded.moves);
      setSetB(loaded.recommendedIds ?? []);
      setPpB(
        Object.fromEntries(loaded.moves.map((move) => [move.id, move.pp])),
      );
      setChoiceA(null);
      setChoiceB(null);
      setActiveSide("A");
      setSeconds(60);
    });
  const timeout = () => {
    const next = afk[activeSide] + 1;
    setAfk((v) => ({ ...v, [activeSide]: next }));
    setLogs((v) => [
      ...v,
      `Jogador ${activeSide} perdeu a ação por tempo (${next}/3 consecutivas).`,
    ]);
    if (next >= 3) {
      const win = activeSide === "A" ? "B" : "A";
      setWinner(win);
      toast.error(`Jogador ${activeSide} foi derrotado por AFK.`);
      return;
    }
    if (activeSide === "A") {
      setChoiceA(null);
      setActiveSide("B");
      setSeconds(60);
    } else {
      setChoiceB(null);
      resolveRound(choiceA, null);
    }
  };
  useEffect(() => {
    if (!fighterA || !fighterB || winner || pending) return;
    const timer = setTimeout(
      () => (seconds > 1 ? setSeconds(seconds - 1) : timeout()),
      1000,
    );
    return () => clearTimeout(timer);
  });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-widest text-purple-300">
          Sandbox admin local
        </p>
        <h1 className="font-pixel text-lg text-[#FFCB05]">Arena Online</h1>
        <p className="mt-2 text-sm text-slate-400">
          Nada aqui altera os mascotes reais. Os golpes são temporários e
          pré-selecionados pela PokeAPI.
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <TeamPicker
          label="Jogador A"
          ids={teamIdsA}
          mascots={mascots}
          toggle={(id) => toggleTeam("A", id)}
          movePreview={teamMovePreview}
        />
        <TeamPicker
          label="Jogador B"
          ids={teamIdsB}
          mascots={mascots}
          toggle={(id) => toggleTeam("B", id)}
          movePreview={teamMovePreview}
        />
      </div>
      <button
        onClick={load}
        disabled={pending}
        className="rounded-xl bg-purple-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        Preparar golpes automaticamente
      </button>
      {movesA.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <MoveSet title={mascotA?.name ?? "A"} moves={selectedA} />
            <MoveSet title={mascotB?.name ?? "B"} moves={selectedB} />
          </div>
          <button
            onClick={begin}
            className="w-full rounded-xl bg-[#FFCB05] px-4 py-3 font-bold text-slate-950"
          >
            Iniciar batalha de teste
          </button>
        </>
      )}
      {fighterA && fighterB && (
        <>
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3 text-center">
            <p className="text-xs text-slate-400">
              Vez do Jogador {activeSide}
            </p>
            <strong
              className={`font-pixel text-2xl ${seconds <= 10 ? "text-red-400" : "text-cyan-300"}`}
            >
              {seconds}s
            </strong>
            <p className="text-[10px] text-slate-500">
              AFK: A {afk.A}/3 · B {afk.B}/3
            </p>
            {winner && (
              <p className="mt-2 font-bold text-[#FFCB05]">
                Jogador {winner} venceu
              </p>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_0.9fr]">
            <FightBox
              side="A"
              active={activeSide === "A" && !winner}
              fighter={fighterA}
              moves={selectedA}
              choice={choiceA}
              setChoice={setChoiceA}
              team={teamA}
              pp={ppA}
              owner={mascots.find((m) => m.id === teamIdsA[0])}
              onSwitch={(id) => switchMascot("A", id)}
            />
            <FightBox
              side="B"
              active={activeSide === "B" && !winner}
              fighter={fighterB}
              moves={selectedB}
              choice={choiceB}
              setChoice={setChoiceB}
              team={teamB}
              pp={ppB}
              owner={mascots.find((m) => m.id === teamIdsB[0])}
              onSwitch={(id) => switchMascot("B", id)}
            />
            <div className="rounded-xl border border-border bg-slate-950 p-3">
              <p className="mb-2 text-xs font-bold text-white">Log</p>
              <div className="max-h-72 space-y-1 overflow-y-auto text-[11px] text-slate-400">
                {logs.map((log, i) => (
                  <p key={i}>{log}</p>
                ))}
              </div>
              <button
                onClick={confirm}
                disabled={pending || !!winner}
                className="mt-3 w-full rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40"
              >
                Confirmar golpe do Jogador {activeSide}
              </button>
              <button
                onClick={surrender}
                disabled={pending || !!winner}
                className="mt-2 w-full rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 disabled:opacity-40"
              >
                Desistir — Jogador {activeSide}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MascotSelect({
  label,
  value,
  setValue,
  mascots,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  mascots: MascotOption[];
}) {
  return (
    <label className="text-xs text-slate-400">
      {label}
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-slate-950 p-3 text-slate-100"
      >
        {mascots.map((m) => (
          <option key={m.id} value={m.id}>
            {m.ownerName} — {m.name} Nv.{m.level}
          </option>
        ))}
      </select>
    </label>
  );
}
function TeamPicker({
  label,
  ids,
  mascots,
  toggle,
  movePreview,
}: {
  label: string;
  ids: string[];
  mascots: MascotOption[];
  toggle: (id: string) => void;
  movePreview: Record<string, LivePvpMove[]>;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");
  const visible = mascots
    .filter(
      (m) =>
        (!search ||
          m.name
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR")) ||
          m.ownerName
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR"))) &&
        (typeFilter === "ALL" || m.types.includes(typeFilter)) &&
        (tagFilter === "ALL" || m.performanceTag === tagFilter),
    )
    .sort(
      (a, b) =>
        Number(ids.includes(b.id)) - Number(ids.includes(a.id)) ||
        b.level - a.level,
    );
  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-cyan-500/5 to-slate-950/80 p-4 shadow-xl shadow-black/20">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
            Montagem de equipe
          </p>
          <strong className="text-base text-white">{label}</strong>
        </div>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-200">
          {ids.length}/6 selecionados
        </span>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar mascote..."
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        >
          <option value="ALL">Todos os tipos</option>
          {Object.keys(TYPE_LABELS).map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
        >
          <option value="ALL">Todas as tags</option>
          <option value="FORTE">Forte</option>
          <option value="NEUTRO">Neutro</option>
          <option value="RUIM">Ruim</option>
          <option value="PESSIMO">Péssimo</option>
        </select>
      </div>
      <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
        {visible.map((m) => (
          <button
            type="button"
            key={m.id}
            onClick={() => toggle(m.id)}
            className={`relative flex w-full items-start gap-3 rounded-xl border p-3 text-left text-xs transition ${ids.includes(m.id) ? "border-[#FFCB05] bg-[#FFCB05]/10 shadow-[0_0_18px_rgba(255,203,5,.12)]" : "border-slate-800 bg-slate-900/60 hover:border-cyan-500/40"}`}
          >
            <img
              src={m.spriteUrl}
              alt=""
              className="h-16 w-16 object-contain [image-rendering:pixelated]"
            />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-white">
                {m.name} · Nv.{m.level}
              </b>
              <span className="text-slate-500">
                {m.ownerName} · Nv.{m.level} · HP {toFighter(m).maxHp}
              </span>
              <span className="mt-1 flex flex-wrap gap-1">
                {m.types.map((type) => (
                  <span
                    key={type}
                    className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-200"
                  >
                    {TYPE_ICONS[type] ?? ""} {TYPE_LABELS[type] ?? type}
                  </span>
                ))}
                <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-1.5 py-0.5 text-[9px] text-purple-200">
                  {m.performanceTag}
                </span>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[9px] ${m.gameStatus === "Disponível" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200" : "border-amber-500/25 bg-amber-500/10 text-amber-200"}`}
                >
                  {m.gameStatus}
                </span>
              </span>
              <span className="mt-2 block text-[9px] text-slate-400">
                <b className="text-slate-300">Status:</b> FOR {m.statForce} ·
                AGI {m.statAgility} · CAR {m.statCharisma} · INS{" "}
                {m.statInstinct} · VIT {m.statVitality}
              </span>
              <span className="mt-1 block text-[9px] text-slate-500">
                <b className="text-slate-400">Ataques:</b>{" "}
                {movePreview[m.id]?.map((move) => move.name).join(" · ") ??
                  (ids.includes(m.id)
                    ? "carregando golpes..."
                    : "selecione para consultar")}
              </span>
            </span>
            {ids.includes(m.id) && (
              <span className="absolute right-3 top-3 rounded-full bg-[#FFCB05] px-2 py-1 font-bold text-slate-950">
                {ids.indexOf(m.id) + 1}º
              </span>
            )}
          </button>
        ))}
        {!visible.length && (
          <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-xs text-slate-500">
            Nenhum mascote encontrado com esses filtros.
          </div>
        )}
      </div>
    </div>
  );
}
function MoveSet({ title, moves }: { title: string; moves: LivePvpMove[] }) {
  return (
    <div className="rounded-xl border border-border bg-slate-950/60 p-3">
      <p className="mb-2 text-xs font-bold text-white">Golpes de {title}</p>
      <div className="space-y-2">
        {moves.map((m) => (
          <div key={m.id} className="rounded-lg bg-slate-900 p-3 text-xs">
            <div>
              <strong>
                {TYPE_ICONS[m.type] ?? "✦"} {m.name}
              </strong>
              <span className="ml-2 text-slate-400">
                {m.damageClass === "physical"
                  ? "💥 Físico"
                  : m.damageClass === "special"
                    ? "✨ Especial"
                    : "🛡️ Suporte"}
              </span>
            </div>
            <p className="mt-1 text-slate-400">
              Poder {m.power ?? 0} · Precisão {m.accuracy ?? "sempre acerta"}
              {m.accuracy != null ? "%" : ""} · Prioridade{" "}
              {m.priority > 0 ? "+" : ""}
              {m.priority} · PP {m.pp}
            </p>
            <p className="mt-1 text-cyan-300/80">{moveScaling(m)}</p>
            {effectSummary(m) && (
              <p className="mt-1 text-amber-300/80">⚙️ {effectSummary(m)}</p>
            )}
            {m.effect && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {m.effect}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function FightBox({
  side,
  active,
  fighter,
  moves,
  choice,
  setChoice,
  team,
  pp,
  owner,
  onSwitch,
}: {
  side: Side;
  active: boolean;
  fighter: LivePvpFighter;
  moves: LivePvpMove[];
  choice: number | null;
  setChoice: (id: number) => void;
  team: LivePvpFighter[];
  pp: Record<number, number>;
  owner?: MascotOption;
  onSwitch: (id: string) => void;
}) {
  const pct = Math.round((fighter.hp / fighter.maxHp) * 100);
  const [openType, setOpenType] = useState<string | null>(null);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const inspected = team.find((member) => member.id === inspectedId) ?? null;
  return (
    <div
      className={`rounded-xl border bg-slate-950/70 p-4 ${active ? "border-cyan-400" : "border-border"}`}
    >
      <div className="mb-3 flex items-center gap-3 border-b border-slate-800 pb-3">
        {owner?.ownerAvatarUrl ? (
          <img
            src={owner.ownerAvatarUrl}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 font-bold text-slate-300">
            {owner?.ownerName?.charAt(0) ?? side}
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            Jogador {side}
          </p>
          <strong className="text-sm text-white">
            {owner?.ownerName ?? `Jogador ${side}`}
          </strong>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={fighter.spriteUrl}
            alt=""
            className="h-20 w-20 object-contain [image-rendering:pixelated]"
          />
          <strong>
            {fighter.name} <small className="text-slate-500">({side})</small>
          </strong>
        </div>
        <span className="text-xs">
          {fighter.hp}/{fighter.maxHp} HP
        </span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {fighter.types.map((type) => (
          <div key={type} className="relative">
            <button
              type="button"
              onClick={() => setOpenType(openType === type ? null : type)}
              className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold text-slate-200"
            >
              {TYPE_ICONS[type] ?? "✦"} {TYPE_LABELS[type] ?? type}
            </button>
            {openType === type && (
              <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-700 bg-slate-950 p-3 text-[10px] shadow-2xl">
                <p className="font-bold text-emerald-300">Forte contra</p>
                <p className="mt-1 text-slate-300">
                  {(TYPE_ADVANTAGE[type] ?? [])
                    .map((t) => TYPE_LABELS[t] ?? t)
                    .join(", ") || "Nenhuma vantagem cadastrada"}
                </p>
                <p className="mt-2 font-bold text-red-300">Fraco contra</p>
                <p className="mt-1 text-slate-300">
                  {Object.entries(TYPE_ADVANTAGE)
                    .filter(([, targets]) => targets.includes(type))
                    .map(([t]) => TYPE_LABELS[t] ?? t)
                    .join(", ") || "Nenhuma fraqueza cadastrada"}
                </p>
                <p className="mt-2 text-slate-500">
                  Segue a tabela de tipos atualmente usada pelos combates da
                  Liga.
                </p>
              </div>
            )}
          </div>
        ))}
        {fighter.status && (
          <span className="rounded-full border border-red-500/35 bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-200">
            {ACTIVE_STATUS_LABELS[fighter.status] ?? fighter.status}
          </span>
        )}
        {!!fighter.confusionTurns && (
          <span className="rounded-full border border-purple-500/35 bg-purple-500/10 px-2 py-1 text-[10px] font-bold text-purple-200">
            💫 Confuso ({fighter.confusionTurns})
          </span>
        )}
      </div>
      <div className="my-2 h-2 overflow-hidden rounded bg-slate-800">
        <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid gap-2">
        {moves.map((m) => (
          <button
            key={m.id}
            disabled={!active || (pp[m.id] ?? m.pp) <= 0}
            onClick={() => setChoice(m.id)}
            className={`rounded-lg border p-2 text-left text-xs disabled:opacity-35 ${choice === m.id ? "border-cyan-400 bg-cyan-400/10" : "border-border"}`}
          >
            <strong>
              {TYPE_ICONS[m.type] ?? "✦"} {m.name}
            </strong>
            <span className="ml-2 text-slate-500">
              Poder {m.power ?? 0} · Precisão {m.accuracy ?? "—"}
              {m.accuracy != null ? "%" : ""} · PP {pp[m.id] ?? m.pp}/{m.pp}
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-cyan-300/75">
              {moveScaling(m)}
            </span>
            {effectSummary(m) && (
              <span className="mt-1 block text-[10px] leading-relaxed text-amber-300/75">
                {effectSummary(m)}
              </span>
            )}
            {m.effect && (
              <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">
                {m.effect}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3 border-t border-slate-800 pt-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Equipe visível · trocar consome a ação
        </p>
        <div className="grid grid-cols-3 gap-1">
          {team.map((member) => (
            <button
              type="button"
              key={member.id}
              onClick={() => setInspectedId(member.id)}
              className="rounded-lg border border-slate-800 bg-slate-900 p-1 disabled:opacity-35"
            >
              <img
                src={member.spriteUrl}
                alt=""
                className="mx-auto h-12 w-12 object-contain [image-rendering:pixelated]"
              />
              <span className="block truncate text-[9px] text-slate-300">
                {member.name}
              </span>
              <span className="text-[8px] text-slate-500">
                {member.hp}/{member.maxHp}
              </span>
            </button>
          ))}
        </div>
        {inspected && (
          <div className="mt-2 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-[10px]">
            <div className="flex items-center gap-2">
              <img
                src={inspected.spriteUrl}
                alt=""
                className="h-14 w-14 object-contain [image-rendering:pixelated]"
              />
              <div>
                <strong className="text-sm text-white">
                  {inspected.name} · Nv.{inspected.level}
                </strong>
                <p className="mt-1 text-slate-300">
                  {inspected.types
                    .map(
                      (type) =>
                        `${TYPE_ICONS[type] ?? ""} ${TYPE_LABELS[type] ?? type}`,
                    )
                    .join(" / ")}
                </p>
                <p className="mt-1 text-slate-400">
                  HP {inspected.hp}/{inspected.maxHp}
                </p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1 text-center text-slate-300">
              <span>
                FOR
                <br />
                <b>{inspected.force}</b>
              </span>
              <span>
                AGI
                <br />
                <b>{inspected.agility}</b>
              </span>
              <span>
                CAR
                <br />
                <b>{inspected.charisma}</b>
              </span>
              <span>
                INS
                <br />
                <b>{inspected.instinct}</b>
              </span>
              <span>
                VIT
                <br />
                <b>{inspected.vitality}</b>
              </span>
            </div>
            {inspected.id !== fighter.id && inspected.hp > 0 && (
              <button
                type="button"
                disabled={!active}
                onClick={() => onSwitch(inspected.id)}
                className="mt-3 w-full rounded-lg bg-cyan-500 px-2 py-2 font-bold text-slate-950 disabled:opacity-35"
              >
                Trocar para {inspected.name}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
