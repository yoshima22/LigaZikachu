"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Gamepad2, Hand, Loader2, Users } from "lucide-react";
import { interactAllAction } from "../actions";

interface Props {
  scope: "ALL" | "FAVORITES";
}

function pluralMascot(count: number) {
  return `mascote${count !== 1 ? "s" : ""}`;
}

export function BulkInteractPanel({ scope }: Props) {
  const router = useRouter();
  const [pendingPlay, startPlay] = useTransition();
  const [pendingPet, startPet] = useTransition();
  const isFavoriteTeam = scope === "FAVORITES";

  const summarize = (actionLabel: string, okCount: number, failCount: number) => {
    if (okCount > 0) {
      toast.success(`${actionLabel} aplicado em ${okCount} ${pluralMascot(okCount)}.`);
      router.refresh();
    } else {
      toast.info(`Nenhum mascote da equipe pôde receber ${actionLabel.toLowerCase()} agora.`);
    }

    if (failCount > 0) {
      toast.info(`${failCount} ${pluralMascot(failCount)} estavam em cooldown, Arena, expedição ou indisponíveis.`);
    }
  };

  const handlePlayAll = () => {
    startPlay(async () => {
      const res = await interactAllAction("PLAY", scope);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const ok = res.results.filter((r) => r.success);
      const fail = res.results.filter((r) => !r.success);
      summarize("Brincadeira em equipe", ok.length, fail.length);
    });
  };

  const handlePetAll = () => {
    startPet(async () => {
      const res = await interactAllAction("PET", scope);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const ok = res.results.filter((r) => r.success);
      const fail = res.results.filter((r) => !r.success);
      summarize("Carinho em equipe", ok.length, fail.length);
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
          disabled={pendingPlay || pendingPet}
          onClick={handlePlayAll}
          className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2.5 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50"
        >
          {pendingPlay ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
          Brincar com a equipe
        </button>
        <button
          type="button"
          disabled={pendingPlay || pendingPet}
          onClick={handlePetAll}
          className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-400/20 disabled:opacity-50"
        >
          {pendingPet ? <Loader2 size={14} className="animate-spin" /> : <Hand size={14} />}
          Carinho na equipe
        </button>
      </div>
    </div>
  );
}
