"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Clock, Egg } from "lucide-react";
import { getSpriteUrl } from "@/lib/mascot-data";
import { putEggInIncubator, hatchEggAction, skipIncubationAction } from "../actions";

interface IncubatorData {
  id: string;
  eggType: string;
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
}

const EGG_COLORS: Record<string, string> = {
  COMMON:  "border-slate-500/40 bg-slate-800/40",
  RARE:    "border-blue-500/40 bg-blue-900/20",
  SPECIAL: "border-purple-500/40 bg-purple-900/20",
  EVENT:   "border-[#FFCB05]/40 bg-[#FFCB05]/10",
};
const EGG_LABEL: Record<string, string> = {
  COMMON: "Ovo Comum", RARE: "Ovo Raro", SPECIAL: "Ovo Especial", EVENT: "Ovo de Evento"
};
const EGG_IMAGE = "/mascot/egg-common.png";

function Countdown({ finishAt }: { finishAt: Date }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, finishAt.getTime() - Date.now()));

  useEffect(() => {
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

export function IncubatorPanel({ incubator, eggs, canSkipIncubation = false, onHatched }: Props) {
  const [pending, startTransition] = useTransition();
  const [hatchResult, setHatchResult] = useState<{ pokemonId: number; name: string } | null>(null);
  const isReady = incubator ? new Date() >= new Date(incubator.finishAt) : false;

  const handlePutEgg = (eggId: string) => {
    startTransition(async () => {
      const r = await putEggInIncubator(eggId);
      if (r.error) toast.error(r.error);
      else toast.success("Ovo colocado na incubadora!");
    });
  };

  const handleHatch = () => {
    startTransition(async () => {
      const r = await hatchEggAction();
      if (r.error) { toast.error(r.error); return; }
      if (r.result) {
        setHatchResult({ pokemonId: r.result.pokemonId, name: r.result.name });
        onHatched?.(r.result.pokemonId, r.result.name);
      }
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
    <div className="space-y-6">
      {/* Incubadora */}
      <div className="rounded-2xl border border-border bg-slate-950/50 p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-200">
          <span className="text-xl">🥚</span> Incubadora
          <span className="ml-auto text-[10px] text-slate-600">1 slot</span>
        </h2>

        {hatchResult ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="text-4xl animate-bounce">🎉</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getSpriteUrl(hatchResult.pokemonId)} alt={hatchResult.name}
              width={96} height={96} className="object-contain" style={{ imageRendering: "pixelated" }} />
            <p className="text-lg font-bold text-white">{hatchResult.name} nasceu!</p>
            <p className="text-xs text-slate-500">Vá até Meus Mascotes para interagir.</p>
            <button onClick={() => setHatchResult(null)} className="mt-1 text-xs text-[#FFCB05] underline">Fechar</button>
          </div>
        ) : incubator ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <div className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 p-2 ${EGG_COLORS[incubator.eggType]}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={EGG_IMAGE} alt={EGG_LABEL[incubator.eggType]} className="h-full w-full object-contain drop-shadow-[0_0_14px_rgba(255,203,5,0.28)]" />
              </div>
              {isReady && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 animate-ping" />}
            </div>
            <div className="text-center">
              <p className="font-semibold text-white">{EGG_LABEL[incubator.eggType]}</p>
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
                    style={{ width: `${Math.min(100, ((Date.now() - new Date(incubator.startedAt).getTime()) / (new Date(incubator.finishAt).getTime() - new Date(incubator.startedAt).getTime())) * 100)}%` }} />
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
        <div className="rounded-2xl border border-border bg-slate-950/50 p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-200">
            🗂️ Meus Ovos
            <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{eggs.length}</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {eggs.map(egg => (
              <div key={egg.id} className={`flex items-center gap-3 rounded-xl border-2 p-3 ${EGG_COLORS[egg.type]}`}>
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-950/40 p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={EGG_IMAGE} alt={EGG_LABEL[egg.type]} className="h-full w-full object-contain" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{EGG_LABEL[egg.type]}</p>
                  {egg.origin && <p className="text-[10px] text-slate-500">{egg.origin}</p>}
                </div>
                <button type="button" disabled={pending || !!incubator} onClick={() => handlePutEgg(egg.id)}
                  className="shrink-0 rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-40">
                  Incubar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
