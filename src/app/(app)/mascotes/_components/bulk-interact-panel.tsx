"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { Gamepad2, Hand, Loader2, Users } from "lucide-react";
import { interactAllAction } from "../actions";
import { markPlayed, markPetted, isPlayOnCooldown, isPetOnCooldown } from "./mascot-card";
import { formatRemaining } from "@/hooks/use-timer-expiry";

interface Props {
  scope: "ALL" | "FAVORITES";
  /** IDs dos mascotes do escopo — usados para verificar cooldowns individuais */
  mascotIds: string[];
}

function pluralMascot(count: number) {
  return `mascote${count !== 1 ? "s" : ""}`;
}

export function BulkInteractPanel({ scope, mascotIds }: Props) {
  const router = useRouter();
  const [pendingPlay, startPlay] = useTransition();
  const [pendingPet, startPet] = useTransition();
  const isFavoriteTeam = scope === "FAVORITES";

  // Tick de 1s — atualiza cooldowns em tempo real
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Contagem de mascotes que PODEM brincar/receber carinho agora
  const availableForPlay = mascotIds.filter(id => !isPlayOnCooldown(id, nowMs)).length;
  const availableForPet  = mascotIds.filter(id => !isPetOnCooldown(id, nowMs)).length;

  // Botão desabilitado só quando NENHUM mascote está disponível
  const playDisabled = pendingPlay || pendingPet || availableForPlay === 0;
  const petDisabled  = pendingPlay || pendingPet || availableForPet  === 0;

  const handlePlayAll = () => {
    startPlay(async () => {
      const res = await interactAllAction("PLAY", scope);
      if (res.error) { toast.error(res.error); return; }

      const ok   = res.results.filter(r => r.success).map(r => r.mascotId);
      const fail = res.results.filter(r => !r.success).length;

      if (ok.length > 0) {
        // Registra cooldown nos Maps individuais de cada mascote que teve sucesso
        const now = Date.now();
        ok.forEach(id => { markPlayed(id); });
        setNowMs(now); // força re-render imediato com novos cooldowns
        toast.success(`Brincadeira aplicada em ${ok.length} ${pluralMascot(ok.length)}.`);
        router.refresh();
      } else {
        toast.info("Nenhum mascote da equipe pôde brincar agora.");
      }

      if (fail > 0) {
        toast.info(`${fail} ${pluralMascot(fail)} estavam em cooldown, Arena, expedição ou indisponíveis.`);
      }
    });
  };

  const handlePetAll = () => {
    startPet(async () => {
      const res = await interactAllAction("PET", scope);
      if (res.error) { toast.error(res.error); return; }

      const ok   = res.results.filter(r => r.success).map(r => r.mascotId);
      const fail = res.results.filter(r => !r.success).length;

      if (ok.length > 0) {
        const now = Date.now();
        ok.forEach(id => { markPetted(id); });
        setNowMs(now);
        toast.success(`Carinho aplicado em ${ok.length} ${pluralMascot(ok.length)}.`);
        router.refresh();
      } else {
        toast.info("Nenhum mascote da equipe pôde receber carinho agora.");
      }

      if (fail > 0) {
        toast.info(`${fail} ${pluralMascot(fail)} estavam em cooldown, Arena, expedição ou indisponíveis.`);
      }
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
              ? "Aplica em cada mascote favorito que estiver disponível. Cada um respeita seu próprio cooldown."
              : "Aplica nos mascotes disponíveis. Cada mascote respeita seu próprio cooldown."}
          </p>
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
          {isFavoriteTeam ? "Equipe Favorita" : "Todos"}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {/* Brincar com todos */}
        <button
          type="button"
          disabled={playDisabled}
          onClick={handlePlayAll}
          className="flex flex-col items-center gap-0.5 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2.5 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            {pendingPlay ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
            Brincar com a equipe
          </span>
          <span className="text-[9px] font-normal text-[#FFCB05]/60">
            {availableForPlay === 0
              ? "Todos em cooldown"
              : `${availableForPlay} disponível${availableForPlay !== 1 ? "is" : ""}`}
          </span>
        </button>

        {/* Carinho na equipe */}
        <button
          type="button"
          disabled={petDisabled}
          onClick={handlePetAll}
          className="flex flex-col items-center gap-0.5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            {pendingPet ? <Loader2 size={14} className="animate-spin" /> : <Hand size={14} />}
            Carinho na equipe
          </span>
          <span className="text-[9px] font-normal text-rose-400/60">
            {availableForPet === 0
              ? "Todos em cooldown"
              : `${availableForPet} disponível${availableForPet !== 1 ? "is" : ""}`}
          </span>
        </button>
      </div>
    </div>
  );
}
