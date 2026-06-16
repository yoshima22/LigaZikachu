"use client";

import { useState, useEffect, useTransition } from "react";
import { useTimerExpiry } from "@/hooks/use-timer-expiry";
import { toast } from "sonner";
import { Clock, Egg } from "lucide-react";
import { getSpriteUrl } from "@/lib/mascot-data";
import { putEggInIncubator, hatchEggAction, confirmLabChoiceAction, skipIncubationAction } from "../actions";
import { getPokemonName } from "@/lib/mascot-data";

interface IncubatorData {
  id: string;
  eggType: string;
  eggOrigin?: string;
  startedAt: Date;
  finishAt: Date;
  hatched: boolean;
}

interface EggItem { id: string; type: string; obtainedAt: Date; origin: string | null }

interface Props {
  incubator: IncubatorData | null;
  eggs: EggItem[];
  canSkipIncubation?: boolean;
  onHatched?: (pokemonId: number, name: string) => void;
  /** imageUrl por tipo de ovo vindo do shop (ex: { RARE: "https://...", SPECIAL: "https://..." }) */
  eggImages?: Record<string, string>;
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
  { value: "",          label: "🎲 Todas as gerações (aleatório)" },
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

export function IncubatorPanel({ incubator, eggs, canSkipIncubation = false, onHatched, eggImages = {} }: Props) {
  // Resolve a imagem: usa a do shop se disponível, senão usa o arquivo local estático
  const resolveEggImg = (type: string) =>
    eggImages[type] ?? EGG_IMAGE[type] ?? EGG_IMAGE.COMMON;
  const [pending, startTransition] = useTransition();
  const [hatchResult, setHatchResult] = useState<{
    pokemonId: number;
    name: string;
    isShiny?: boolean;
    isStatBuffed?: boolean;
    stats?: { force: number; agility: number; charisma: number; instinct: number; vitality: number };
    statRange?: [number, number];
  } | null>(null);
  const [labChoices, setLabChoices] = useState<number[] | null>(null);
  const [selectedGen, setSelectedGen] = useState<string>("");
  // Modal de seleção de geração
  const [genPickEggId, setGenPickEggId] = useState<string | null>(null); // ID do ovo esperando confirmação
  // useTimerExpiry: atualiza automaticamente — botão "Chocar" aparece quando o tempo acaba
  const incubatorExpiry = useTimerExpiry(incubator?.finishAt ?? null);
  const isReady = !!incubator && incubatorExpiry.expired;

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

  const applyHatchResult = (result: NonNullable<Awaited<ReturnType<typeof hatchEggAction>>["result"]>) => {
    setHatchResult({
      pokemonId: result.pokemonId,
      name: result.name,
      isShiny: result.isShiny,
      isStatBuffed: result.isStatBuffed,
      stats: result.stats,
      statRange: result.statRange,
    });
    onHatched?.(result.pokemonId, result.name);
  };

  const handleHatch = () => {
    startTransition(async () => {
      const r = await hatchEggAction();
      if (r.error) { toast.error(r.error); return; }
      if (r.labChoices) { setLabChoices(r.labChoices); return; }
      if (r.result) applyHatchResult(r.result);
    });
  };

  const handleLabChoice = (pokemonId: number) => {
    startTransition(async () => {
      const r = await confirmLabChoiceAction(pokemonId);
      if (r.error) { toast.error(r.error); return; }
      setLabChoices(null);
      if (r.result) applyHatchResult(r.result);
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      const r = await skipIncubationAction();
      if (r.error) toast.error(r.error);
      else toast.success("Tempo de incubação pulado. O ovo já pode chocar!");
    });
  };

  return (
    <>
    {/* Modal de seleção de geração */}
    {genPickEggId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
           onClick={() => { setGenPickEggId(null); setSelectedGen(""); }}>
        <div className="w-full max-w-sm rounded-2xl border border-[#FFCB05]/30 bg-slate-950 p-5 shadow-2xl space-y-4"
             onClick={e => e.stopPropagation()}>
          <p className="font-semibold text-white">🥚 Escolha a Geração</p>
          <p className="text-[11px] text-slate-400">Qual geração de Pokémon você quer que saia deste ovo? Cada ovo respeita sua própria raridade.</p>
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
            {labChoices.map(id => (
              <button key={id} type="button" disabled={pending} onClick={() => handleLabChoice(id)}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-slate-900 p-3 hover:border-[#FFCB05]/60 hover:bg-slate-800 transition-colors disabled:opacity-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getSpriteUrl(id)} alt={getPokemonName(id)} width={64} height={64}
                  className="object-contain" style={{ imageRendering: "pixelated" }} />
                <span className="text-[10px] text-slate-300 text-center leading-tight">{getPokemonName(id)}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 text-center">O Pokémon não escolhido não é perdido — apenas o escolhido nasce.</p>
        </div>
      </div>
    )}

    <div className="space-y-6">
      {/* Incubadora */}
      <div className="rounded-2xl border border-border bg-slate-950/50 p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-200">
          <span className="text-xl">🥚</span> Incubadora
          <span className="ml-auto text-[10px] text-slate-600">1 slot</span>
        </h2>

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
              <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                <Clock size={12} />
                <Countdown finishAt={new Date(incubator.finishAt)} />
              </div>
            </div>
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
