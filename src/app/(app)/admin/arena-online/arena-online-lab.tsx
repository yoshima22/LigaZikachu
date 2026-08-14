"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { LivePvpMove } from "@/lib/live-pvp-moves";
import type { LivePvpFighter } from "@/lib/live-pvp-engine";
import { loadLivePvpMovesAction, resolveLivePvpTurnAction } from "./actions";
import { ArenaOnlinePregame } from "./arena-online-pregame";
import { closeLivePvpMatchAction } from "../../combates/arena-online/matchmaking-actions";
import { ArenaOnlineSyncedBattle } from "./arena-online-synced-battle";

type Side = "A" | "B";
export type MascotOption = {
  id: string;
  ownerId?: string;
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
  attack: "Força ofensiva",
  defense: "Resistência por Vitalidade",
  "special-attack": "Poder por Instinto e Carisma",
  "special-defense": "Resistência por Vitalidade e Carisma",
  speed: "Iniciativa",
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
  if (move.healing)
    return "Suporte cuidador: cura escala com Carisma, Vitalidade e nível";
  if (
    move.statChanges.length &&
    ["user", "users-field", "user-or-ally"].includes(move.target)
  )
    return "Suporte encorajador: Carisma pode ampliar o buff";
  if (
    move.ailment !== "none" ||
    move.statChanges.some((change) => change.change < 0)
  )
    return "Suporte oportunista: Instinto aumenta a chance do efeito adverso";
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
    move.flinchChance ? `💥 Hesitação ${move.flinchChance}%` : null,
    move.drain
      ? `${move.drain > 0 ? "🩸 Drena" : "💔 Recuo"} ${Math.abs(move.drain)}%`
      : null,
    move.healing ? `💚 Cura ${move.healing}%` : null,
    changes || null,
  ]
    .filter(Boolean)
    .join(" · ");
}
function stageMultiplier(stage = 0) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

const EFFECT_GUIDE = [
  {
    group: "Condições negativas",
    tone: "text-red-300",
    effects: [
      [
        "Paralisia",
        "A cada ação, há 25% de chance de o mascote não conseguir agir.",
      ],
      [
        "Sono",
        "Impede ações por 1 a 3 turnos. Descanso aplica exatamente 2 ações de sono.",
      ],
      [
        "Congelamento",
        "Impede a ação até descongelar; há 20% de chance de descongelar a cada tentativa.",
      ],
      [
        "Confusão",
        "Dura de 2 a 5 ações. Em cada uma, há 33,33% de chance de perder a ação e sofrer 10% do HP máximo.",
      ],
      [
        "Queimadura",
        "Causa 1/16 do HP máximo ao fim da rodada e reduz pela metade o dano de golpes físicos.",
      ],
      ["Veneno", "Causa 1/8 do HP máximo ao fim de cada rodada."],
      [
        "Veneno grave",
        "O dano começa em 1/16 do HP máximo e aumenta progressivamente a cada rodada.",
      ],
      [
        "Hesitação",
        "Faz o alvo perder a próxima ação disponível. Não permanece como condição duradoura.",
      ],
    ],
  },
  {
    group: "Melhorias e reduções",
    tone: "text-cyan-300",
    effects: [
      ["Força ofensiva", "Altera a Força usada nos golpes físicos."],
      [
        "Resistência por Vitalidade",
        "Altera a Vitalidade usada para resistir a golpes físicos.",
      ],
      [
        "Poder por Instinto e Carisma",
        "Altera a média de Instinto e Carisma usada nos golpes especiais.",
      ],
      [
        "Resistência por Vitalidade e Carisma",
        "Altera a média de Vitalidade e Carisma usada para resistir a golpes especiais.",
      ],
      [
        "Iniciativa",
        "Altera a iniciativa baseada em Vitalidade usada para desempatar golpes de mesma prioridade.",
      ],
      [
        "Precisão e evasão",
        "Precisão aumenta a chance de acertar; evasão do alvo a reduz. Cada estágio modifica o valor exibido no golpe.",
      ],
      [
        "Estágios",
        "Vão de -6 a +6. Um estágio positivo vale 1,5×; +2 vale 2×. Um estágio negativo aplica a redução inversa.",
      ],
    ],
  },
  {
    group: "Outros efeitos",
    tone: "text-emerald-300",
    effects: [
      [
        "Cura",
        "Recupera HP e, neste modo, escala com Carisma, Vitalidade e nível. A estimativa aparece no golpe.",
      ],
      [
        "Drenagem",
        "Recupera uma porcentagem do dano que o golpe realmente causou.",
      ],
      [
        "Dano de recuo",
        "Depois de acertar, o usuário perde uma porcentagem do dano causado.",
      ],
      [
        "Proteção",
        "Bloqueia completamente ataques direcionados ao usuário durante a rodada.",
      ],
      [
        "Prioridade",
        "É comparada antes da iniciativa. O maior número age primeiro; empates usam iniciativa e depois sorteio.",
      ],
      [
        "Bônus de tipo",
        "Golpes do mesmo tipo do usuário recebem 20% de bônus, além das vantagens e resistências de tipo.",
      ],
      [
        "Acerto crítico",
        "Tem chance base de 6,25%, pode ser ampliado pelo golpe e multiplica o dano por 1,5.",
      ],
    ],
  },
] as const;

function EffectGuide() {
  return (
    <details className="group rounded-xl border border-purple-500/30 bg-purple-500/5">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-purple-200">
        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-purple-400/50 text-xs">
          ?
        </span>
        Entenda atributos, melhorias e condições de combate
        <span className="float-right text-purple-300 transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="grid gap-3 border-t border-purple-500/20 p-4 lg:grid-cols-3">
        {EFFECT_GUIDE.map((section) => (
          <section
            key={section.group}
            className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
          >
            <h3
              className={`mb-3 text-xs font-bold uppercase tracking-wider ${section.tone}`}
            >
              {section.group}
            </h3>
            <div className="space-y-3">
              {section.effects.map(([name, description]) => (
                <div key={name}>
                  <p className="text-xs font-bold text-slate-100">{name}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}
function moveInfluence(
  move: LivePvpMove,
  actor: LivePvpFighter,
  target: LivePvpFighter,
) {
  if (move.damageClass === "physical") {
    const attack = Math.round(
      actor.force * stageMultiplier(actor.statStages?.attack),
    );
    const defense = Math.round(
      target.vitality * stageMultiplier(target.statStages?.defense),
    );
    const accuracy =
      move.accuracy == null
        ? 100
        : Math.min(
            100,
            Math.round(
              move.accuracy *
                stageMultiplier(
                  (actor.statStages?.accuracy ?? 0) -
                    (target.statStages?.evasion ?? 0),
                ),
            ),
          );
    return `Cálculo atual: Força ${attack} contra Vitalidade ${defense} · precisão efetiva ${accuracy}%`;
  }
  if (move.damageClass === "special") {
    const attack = Math.round(
      ((actor.instinct + actor.charisma) / 2) *
        stageMultiplier(actor.statStages?.["special-attack"]),
    );
    const defense = Math.round(
      ((target.vitality + target.charisma) / 2) *
        stageMultiplier(target.statStages?.["special-defense"]),
    );
    const accuracy =
      move.accuracy == null
        ? 100
        : Math.min(
            100,
            Math.round(
              move.accuracy *
                stageMultiplier(
                  (actor.statStages?.accuracy ?? 0) -
                    (target.statStages?.evasion ?? 0),
                ),
            ),
          );
    return `Cálculo atual: média de Instinto e Carisma ${attack} contra média de Vitalidade e Carisma ${defense} · precisão efetiva ${accuracy}%`;
  }
  if (move.healing) {
    const scale =
      0.75 + actor.charisma / 500 + actor.vitality / 750 + actor.level / 500;
    return `Cura estimada agora: ${Math.round(((actor.maxHp * move.healing) / 100) * scale)} HP · Carisma ${actor.charisma}, Vitalidade ${actor.vitality} e Nv.${actor.level}`;
  }
  if (
    move.ailment !== "none" ||
    move.statChanges.some((change) => change.change < 0)
  ) {
    const base = move.ailmentChance || move.effectChance || 100;
    const bonus = Math.min(15, actor.instinct / 18);
    return `Chance efetiva do efeito: ${Math.min(100, Math.round(base + bonus))}% · Instinto ${actor.instinct} acrescenta ${Math.round(bonus)} pontos percentuais`;
  }
  if (move.statChanges.length)
    return `Carisma ${actor.charisma}: ${Math.min(35, Math.round(actor.charisma / 8))}% de chance de ampliar o buff em +1 estágio`;
  return "Este efeito não usa um atributo ofensivo.";
}

export function ArenaOnlineLab({
  mascots,
  onlineIdentity,
}: {
  mascots: MascotOption[];
  onlineIdentity?: { playerId: string; playerName: string };
}) {
  const [pending, startTransition] = useTransition();
  const [remoteRoster, setRemoteRoster] = useState<MascotOption[]>([]);
  const [onlineBattleReady, setOnlineBattleReady] = useState(false);
  const roster = useMemo(() => {
    const map = new Map<string, MascotOption>();
    [...mascots, ...remoteRoster].forEach((mascot) =>
      map.set(mascot.id, mascot),
    );
    return [...map.values()];
  }, [mascots, remoteRoster]);
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
  const [ppLedger, setPpLedger] = useState<
    Record<string, Record<number, number>>
  >({});
  const [fighterA, setFighterA] = useState<LivePvpFighter | null>(null);
  const [fighterB, setFighterB] = useState<LivePvpFighter | null>(null);
  const [choiceA, setChoiceA] = useState<number | null>(null);
  const [choiceB, setChoiceB] = useState<number | null>(null);
  const [activeSide, setActiveSide] = useState<Side>("A");
  const [openingSide, setOpeningSide] = useState<Side>("A");
  const [pregameReset, setPregameReset] = useState(0);
  const [seconds, setSeconds] = useState(60);
  const [afk, setAfk] = useState({ A: 0, B: 0 });
  const [winner, setWinner] = useState<Side | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = logRef.current;
    if (element)
      requestAnimationFrame(() =>
        element.scrollTo({ top: element.scrollHeight, behavior: "smooth" }),
      );
  }, [logs]);
  const mascotA = useMemo(
    () => roster.find((m) => m.id === idA),
    [roster, idA],
  );
  const mascotB = useMemo(
    () => roster.find((m) => m.id === idB),
    [roster, idB],
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
      const mascot = roster.find((entry) => entry.id === id);
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
  const reorderTeam = (side: Side, id: string, direction: -1 | 1) => {
    const ids = side === "A" ? teamIdsA : teamIdsB;
    const setter = side === "A" ? setTeamIdsA : setTeamIdsB;
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    const next = [...ids];
    [next[index], next[target]] = [next[target], next[index]];
    setter(next);
  };

  const load = (idsA = teamIdsA, idsB = teamIdsB, source = roster) =>
    startTransition(async () => {
      const firstA = source.find((m) => m.id === idsA[0]);
      const firstB = source.find((m) => m.id === idsB[0]);
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
      setPpLedger((current) => ({
        ...current,
        [firstA.id]: Object.fromEntries(
          a.moves!.map((move) => [move.id, move.pp]),
        ),
        [firstB.id]: Object.fromEntries(
          b.moves!.map((move) => [move.id, move.pp]),
        ),
      }));
      setIdA(firstA.id);
      setIdB(firstB.id);
      setFighterA(null);
      setFighterB(null);
      setWinner(null);
      setLogs((old) => [
        ...old,
        "──────────────── PREPARAÇÃO DOS GOLPES ────────────────",
        `Golpes de ${firstA.name} e ${firstB.name} preparados conforme nível e ordem de aprendizado.`,
      ]);
    });
  const begin = () => {
    if (!mascotA || !mascotB || setA.length !== 4 || setB.length !== 4) {
      toast.error("O sistema precisa de quatro golpes para cada mascote.");
      return;
    }
    const preparedA = teamIdsA
      .map((id) => roster.find((m) => m.id === id))
      .filter((m): m is MascotOption => !!m)
      .map(toFighter);
    const preparedB = teamIdsB
      .map((id) => roster.find((m) => m.id === id))
      .filter((m): m is MascotOption => !!m)
      .map(toFighter);
    setTeamA(preparedA);
    setTeamB(preparedB);
    setFighterA(preparedA[0]);
    setFighterB(preparedB[0]);
    setChoiceA(null);
    setChoiceB(null);
    setActiveSide(openingSide);
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
      if (moveA)
        setPpLedger((current) => ({
          ...current,
          [fighterA.id]: {
            ...(current[fighterA.id] ?? {}),
            [moveA.id]: Math.max(
              0,
              (current[fighterA.id]?.[moveA.id] ?? moveA.pp) - 1,
            ),
          },
        }));
      if (moveB)
        setPpLedger((current) => ({
          ...current,
          [fighterB.id]: {
            ...(current[fighterB.id] ?? {}),
            [moveB.id]: Math.max(
              0,
              (current[fighterB.id]?.[moveB.id] ?? moveB.pp) - 1,
            ),
          },
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
      setActiveSide(openingSide);
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
    const choice = activeSide === "A" ? choiceA : choiceB;
    if (choice == null) {
      toast.error("Escolha um golpe.");
      return;
    }
    setAfk((v) => ({ ...v, [activeSide]: 0 }));
    if (activeSide === openingSide) {
      const next = activeSide === "A" ? "B" : "A";
      setActiveSide(next);
      setSeconds(60);
      setLogs((v) => [
        ...v,
        `Jogador ${activeSide} confirmou. Vez do Jogador ${next}.`,
      ]);
    } else resolveRound(choiceA, choiceB);
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
    if (onlineIdentity) void closeLivePvpMatchAction();
    setPregameReset((value) => value + 1);
  };
  const switchMascot = (side: Side, targetId: string) =>
    startTransition(async () => {
      const target = roster.find((m) => m.id === targetId);
      if (!target) return;
      const loaded = await loadLivePvpMovesAction(
        target.pokemonId,
        target.level,
      );
      const recommended =
        loaded.moves?.filter((move) =>
          (loaded.recommendedIds ?? []).includes(move.id),
        ) ?? [];
      setTeamMovePreview((current) => ({
        ...current,
        [targetId]: recommended,
      }));
      setPpLedger((current) =>
        current[targetId]
          ? current
          : {
              ...current,
              [targetId]: Object.fromEntries(
                (loaded.moves ?? []).map((move) => [move.id, move.pp]),
              ),
            },
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
          ppLedger[next.id] ??
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
        if (moveA)
          setPpLedger((current) => ({
            ...current,
            [fighterA.id]: {
              ...(current[fighterA.id] ?? {}),
              [moveA.id]: Math.max(
                0,
                (current[fighterA.id]?.[moveA.id] ?? moveA.pp) - 1,
              ),
            },
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
        ppLedger[next.id] ??
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
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-pixel text-lg text-[#FFCB05]">
            Batalha de Terreno
          </h1>
          <span className="rounded-full border border-cyan-400/40 bg-cyan-500/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-200">
            Casual
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          {onlineIdentity
            ? "Combate tático online por terreno, movimentação e posturas."
            : "Ambiente administrativo da Batalha de Terreno. Nenhuma simulação altera os mascotes reais."}
        </p>
      </header>
      <div className="rounded-2xl border-2 border-amber-400/70 bg-gradient-to-r from-amber-500/20 via-red-500/10 to-cyan-500/15 p-4 shadow-[0_0_28px_rgba(251,191,36,.12)]">
        <p className="text-sm font-black uppercase tracking-wide text-amber-200">
          Modo casual: sem recompensas e sem ferimentos
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          Esta é uma experiência online alternativa disponibilizada no estado em que seu desenvolvimento foi encerrado. Partidas não concedem ZC, EXP, itens ou recompensas e não alteram HP, repouso, SUS, disponibilidade nem qualquer outro estado real dos mascotes.
        </p>
      </div>
      {!onlineIdentity && <EffectGuide />}
      {(!onlineIdentity || !onlineBattleReady) && (
        <ArenaOnlinePregame
          key={pregameReset}
          mascots={mascots}
          onlineIdentity={onlineIdentity}
          onEvent={(event) =>
            setLogs((old) => [
              ...old,
              "────────────────────────────────",
              event,
            ])
          }
          onComplete={(a, b, first, matchedMascots = []) => {
            const combined = [...roster];
            for (const mascot of matchedMascots) {
              if (!combined.some((entry) => entry.id === mascot.id))
                combined.push(mascot);
            }
            setRemoteRoster(matchedMascots);
            setTeamIdsA(a);
            setTeamIdsB(b);
            setOpeningSide(first);
            setIdA(a[0] ?? "");
            setIdB(b[0] ?? "");
            if (onlineIdentity) {
              setOnlineBattleReady(true);
              return;
            }
            load(a, b, combined);
            toast.success("Pré-jogo concluído e golpes preparados.");
          }}
        />
      )}
      {onlineIdentity && onlineBattleReady && (
        <ArenaOnlineSyncedBattle identity={onlineIdentity} />
      )}
      {!onlineIdentity && movesA.length > 0 && (
        <>
          <button
            onClick={begin}
            className="w-full rounded-xl bg-[#FFCB05] px-4 py-3 font-bold text-slate-950"
          >
            Iniciar simulação administrativa
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
              opponent={fighterB}
              moves={selectedA}
              choice={choiceA}
              setChoice={setChoiceA}
              team={teamA}
              pp={ppA}
              owner={roster.find((m) => m.id === teamIdsA[0])}
              movePreview={teamMovePreview}
              ppLedger={ppLedger}
              onSwitch={(id) => switchMascot("A", id)}
            />
            <FightBox
              side="B"
              active={activeSide === "B" && !winner}
              fighter={fighterB}
              opponent={fighterA}
              moves={selectedB}
              choice={choiceB}
              setChoice={setChoiceB}
              team={teamB}
              pp={ppB}
              owner={roster.find((m) => m.id === teamIdsB[0])}
              movePreview={teamMovePreview}
              ppLedger={ppLedger}
              onSwitch={(id) => switchMascot("B", id)}
            />
            <div className="rounded-xl border border-border bg-slate-950 p-3">
              <p className="mb-2 text-xs font-bold text-white">Log</p>
              <div
                ref={logRef}
                className="max-h-72 space-y-1 overflow-y-auto text-[11px] text-slate-400"
              >
                {logs.map((log, i) =>
                  log.startsWith("─") ? (
                    <div key={i} className="my-2 border-t border-slate-700" />
                  ) : (
                    <p
                      key={i}
                      className={
                        /^(PRÉ-JOGO|MOEDA|DRAFT|INICIAL|ORDEM|REVELAÇÃO)/.test(
                          log,
                        )
                          ? "rounded border border-cyan-500/10 bg-slate-900 px-2 py-1.5 text-cyan-200"
                          : "rounded border border-slate-800 bg-slate-900 px-2 py-1.5 leading-relaxed text-slate-300"
                      }
                    >
                      {log}
                    </p>
                  ),
                )}
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
  reorder,
}: {
  label: string;
  ids: string[];
  mascots: MascotOption[];
  toggle: (id: string) => void;
  movePreview: Record<string, LivePvpMove[]>;
  reorder: (id: string, direction: -1 | 1) => void;
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
      <div className="mt-4 border-t border-cyan-500/20 pt-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFCB05]">
              Equipe selecionada
            </p>
            <p className="text-[10px] text-slate-500">
              Ordem de entrada e ficha completa dos escolhidos.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {ids.map((id, index) => {
            const m = mascots.find((entry) => entry.id === id);
            if (!m) return null;
            const hp = toFighter(m).maxHp;
            return (
              <div
                key={id}
                className="rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/5 p-3"
              >
                <div className="flex gap-3">
                  <div className="relative">
                    <img
                      src={m.spriteUrl}
                      alt=""
                      className="h-20 w-20 object-contain [image-rendering:pixelated]"
                    />
                    <span className="absolute -left-1 -top-1 rounded-full bg-[#FFCB05] px-2 py-1 text-[9px] font-black text-slate-950">
                      {index + 1}º
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm text-white">
                        {m.name} · Nv.{m.level}
                      </strong>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => reorder(m.id, -1)}
                          className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-25"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === ids.length - 1}
                          onClick={() => reorder(m.id, 1)}
                          className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-25"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(m.id)}
                          className="rounded border border-red-500/30 px-2 py-1 text-[9px] text-red-300"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      HP {hp} · {m.gameStatus} · Tag {m.performanceTag}
                    </p>
                    <div className="mt-1 flex gap-1">
                      {m.types.map((type) => (
                        <TypeBadge key={type} type={type} />
                      ))}
                    </div>
                    <p className="mt-2 text-[9px] text-slate-400">
                      FOR {m.statForce} · AGI {m.statAgility} · CAR{" "}
                      {m.statCharisma} · INS {m.statInstinct} · VIT{" "}
                      {m.statVitality}
                    </p>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {(movePreview[m.id] ?? []).map((move) => (
                        <div
                          key={move.id}
                          className="rounded bg-slate-950/70 px-2 py-1 text-[9px]"
                        >
                          <b className="text-slate-200">{move.name}</b>
                          <span className="ml-1 text-slate-500">
                            Poder {move.power ?? 0} · PP {move.pp}
                          </span>
                          <p className="text-cyan-300/60">
                            {moveScaling(move)}
                          </p>
                          {effectSummary(move) && (
                            <p className="text-amber-300/60">
                              {effectSummary(move)}
                            </p>
                          )}
                          {move.effect && (
                            <p className="mt-1 leading-relaxed text-slate-500">
                              {move.effect}
                            </p>
                          )}
                        </div>
                      ))}
                      {!movePreview[m.id]?.length && (
                        <p className="text-[9px] text-slate-500">
                          Selecione novamente ou prepare a equipe para carregar
                          os golpes.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function TypeBadge({ type }: { type: string }) {
  const [open, setOpen] = useState(false);
  const strong = TYPE_ADVANTAGE[type] ?? [];
  const weak = Object.entries(TYPE_ADVANTAGE)
    .filter(([, targets]) => targets.includes(type))
    .map(([attacker]) => attacker);
  return (
    <span className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-200"
      >
        {TYPE_ICONS[type] ?? ""} {TYPE_LABELS[type] ?? type}
      </button>
      {open && (
        <span className="absolute left-0 top-full z-30 mt-1 block w-56 rounded-lg border border-slate-700 bg-slate-950 p-2 text-[9px] shadow-xl">
          <b className="text-emerald-300">Forte:</b>{" "}
          {strong.map((value) => TYPE_LABELS[value] ?? value).join(", ") ||
            "nenhum"}
          <br />
          <b className="text-red-300">Fraco:</b>{" "}
          {weak.map((value) => TYPE_LABELS[value] ?? value).join(", ") ||
            "nenhum"}
        </span>
      )}
    </span>
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
  opponent,
  moves,
  choice,
  setChoice,
  team,
  pp,
  owner,
  movePreview,
  ppLedger,
  onSwitch,
}: {
  side: Side;
  active: boolean;
  fighter: LivePvpFighter;
  opponent: LivePvpFighter;
  moves: LivePvpMove[];
  choice: number | null;
  setChoice: (id: number) => void;
  team: LivePvpFighter[];
  pp: Record<number, number>;
  owner?: MascotOption;
  movePreview: Record<string, LivePvpMove[]>;
  ppLedger: Record<string, Record<number, number>>;
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
      </div>
      <div className="mb-3 grid grid-cols-5 gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-center text-[9px] text-slate-400">
        <span>
          FOR
          <br />
          <b className="text-white">{fighter.force}</b>
        </span>
        <span>
          AGI
          <br />
          <b className="text-white">{fighter.agility}</b>
        </span>
        <span>
          CAR
          <br />
          <b className="text-white">{fighter.charisma}</b>
        </span>
        <span>
          INS
          <br />
          <b className="text-white">{fighter.instinct}</b>
        </span>
        <span>
          VIT
          <br />
          <b className="text-white">{fighter.vitality}</b>
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
      <div className="mb-1 mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>HP atual</span>
        <strong className="text-slate-100">
          {fighter.hp}/{fighter.maxHp} HP
        </strong>
      </div>
      <div className="mb-3 h-2 overflow-hidden rounded bg-slate-800">
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
            <span className="mt-1 block rounded bg-cyan-500/5 px-2 py-1 text-[10px] leading-relaxed text-cyan-100/80">
              {moveInfluence(m, fighter, opponent)}
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
              className={`relative rounded-lg border p-1 ${member.hp <= 0 ? "border-red-500/60 bg-red-950/50" : "border-slate-800 bg-slate-900"}`}
            >
              {member.hp <= 0 && (
                <span className="absolute right-1 top-1 z-10 rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-black text-white">
                  K.O.
                </span>
              )}
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
            <div className="mt-3 space-y-1 border-t border-slate-800 pt-2">
              <p className="font-bold uppercase tracking-wider text-slate-500">
                Habilidades e PP
              </p>
              {(movePreview[inspected.id] ?? []).map((move) => (
                <div
                  key={move.id}
                  className="flex items-center justify-between rounded bg-slate-900 px-2 py-1.5"
                >
                  <span className="text-slate-200">
                    {TYPE_ICONS[move.type] ?? ""} {move.name}
                  </span>
                  <b
                    className={
                      (ppLedger[inspected.id]?.[move.id] ?? move.pp) <= 0
                        ? "text-red-300"
                        : "text-cyan-300"
                    }
                  >
                    PP {ppLedger[inspected.id]?.[move.id] ?? move.pp}/{move.pp}
                  </b>
                </div>
              ))}
              {!movePreview[inspected.id]?.length && (
                <p className="text-slate-500">Golpes ainda não carregados.</p>
              )}
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
