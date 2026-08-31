"use client";

import { useState, useEffect, useMemo, useRef, useTransition } from "react";
import { useTimerExpiry } from "@/hooks/use-timer-expiry";
import { toast } from "sonner";
import { Clock, Dna, Egg, Eye, FastForward, FlaskConical, Search, Sparkles, X } from "lucide-react";
import { getShinySprite, getSpriteUrl } from "@/lib/mascot-data";
import {
  putEggInIncubator,
  hatchEggAction,
  confirmLabChoiceAction,
  getIncubatorDropPreviewAction,
  skipIncubationAction,
  type IncubatorDropPreview,
} from "../actions";
import { PerformanceTagPicker } from "./performance-tag-picker";
import { getPokemonName, PERSONALITY_LABEL } from "@/lib/mascot-data";

interface IncubatorData {
  id: string;
  eggType: string;
  eggOrigin?: string;
  hatchRarityBonusPct?: number;
  startedAt: Date;
  finishAt: Date;
  hatched: boolean;
}

interface EggItem { id: string; type: string; obtainedAt: Date; origin: string | null; hatchRarityBonusPct?: number }

type HatchResult = NonNullable<Awaited<ReturnType<typeof hatchEggAction>>["result"]>;
type LabChoice = { pokemonId: number; isShiny: boolean };

interface Props {
  incubator: IncubatorData | null;
  eggs: EggItem[];
  canSkipIncubation?: boolean;
  onHatched?: (pokemonId: number, name: string) => void;
  /** imageUrl por tipo de ovo vindo do shop (ex: { RARE: "https://...", SPECIAL: "https://..." }) */
  eggImages?: Record<string, string>;
  /** Bônus de raridade de evento ativo agora (pontos percentuais). Atualiza no refresh. */
  eventRarityBonusPct?: number;
}

const EGG_COLORS: Record<string, string> = {
  COMMON:  "border-slate-500/40 bg-slate-800/40",
  RARE:    "border-blue-500/40 bg-blue-900/20",
  SPECIAL: "border-purple-500/40 bg-purple-900/20",
  LAB:     "border-teal-500/40 bg-teal-900/20",
  EVENT:   "border-[#FFCB05]/40 bg-[#FFCB05]/10",
};
const EGG_LABEL: Record<string, string> = {
  COMMON: "Ovo Comum", RARE: "Ovo Raro", SPECIAL: "Ovo Especial", LAB: "🧪 Ovo de Laboratório", EVENT: "Ovo de Evento"
};
const TYPE_LABEL: Record<string, string> = {
  normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico", grass: "Planta",
  ice: "Gelo", fighting: "Lutador", poison: "Veneno", ground: "Terra", flying: "Voador",
  psychic: "Psíquico", bug: "Inseto", rock: "Pedra", ghost: "Fantasma", dragon: "Dragão",
  dark: "Sombrio", steel: "Aço", fairy: "Fada",
};

function formatDropChance(value: number) {
  if (value >= 10) return `${value.toFixed(1)}%`;
  if (value >= 1) return `${value.toFixed(2)}%`;
  if (value >= 0.01) return `${value.toFixed(3)}%`;
  return `${value.toFixed(5)}%`;
}
function getEggLabel(type: string, origin?: string) {
  return EGG_LABEL[type] ?? (origin === "LAB" ? "🧪 Ovo de Laboratório" : "Ovo");
}
// Imagem específica por raridade (coloque os arquivos em /public/mascot/)
const EGG_IMAGE: Record<string, string> = {
  COMMON:  "/mascot/egg-common.webp",
  RARE:    "/mascot/egg-common.webp",
  SPECIAL: "/mascot/egg-common.webp",
  LAB:     "/mascot/egg-common.webp",
  EVENT:   "/mascot/egg-common.webp",
};

function Countdown({ finishAt }: { finishAt: Date }) {
  const [remaining, setRemaining] = useState(0); // inicia 0 — atualiza no useEffect para evitar hydration mismatch

  useEffect(() => {
    setRemaining(Math.max(0, finishAt.getTime() - Date.now())); // define valor real após mount
    const interval = setInterval(() => {
      const r = Math.max(0, finishAt.getTime() - Date.now());
      setRemaining(r);
      if (r === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [finishAt]);

  if (remaining === 0) return <span className="text-[#FFCB05] font-semibold">Pronto para chocar! 🎉</span>;

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return <span>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>;
}

const GEN_OPTIONS = [
  { value: "",          label: "🎲 Geração aleatória (+1 ponto percentual de categoria elite)" },
  { value: "EGG_GEN1", label: "1️⃣ Gen 1 — Kanto · Bulbasaur a Mew" },
  { value: "EGG_GEN2", label: "2️⃣ Gen 2 — Johto · Chikorita a Celebi" },
  { value: "EGG_GEN3", label: "3️⃣ Gen 3 — Hoenn · Treecko a Jirachi" },
  { value: "EGG_GEN4", label: "4️⃣ Gen 4 — Sinnoh · Turtwig a Arceus" },
  { value: "EGG_GEN5", label: "5️⃣ Gen 5 — Unova · Snivy a Genesect" },
  { value: "EGG_GEN6", label: "6️⃣ Gen 6 — Kalos · Chespin a Diancie" },
  { value: "EGG_GEN7", label: "7️⃣ Gen 7 — Alola · Rowlet a Zeraora" },
  { value: "EGG_GEN8", label: "8️⃣ Gen 8 — Galar · Grookey a Calyrex" },
  { value: "EGG_GEN9", label: "9️⃣ Gen 9 — Paldea · Sprigatito a Pecharunt" },
];

const HATCH_ANIMATION_PREFERENCE_KEY = "liga:incubator:hatch-animation";

function HatchRoulette({ result, onComplete }: { result: HatchResult; onComplete: () => void }) {
  const candidates = useMemo(() => {
    // A roleta é somente visual. O resultado já foi persistido no servidor antes dela começar.
    const ids = Array.from({ length: 24 }, (_, index) => ((result.pokemonId * 37 + index * 83 + 151) % 1025) + 1);
    return [...ids, result.pokemonId];
  }, [result.pokemonId]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const reelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (revealed) {
      const timer = setTimeout(onComplete, 1800);
      return () => clearTimeout(timer);
    }
    if (index >= candidates.length - 1) {
      const timer = setTimeout(() => setRevealed(true), 720);
      return () => clearTimeout(timer);
    }
    const progress = index / Math.max(1, candidates.length - 1);
    // Começa veloz e desacelera de maneira contínua. O vencedor passa primeiro
    // pela lateral direita antes de parar no centro, sem troca artificial.
    const delay = 75 + Math.round(Math.pow(progress, 3) * 560);
    const timer = setTimeout(() => setIndex((current) => current + 1), delay);
    return () => clearTimeout(timer);
  }, [candidates.length, index, onComplete, revealed]);

  useEffect(() => {
    const reel = reelRef.current;
    const card = reel?.children.item(index) as HTMLElement | null;
    if (!reel || !card) return;
    reel.scrollTo({
      left: card.offsetLeft - (reel.clientWidth - card.clientWidth) / 2,
      behavior: index === 0 ? "auto" : "smooth",
    });
  }, [index]);

  const finalSprite = result.isShiny ? getShinySprite(result.pokemonId, true) : getSpriteUrl(result.pokemonId);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(88,28,135,.42),rgba(2,6,23,.96)_68%)] p-4 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(circle,#fde047_1px,transparent_1.5px)] [background-size:34px_34px]" />
      <div className={`relative w-full max-w-2xl overflow-hidden rounded-[2rem] border p-5 shadow-[0_0_90px_rgba(168,85,247,.28)] transition-all duration-700 sm:p-8 ${revealed ? "border-yellow-300/70 bg-slate-950" : "border-violet-400/40 bg-slate-950/95"}`}>
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 transition-all duration-700 ${revealed ? "bg-gradient-to-r from-yellow-300 via-white to-yellow-300" : "bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400"}`} />
        <div className="relative text-center">
          <p className="text-[10px] font-black uppercase tracking-[.3em] text-violet-300">Incubadora da Liga</p>
          <h3 className="mt-1 text-xl font-black text-white sm:text-2xl">{revealed ? "O destino escolheu!" : "Quem está dentro deste ovo?"}</h3>
          <p className="mt-1 text-xs text-slate-400">O resultado já está protegido no servidor. Agora é só aproveitar a revelação.</p>
        </div>

        <div className="relative my-6 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(30,41,59,.8),rgba(2,6,23,.9))] py-7">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-[34%] -translate-x-1/2 border-x border-yellow-300/30 bg-yellow-300/[.035] shadow-[0_0_45px_rgba(250,204,21,.12)]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-slate-950 to-transparent sm:w-28" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-slate-950 to-transparent sm:w-28" />
          <div ref={reelRef} className="relative flex items-center overflow-x-hidden px-[33.333%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {candidates.map((pokemonId, candidateIndex) => {
              const distance = Math.abs(candidateIndex - index);
              const center = distance === 0;
              const isWinner = revealed && candidateIndex === candidates.length - 1;
              const sprite = isWinner ? finalSprite : getSpriteUrl(pokemonId);
              return (
                <div key={`${candidateIndex}-${pokemonId}`} className={`flex w-1/3 shrink-0 flex-col items-center rounded-2xl border px-1 py-4 transition-[opacity,transform,filter,border-color,box-shadow] duration-300 sm:px-2 ${center ? "scale-105 border-yellow-300/60 bg-yellow-300/10 opacity-100" : distance === 1 ? "scale-90 border-white/10 bg-black/20 opacity-40 blur-[.3px]" : "scale-75 border-transparent opacity-10 blur-[1px]"} ${isWinner ? "animate-pulse shadow-[0_0_45px_rgba(250,204,21,.35)]" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sprite} alt="" className="h-24 w-24 object-contain transition-all sm:h-32 sm:w-32" style={{ imageRendering: "pixelated" }} />
                  <p className={`mt-2 max-w-full truncate text-xs font-bold sm:text-sm ${center ? "text-white" : "text-slate-500"}`}>{isWinner ? result.name : getPokemonName(pokemonId)}</p>
                </div>
              );
            })}
          </div>
          {!revealed && <div className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400" /></div>}
        </div>

        <div className="relative flex items-center justify-between gap-3">
          <p className={`text-xs font-semibold ${revealed ? "text-yellow-200" : "text-slate-400"}`}>{revealed ? `${result.name} nasceu! Preparando a ficha completa…` : "As possibilidades estão passando pela incubadora…"}</p>
          <button type="button" onClick={onComplete} className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 transition hover:border-yellow-300/50 hover:text-yellow-200">
            <FastForward size={13} /> {revealed ? "Ver ficha" : "Pular"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LabChoiceReveal({ choices, onComplete }: { choices: LabChoice[]; onComplete: () => void }) {
  const [revealedCount, setRevealedCount] = useState(0);
  const completed = revealedCount >= choices.length;

  useEffect(() => {
    if (completed) return;
    const delay = revealedCount === 0 ? 850 : 1050;
    const timer = setTimeout(() => setRevealedCount((count) => count + 1), delay);
    return () => clearTimeout(timer);
  }, [completed, revealedCount]);

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(13,148,136,.28),rgba(2,6,23,.97)_68%)] p-4 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(45,212,191,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative w-full max-w-3xl overflow-hidden rounded-[2rem] border border-teal-300/45 bg-slate-950/95 p-5 shadow-[0_0_100px_rgba(20,184,166,.22)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-white to-teal-400" />
        <div className="flex items-center justify-center gap-3 text-center">
          <span className="grid size-11 place-items-center rounded-2xl border border-teal-300/30 bg-teal-300/10 text-teal-200"><FlaskConical size={22} /></span>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-[.3em] text-teal-300">Protocolo de incubação avançada</p>
            <h3 className="text-xl font-black text-white sm:text-2xl">Três sinais de vida detectados</h3>
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-xl text-center text-xs leading-relaxed text-slate-400">
          O laboratório está estabilizando cada possibilidade. Todos os três candidatos serão revelados antes que você decida qual deles nascerá.
        </p>

        <div className="my-7 grid grid-cols-3 gap-2 sm:gap-5">
          {choices.map((choice, slot) => {
            const visible = slot < revealedCount;
            const scanning = slot === revealedCount;
            const sprite = choice.isShiny ? getShinySprite(choice.pokemonId, true) : getSpriteUrl(choice.pokemonId);
            return (
              <div key={`${slot}-${choice.pokemonId}`} className={`relative min-w-0 overflow-hidden rounded-[1.4rem] border p-2 transition-all duration-700 sm:p-4 ${visible ? "border-teal-300/55 bg-teal-300/[.08] shadow-[0_0_35px_rgba(45,212,191,.18)]" : scanning ? "scale-[1.03] border-cyan-300/60 bg-cyan-300/[.07] shadow-[0_0_45px_rgba(34,211,238,.24)]" : "border-slate-700/70 bg-slate-900/70 opacity-55"}`}>
                <div className="absolute left-2 top-2 z-10 rounded-full border border-white/10 bg-slate-950/80 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-slate-400">Cápsula {slot + 1}</div>
                <div className="relative mt-7 flex aspect-[.82] items-center justify-center overflow-hidden rounded-2xl border border-white/[.06] bg-[linear-gradient(180deg,rgba(15,118,110,.12),rgba(2,6,23,.7))]">
                  {scanning && (
                    <>
                      <div className="absolute inset-x-0 top-0 h-1/3 animate-bounce bg-gradient-to-b from-cyan-300/40 to-transparent blur-sm" />
                      <Dna size={30} className="animate-pulse text-cyan-200" />
                    </>
                  )}
                  {!visible && !scanning && <span className="text-4xl font-black text-slate-700">?</span>}
                  {visible && (
                    <>
                      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle,rgba(94,234,212,.18),transparent_65%)]" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sprite} alt="" className="relative h-24 w-24 object-contain drop-shadow-[0_0_18px_rgba(94,234,212,.35)] sm:h-36 sm:w-36" style={{ imageRendering: "pixelated" }} />
                    </>
                  )}
                </div>
                <div className="min-h-12 pt-2 text-center">
                  <p className={`truncate text-[10px] font-black sm:text-sm ${visible ? choice.isShiny ? "text-yellow-200" : "text-white" : "text-slate-600"}`}>
                    {visible ? getPokemonName(choice.pokemonId) : scanning ? "Analisando…" : "Aguardando sinal"}
                  </p>
                  {visible && choice.isShiny && <p className="mt-0.5 text-[8px] font-black uppercase tracking-wider text-yellow-300">✦ Assinatura shiny</p>}
                  {visible && !choice.isShiny && <p className="mt-0.5 text-[8px] uppercase tracking-wider text-teal-300/70">Sinal estabilizado</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-300/15 bg-teal-300/[.04] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className={`size-2 rounded-full ${completed ? "bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" : "animate-pulse bg-cyan-300"}`} />
            {completed ? "Análise concluída. Os três candidatos estão prontos." : `Analisando cápsula ${Math.min(revealedCount + 1, choices.length)} de ${choices.length}…`}
          </div>
          <button type="button" onClick={onComplete} className={`rounded-xl px-4 py-2 text-xs font-black transition ${completed ? "bg-gradient-to-r from-teal-300 to-cyan-300 text-slate-950 shadow-[0_0_22px_rgba(45,212,191,.22)] hover:brightness-110" : "border border-slate-700 bg-slate-900 text-slate-400 hover:text-white"}`}>
            {completed ? "Escolher meu mascote" : "Pular análise"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function IncubatorPanel({ incubator, eggs, canSkipIncubation = false, onHatched, eggImages = {}, eventRarityBonusPct = 0 }: Props) {
  // Resolve a imagem: usa a do shop se disponível, senão usa o arquivo local estático
  const resolveEggImg = (type: string) =>
    eggImages[type] ?? EGG_IMAGE[type] ?? EGG_IMAGE.COMMON;
  const [pending, startTransition] = useTransition();
  const [showHatchAnimation, setShowHatchAnimation] = useState(true);
  const [animatedResult, setAnimatedResult] = useState<HatchResult | null>(null);
  const [labRevealChoices, setLabRevealChoices] = useState<LabChoice[] | null>(null);
  const [hatchResult, setHatchResult] = useState<{
    mascotId: string;
    pokemonId: number;
    name: string;
    isShiny?: boolean;
    isStatBuffed?: boolean;
    personality?: string;
    stats?: { force: number; agility: number; charisma: number; instinct: number; vitality: number };
    statRange?: [number, number];
  } | null>(null);
  const [labChoices, setLabChoices] = useState<LabChoice[] | null>(null);
  const [selectedGen, setSelectedGen] = useState<string>("");
  const [dropPreview, setDropPreview] = useState<IncubatorDropPreview | null>(null);
  const [dropPreviewOpen, setDropPreviewOpen] = useState(false);
  const [dropPreviewLoading, setDropPreviewLoading] = useState(false);
  const [dropCategory, setDropCategory] = useState("ALL");
  const [dropSearch, setDropSearch] = useState("");
  const [dropPage, setDropPage] = useState(1);
  const [expandedForms, setExpandedForms] = useState<Set<number>>(new Set());
  // Modal de seleção de geração
  const [genPickEggId, setGenPickEggId] = useState<string | null>(null); // ID do ovo esperando confirmação
  // useTimerExpiry: atualiza automaticamente — botão "Chocar" aparece quando o tempo acaba
  const incubatorExpiry = useTimerExpiry(incubator?.finishAt ?? null);
  const isReady = !!incubator && incubatorExpiry.expired;
  const filteredDrops = useMemo(() => {
    if (!dropPreview) return [];
    const normalizedSearch = dropSearch.trim().toLocaleLowerCase("pt-BR");
    return dropPreview.drops.filter((drop) =>
      (dropCategory === "ALL" || drop.category === dropCategory)
      && (!normalizedSearch || drop.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch)),
    );
  }, [dropCategory, dropPreview, dropSearch]);
  const dropPageSize = 12;
  const dropPageCount = Math.max(1, Math.ceil(filteredDrops.length / dropPageSize));
  const visibleDrops = filteredDrops.slice((dropPage - 1) * dropPageSize, dropPage * dropPageSize);

  useEffect(() => {
    const saved = window.localStorage.getItem(HATCH_ANIMATION_PREFERENCE_KEY);
    if (saved !== null) setShowHatchAnimation(saved !== "false");
  }, []);

  useEffect(() => {
    setDropPage((current) => Math.min(current, dropPageCount));
  }, [dropPageCount]);

  const handlePutEgg = (eggId: string, genOverride?: string) => {
    startTransition(async () => {
      const r = await putEggInIncubator(eggId, genOverride || undefined);
      if (r.error) toast.error(r.error);
      else toast.success("Ovo colocado na incubadora!");
    });
  };

  // Confirmar seleção de geração no modal
  const handleConfirmGen = () => {
    if (!genPickEggId) return;
    handlePutEgg(genPickEggId, selectedGen || undefined);
    setGenPickEggId(null);
    setSelectedGen("");
  };

  const revealHatchResult = (result: HatchResult) => {
    setHatchResult({
      mascotId: result.mascotId,
      pokemonId: result.pokemonId,
      name: result.name,
      isShiny: result.isShiny,
      isStatBuffed: result.isStatBuffed,
      personality: result.personality,
      stats: result.stats,
      statRange: result.statRange,
    });
    onHatched?.(result.pokemonId, result.name);
  };

  const applyHatchResult = (result: HatchResult) => {
    if (showHatchAnimation) setAnimatedResult(result);
    else revealHatchResult(result);
  };

  const handleHatch = () => {
    startTransition(async () => {
      const r = await hatchEggAction();
      if (r.error) { toast.error(r.error); return; }
      if (r.labChoices) {
        if (showHatchAnimation) setLabRevealChoices(r.labChoices);
        else setLabChoices(r.labChoices);
        return;
      }
      if (r.result) applyHatchResult(r.result);
    });
  };

  const handleLabChoice = (pokemonId: number) => {
    startTransition(async () => {
      const r = await confirmLabChoiceAction(pokemonId);
      if (r.error) { toast.error(r.error); return; }
      setLabChoices(null);
      // O laboratório já fez sua revelação especial antes da escolha. Depois da
      // confirmação mostramos diretamente a ficha do mascote escolhido.
      if (r.result) revealHatchResult(r.result);
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      const r = await skipIncubationAction();
      if (r.error) toast.error(r.error);
      else toast.success("Tempo de incubação pulado. O ovo já pode chocar!");
    });
  };

  const handleOpenDropPreview = async () => {
    setDropPreviewOpen(true);
    setDropPreviewLoading(true);
    setDropCategory("ALL");
    setDropSearch("");
    setDropPage(1);
    const result = await getIncubatorDropPreviewAction();
    setDropPreviewLoading(false);
    if (result.error || !result.preview) {
      setDropPreviewOpen(false);
      toast.error(result.error ?? "Não foi possível calcular os possíveis drops.");
      return;
    }
    setDropPreview(result.preview);
  };

  return (
    <>
    {animatedResult && (
      <HatchRoulette
        result={animatedResult}
        onComplete={() => {
          const result = animatedResult;
          setAnimatedResult(null);
          revealHatchResult(result);
        }}
      />
    )}
    {labRevealChoices && (
      <LabChoiceReveal
        choices={labRevealChoices}
        onComplete={() => {
          setLabChoices(labRevealChoices);
          setLabRevealChoices(null);
        }}
      />
    )}
    {/* Modal calculado sob demanda com a pool real do ovo incubado */}
    {dropPreviewOpen && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 sm:p-5" onClick={() => setDropPreviewOpen(false)}>
        <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cyan-400/30 bg-slate-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start gap-3 border-b border-border bg-gradient-to-r from-cyan-500/10 to-purple-500/10 p-4 sm:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Sparkles size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-white sm:text-lg">Possíveis drops deste ovo</h3>
              {dropPreview ? (
                <p className="mt-1 text-xs text-slate-400">
                  {getEggLabel(dropPreview.eggType)} · Geração {dropPreview.generation} · probabilidades da sua conta agora
                </p>
              ) : <p className="mt-1 text-xs text-slate-500">Calculando a pool real...</p>}
            </div>
            <button type="button" onClick={() => setDropPreviewOpen(false)} className="rounded-lg border border-border p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Fechar">
              <X size={17} />
            </button>
          </div>

          {dropPreviewLoading ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-sm text-slate-400">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
              Conferindo geração, bônus e proteção de repetidos...
            </div>
          ) : dropPreview && (
            <>
              <div className="space-y-3 border-b border-border p-4 sm:p-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-slate-900/70 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Bônus do ovo</p>
                    <p className="mt-1 text-sm font-bold text-purple-300">+{dropPreview.eggBonusPct} ponto(s) percentuais</p>
                  </div>
                  <div className="rounded-xl border border-border bg-slate-900/70 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Escolha de geração</p>
                    <p className="mt-1 text-sm font-bold text-cyan-300">{dropPreview.generationWasRandom ? "+1 ponto percentual (aleatória)" : "Geração escolhida"}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-slate-900/70 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Evento ativo</p>
                    <p className="mt-1 text-sm font-bold text-emerald-300">+{dropPreview.eventBonusPct} ponto(s) percentuais</p>
                  </div>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-500">
                  A chance considera a pool atual, somente formas iniciais e a proteção contra espécies que você já possui. Se seu inventário ou um bônus de evento mudar antes do ovo chocar, os valores podem mudar também.
                  {dropPreview.labChoices && " No Ovo de Laboratório, o percentual exibido é a chance real na primeira opção. As duas opções seguintes excluem as anteriores e recalculam a pool; por isso, a chance de o mascote aparecer no trio é maior."}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dropPreview.categories.map((category) => (
                    <button key={category.id} type="button" onClick={() => { setDropCategory(category.id); setDropPage(1); }}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${dropCategory === category.id ? "border-[#FFCB05]/60 bg-[#FFCB05]/15 text-[#FFCB05]" : "border-border bg-slate-900 text-slate-400 hover:text-slate-200"}`}>
                      <span className="block text-[11px] font-bold">{category.label}</span>
                      <span className="block text-[9px] opacity-75">{formatDropChance(category.chancePct)} · {category.count}</span>
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-border bg-slate-900 px-3 py-2 focus-within:border-cyan-400/50">
                  <Search size={15} className="shrink-0 text-slate-500" />
                  <input value={dropSearch} onChange={(event) => { setDropSearch(event.target.value); setDropPage(1); }} placeholder="Buscar um mascote pelo nome..."
                    className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600" />
                  <span className="text-[10px] text-slate-600">{filteredDrops.length} resultado(s)</span>
                </label>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {visibleDrops.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleDrops.map((drop) => {
                      const hasForms = Boolean(drop.forms && drop.forms.length > 1);
                      const isExpanded = expandedForms.has(drop.pokemonId);
                      return (
                      <div key={drop.pokemonId} className={`rounded-xl border bg-slate-900/65 p-3 ${hasForms ? "border-cyan-400/30" : "border-border"} ${hasForms && isExpanded ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                        <div
                          className={`flex items-center gap-3 ${hasForms ? "cursor-pointer" : ""}`}
                          onClick={hasForms ? () => setExpandedForms((prev) => { const next = new Set(prev); if (next.has(drop.pokemonId)) next.delete(drop.pokemonId); else next.add(drop.pokemonId); return next; }) : undefined}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={drop.spriteUrl} alt={drop.name} className="h-14 w-14 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-xs font-bold text-white">{drop.name}</p>
                              <span className="shrink-0 text-[11px] font-black text-[#FFCB05]">{formatDropChance(drop.chancePct)}</span>
                            </div>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-purple-300">{drop.categoryLabel}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {drop.types.map((type) => <span key={type} className="rounded border border-border bg-slate-950 px-1.5 py-0.5 text-[8px] text-slate-400">{TYPE_LABEL[type.toLowerCase()] ?? type}</span>)}
                              {drop.custom && <span className="rounded border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-0.5 text-[8px] text-cyan-300">Customizado</span>}
                              {hasForms && <span className="rounded border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-0.5 text-[8px] font-bold text-cyan-300">{drop.forms!.length} formas {isExpanded ? "▲" : "▼"}</span>}
                            </div>
                            <p className="mt-1 text-[9px] text-slate-600">Você possui {drop.ownedCopies} desta forma inicial</p>
                          </div>
                        </div>
                        {hasForms && isExpanded && (
                          <div className="mt-3 rounded-lg border border-cyan-400/20 bg-slate-950/60 p-2">
                            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-cyan-300">Segunda rolagem — forma sorteada ({drop.forms!.length} formas, peso igual)</p>
                            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                              {drop.forms!.map((form) => (
                                <div key={form.pokemonId} className="flex items-center gap-2 rounded-lg border border-border bg-slate-900/60 px-2 py-1.5">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={form.spriteUrl} alt={form.name} className="h-9 w-9 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[10px] font-semibold text-white">{form.name}{form.isBase && <span className="ml-1 text-[8px] font-bold text-slate-500">base</span>}</p>
                                    <p className="text-[8px] text-slate-500">{form.types.map((t) => TYPE_LABEL[t.toLowerCase()] ?? t).join(" / ")}</p>
                                  </div>
                                  <span className="shrink-0 text-[10px] font-black text-cyan-300">{form.internalPct.toFixed(1)}%</span>
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-[8px] text-slate-600">Essas % são a rolagem interna entre as formas desta espécie. A chance de cair a espécie ({formatDropChance(drop.chancePct)}) é dividida entre elas.</p>
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border text-xs text-slate-500">Nenhum mascote encontrado nesta categoria.</div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border bg-slate-950 p-4">
                <button type="button" disabled={dropPage <= 1} onClick={() => setDropPage((page) => page - 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-300 disabled:opacity-30">Anterior</button>
                <span className="text-[10px] text-slate-500">Página {dropPage} de {dropPageCount}</span>
                <button type="button" disabled={dropPage >= dropPageCount} onClick={() => setDropPage((page) => page + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-slate-300 disabled:opacity-30">Próxima</button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    {/* Modal de seleção de geração */}
    {genPickEggId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
           onClick={() => { setGenPickEggId(null); setSelectedGen(""); }}>
        <div className="w-full max-w-sm rounded-2xl border border-[#FFCB05]/30 bg-slate-950 p-5 shadow-2xl space-y-4"
             onClick={e => e.stopPropagation()}>
          <p className="font-semibold text-white">🥚 Escolha a Geração</p>
          <p className="text-[11px] text-slate-400">Escolha uma geração ou deixe o sorteio decidir. O tipo do ovo define as chances de raridade e os atributos; a geração define quais formas iniciais podem nascer. A opção aleatória ganha +1 ponto percentual de chance de categoria elite.</p>
          <select value={selectedGen} onChange={e => setSelectedGen(e.target.value)}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]">
            {GEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setGenPickEggId(null); setSelectedGen(""); }}
              className="flex-1 rounded-xl border border-border py-2 text-xs text-slate-400 hover:text-slate-200">
              Cancelar
            </button>
            <button type="button" disabled={pending} onClick={handleConfirmGen}
              className="flex-1 rounded-xl bg-[#FFCB05] py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60">
              Incubar
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Modal de escolha do ovo de laboratório */}
    {labChoices && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#FFCB05]/40 bg-slate-950 p-5 shadow-2xl space-y-4">
          <div className="text-center space-y-1">
            <p className="text-lg font-bold text-white">🧪 Ovo de Laboratório</p>
            <p className="text-xs text-slate-400">Escolha um dos 3 Pokémon para nascer do ovo:</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {labChoices.map(choice => (
              <button key={choice.pokemonId} type="button" disabled={pending} onClick={() => handleLabChoice(choice.pokemonId)}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border bg-slate-900 p-3 transition-colors disabled:opacity-50 ${choice.isShiny ? "border-yellow-400/70 shadow-[0_0_20px_rgba(250,204,21,0.16)] hover:border-yellow-300" : "border-border hover:border-[#FFCB05]/60 hover:bg-slate-800"}`}>
                {choice.isShiny && (
                  <span className="absolute right-1 top-1 rounded-full border border-yellow-300/50 bg-yellow-400/15 px-1.5 py-0.5 text-[8px] font-black text-yellow-200">
                    ✨ SHINY
                  </span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={choice.isShiny ? getShinySprite(choice.pokemonId, true) : getSpriteUrl(choice.pokemonId)}
                  alt={getPokemonName(choice.pokemonId)} width={64} height={64}
                  className="object-contain" style={{ imageRendering: "pixelated" }}
                  onError={event => {
                    const image = event.currentTarget as HTMLImageElement;
                    image.onerror = null;
                    image.src = choice.isShiny
                      ? getShinySprite(choice.pokemonId, false)
                      : getSpriteUrl(choice.pokemonId);
                  }}
                />
                <span className={`text-center text-[10px] leading-tight ${choice.isShiny ? "font-bold text-yellow-200" : "text-slate-300"}`}>
                  {getPokemonName(choice.pokemonId)}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 text-center">
            O Pokémon não escolhido não é perdido — apenas o escolhido nasce.
            {showHatchAnimation && <span className="mt-1 block text-teal-300/80">As três cápsulas já foram analisadas. Agora a decisão é sua.</span>}
          </p>
        </div>
      </div>
    )}

    <div className="space-y-6">
      {/* Incubadora */}
      <div className="rounded-2xl border border-border bg-slate-950/50 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-200">
            <span className="text-xl">🥚</span> Incubadora
            <span className="text-[10px] text-slate-600">1 slot</span>
          </h2>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-400/[.06] px-3 py-2 text-[11px] text-slate-300 transition hover:border-violet-400/40">
            <input
              type="checkbox"
              checked={showHatchAnimation}
              onChange={(event) => {
                setShowHatchAnimation(event.target.checked);
                window.localStorage.setItem(HATCH_ANIMATION_PREFERENCE_KEY, String(event.target.checked));
              }}
              className="size-4 accent-violet-500"
            />
            {showHatchAnimation ? <Sparkles size={13} className="text-violet-300" /> : <Eye size={13} className="text-slate-500" />}
            <span><strong className="text-white">Abertura animada</strong><span className="ml-1 text-slate-500">{showHatchAnimation ? "ativada" : "resultado direto"}</span></span>
          </label>
        </div>

        {hatchResult ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="text-4xl animate-bounce">🎉</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getSpriteUrl(hatchResult.pokemonId)} alt={hatchResult.name}
              width={96} height={96} className="object-contain" style={{ imageRendering: "pixelated" }} />
            <div className="text-center space-y-0.5">
              <p className="text-lg font-bold text-white">
                {hatchResult.name} nasceu!
                {hatchResult.isShiny && <span className="ml-1.5 text-base">✦</span>}
              </p>
              {hatchResult.personality && (
                <p className="text-xs font-semibold text-[#FFCB05]">
                  Personalidade: {PERSONALITY_LABEL[hatchResult.personality] ?? hatchResult.personality}
                </p>
              )}
              {hatchResult.isShiny && (
                <p className="text-xs text-yellow-400 font-semibold">⚡ Shiny! Raridade extrema.</p>
              )}
              {hatchResult.isStatBuffed && (
                <p className="text-xs text-purple-400 font-semibold">✨ Stats acima do normal pelo tipo de ovo!</p>
              )}
            </div>

            {/* Stats ao nascer */}
            {hatchResult.stats && (
              <div className="w-full max-w-xs rounded-xl border border-border/50 bg-slate-900/60 p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold text-center">Stats ao nascer</p>
                {(() => {
                  const [rMin, rMax] = hatchResult.statRange ?? [8, 14];
                  const rows: { label: string; key: keyof typeof hatchResult.stats; emoji: string }[] = [
                    { label: "Força",      key: "force",    emoji: "⚔️" },
                    { label: "Agilidade",  key: "agility",  emoji: "💨" },
                    { label: "Carisma",    key: "charisma", emoji: "✨" },
                    { label: "Instinto",   key: "instinct", emoji: "🔮" },
                    { label: "Vitalidade", key: "vitality", emoji: "❤️" },
                  ];
                  return rows.map(row => {
                    const val = hatchResult.stats![row.key];
                    const isAbove = val > rMax;
                    const isBelow = val < rMin;
                    return (
                      <div key={row.key} className="flex items-center gap-2">
                        <span className="text-sm w-5 text-center leading-none">{row.emoji}</span>
                        <span className="text-xs text-slate-400 w-20">{row.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            isAbove ? "bg-purple-400" : isBelow ? "bg-red-500/60" : "bg-[#FFCB05]"
                          }`} style={{ width: `${Math.min(100, (val / 30) * 100)}%` }} />
                        </div>
                        <span className={`text-xs font-bold w-6 text-right ${
                          isAbove ? "text-purple-300" : isBelow ? "text-red-400" : "text-slate-200"
                        }`}>{val}</span>
                        {isAbove && <span className="text-[10px] text-purple-400 leading-none">⬆</span>}
                        {isBelow && <span className="text-[10px] text-red-400 leading-none">⬇</span>}
                      </div>
                    );
                  });
                })()}
                <p className="text-[9px] text-slate-600 text-center pt-0.5">
                  Range normal deste ovo: {hatchResult.statRange?.[0]}–{hatchResult.statRange?.[1]} por stat
                </p>
              </div>
            )}

            {/* Já marque o desempenho do recém-chocado */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Marcar desempenho:</span>
              <PerformanceTagPicker mascotId={hatchResult.mascotId} initial="NEUTRO" size="md" align="left" />
            </div>

            <p className="text-xs text-slate-500">Vá até Meus Mascotes para interagir.</p>
            <button onClick={() => setHatchResult(null)} className="mt-1 text-xs text-[#FFCB05] underline">Fechar</button>
          </div>
        ) : incubator ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 p-2 ${EGG_COLORS[incubator.eggType]}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveEggImg(incubator.eggType)} alt={EGG_LABEL[incubator.eggType]} className="h-full w-full object-contain drop-shadow-[0_0_14px_rgba(255,203,5,0.28)]" />
              </div>
              {isReady && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 animate-ping" />}
            </div>
            <div className="text-center">
              <p className="font-semibold text-white">{getEggLabel(incubator.eggType, incubator.eggOrigin)}</p>
              {!!incubator.hatchRarityBonusPct && (
                <p className="text-[10px] font-semibold text-purple-300">
                  +{incubator.hatchRarityBonusPct} pontos percentuais de chance de mascote de raridade elevada
                </p>
              )}
              {eventRarityBonusPct > 0 && (
                <p className="text-[10px] font-semibold text-emerald-300">
                  🎉 Evento ativo: +{eventRarityBonusPct} ponto(s) percentuais aplicados ao abrir o ovo agora
                </p>
              )}
              <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                <Clock size={12} />
                <Countdown finishAt={new Date(incubator.finishAt)} />
              </div>
            </div>
            <button type="button" disabled={dropPreviewLoading} onClick={handleOpenDropPreview}
              className="rounded-xl border border-cyan-400/35 bg-cyan-400/10 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/15 disabled:opacity-50">
              ✨ Ver possíveis drops
            </button>
            {isReady && (
              <button type="button" disabled={pending} onClick={handleHatch}
                className="rounded-xl bg-[#FFCB05] px-6 py-2.5 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50 animate-pulse">
                Chocar ovo! 🐣
              </button>
            )}
            {!isReady && (
              <div className="flex w-full flex-col items-center gap-3">
                <div className="h-2 w-full max-w-[200px] rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-[#FFCB05] transition-all"
                    style={{ width: `${typeof window === "undefined" ? 0 : Math.min(100, ((Date.now() - new Date(incubator.startedAt).getTime()) / Math.max(1, new Date(incubator.finishAt).getTime() - new Date(incubator.startedAt).getTime())) * 100)}%` }} />
                </div>
                {canSkipIncubation && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={handleSkip}
                    className="rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-3 py-1.5 text-xs font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50"
                  >
                    Admin: pular incubação
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8">
            <Egg size={28} className="text-slate-600" />
            <p className="text-sm text-slate-500">Incubadora vazia</p>
            <p className="text-xs text-slate-600">Selecione um ovo abaixo para incubar.</p>
          </div>
        )}
      </div>

      {/* Inventário de ovos */}
      {eggs.length > 0 && (
        <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
          <h2 className="flex items-center gap-2 font-semibold text-slate-200">
            🗂️ Meus Ovos
            <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{eggs.length}</span>
          </h2>

          {/* Seletor de geração: abre modal ao clicar em Incubar */}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {eggs.map(egg => (
              <div key={egg.id} className={`flex items-center gap-3 rounded-xl border-2 p-3 ${EGG_COLORS[egg.type]}`}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-950/40 p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveEggImg(egg.type)} alt={EGG_LABEL[egg.type]} className="h-full w-full object-contain" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{getEggLabel(egg.type, egg.origin ?? undefined)}</p>
                  {!!egg.hatchRarityBonusPct && (
                    <p className="text-[10px] font-semibold text-purple-300">
                      +{egg.hatchRarityBonusPct} pontos percentuais de chance de mascote de raridade elevada
                    </p>
                  )}
                  {egg.origin && <p className="text-[10px] text-slate-500">{egg.origin}</p>}
                </div>
                <button type="button" disabled={pending || !!incubator} onClick={() => { setSelectedGen(""); setGenPickEggId(egg.id); }}
                  className="shrink-0 rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40">
                  Incubar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
