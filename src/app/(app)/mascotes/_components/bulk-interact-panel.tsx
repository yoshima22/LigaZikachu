"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Gamepad2, Hand, Loader2, Users } from "lucide-react";
import { interactAllAction } from "../actions";
import { markPlayed, markPetted } from "./mascot-card";
import { formatRemaining } from "@/hooks/use-timer-expiry";

interface Props {
  scope: "ALL" | "FAVORITES";
}

function pluralMascot(count: number) {
  return `mascote${count !== 1 ? "s" : ""}`;
}

// Map de módulo para cooldown dos botões "usar em todos" — persiste entre re-renders
const _bulkPlayedAt = new Map<string, number>(); // scope → timestamp
const _bulkPettedAt = new Map<string, number>();

const PLAY_CD = 45 * 60 * 1000;
const PET_CD  = 25 * 60 * 1000;

export function BulkInteractPanel({ scope }: Props) {
  const router = useRouter();
  const [pendingPlay, startPlay] = useTransition();
  const [pendingPet, startPet] = useTransition();
  const isFavoriteTeam = scope === "FAVORITES";

  // Tick para atualizar cooldown exibido
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const playLastMs = _bulkPlayedAt.get(scope) ?? 0;
  const petLastMs  = _bulkPettedAt.get(scope) ?? 0;
  const playEndMs  = playLastMs + PLAY_CD;
  const petEndMs   = petLastMs  + PET_CD;
  const playOnCooldown = playLastMs > 0 && playEndMs > nowMs;
  const petOnCooldown  = petLastMs  > 0 && petEndMs  > nowMs;
  const playRemaining  = Math.max(0, playEndMs - nowMs);
  const petRemaining   = Math.max(0, petEndMs  - nowMs);

  const summarize = (
    actionLabel: string,
    successIds: string[],
    failCount: number,
    markFn: (id: string) => void,
    bulkMap: Map<string, number>,
  ) => {
    if (successIds.length > 0) {
      // Atualiza Maps individuais para que cada card mostre cooldown imediatamente
      successIds.forEach(id => markFn(id));
      // Atualiza cooldown do botão bulk
      bulkMap.set(scope, Date.now());
      setNowMs(Date.now());
      toast.success(`${actionLabel} aplicado em ${successIds.length} ${pluralMascot(successIds.length)}.`);
      router.refresh();
    } else {
      toast.info(`Nenhum mascote pôde receber ${actionLabel.toLowerCase()} agora.`);
    }

    if (failCount > 0) {
      toast.info(`${failCount} ${pluralMascot(failCount)} estavam em cooldown, Arena, expedição ou indisponíveis.`);
    }
  };

  const handlePlayAll = () => {
    startPlay(async () => {
      const res = await interactAllAction("PLAY", scope);
      if (res.error) { toast.error(res.error); return; }
      const ok   = res.results.filter(r => r.success).map(r => r.mascotId);
      const fail = res.results.filter(r => !r.success).length;
      summarize("Brincadeira em equipe", ok, fail, markPlayed, _bulkPlayedAt);
    });
  };

  const handlePetAll = () => {
    startPet(async () => {
      const res = await interactAllAction("PET", scope);
      if (res.error) { toast.error(res.error); return; }
      const ok   = res.results.filter(r => r.success).map(r => r.mascotId);
      const fail = res.results.filter(r => !r.success).length;
      summarize("Carinho em equipe", ok, fail, markPetted, _bulkPettedAt);
    });
  };

  return (
    <div className="rounded-2xl border border-[#FFCB05]/20 bg-slate-950/60 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Users size={15} className="text-[#FFCB05]" />
            {isFavoriteTeam ? "Cuidar da Equipe Favorita" : "Cuidar dos Mascotes"}
          </h3>
          <p className="max-w-2xl text-xs text-slate-500">
            {isFavoriteTeam
              ? "Aplica a ação em até 6 mascotes favoritos disponíveis. Cada mascote respeita o próprio cooldown, estado de Arena, repouso e expedição."
              : "Aplica a ação nos mascotes disponíveis. Cada mascote respeita cooldown, Arena, repouso e expedição."}
          </p>
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
          {isFavoriteTeam ? "Equipe Favorita" : "Todos"}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={pendingPlay || pendingPet || playOnCooldown}
          onClick={handlePlayAll}
          className="flex flex-col items-center gap-0.5 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2.5 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            {pendingPlay ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
            Brincar com a equipe
          </span>
          {playOnCooldown && (
            <span className="text-[9px] font-normal text-[#FFCB05]/60">{formatRemaining(playRemaining)}</span>
          )}
        </button>
        <button
          type="button"
          disabled={pendingPlay || pendingPet || petOnCooldown}
          onClick={handlePetAll}
          className="flex flex-col items-center gap-0.5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            {pendingPet ? <Loader2 size={14} className="animate-spin" /> : <Hand size={14} />}
            Carinho na equipe
          </span>
          {petOnCooldown && (
            <span className="text-[9px] font-normal text-rose-400/60">{formatRemaining(petRemaining)}</span>
          )}
        </button>
      </div>
    </div>
  );
}
