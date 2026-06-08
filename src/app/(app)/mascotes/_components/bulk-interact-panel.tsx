"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Gamepad2, Hand, Loader2 } from "lucide-react";
import { interactAllAction } from "../actions";

interface Props {
  scope: "ALL" | "FAVORITES";
}

export function BulkInteractPanel({ scope }: Props) {
  const [pendingPlay, startPlay] = useTransition();
  const [pendingPet, startPet] = useTransition();

  const handlePlayAll = () => {
    startPlay(async () => {
      const res = await interactAllAction("PLAY");
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const ok = res.results.filter((r) => r.success);
      const fail = res.results.filter((r) => !r.success);
      toast.success(`Brincou com ${ok.length} mascote${ok.length !== 1 ? "s" : ""}!`);
      if (fail.length > 0) {
        toast.info(`${fail.length} mascote${fail.length !== 1 ? "s" : ""} nao puderam brincar agora.`);
      }
    });
  };

  const handlePetAll = () => {
    startPet(async () => {
      const res = await interactAllAction("PET");
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const ok = res.results.filter((r) => r.success);
      const fail = res.results.filter((r) => !r.success);
      toast.success(`Fez carinho em ${ok.length} mascote${ok.length !== 1 ? "s" : ""}!`);
      if (fail.length > 0) {
        toast.info(`${fail.length} mascote${fail.length !== 1 ? "s" : ""} nao aceitaram carinho agora.`);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Interagir com todos</h3>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
          {scope === "FAVORITES" ? "Apenas favoritos" : "Todos os mascotes"}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={pendingPlay}
          onClick={handlePlayAll}
          className="flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2.5 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50"
        >
          {pendingPlay ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
          Brincar com todos
        </button>
        <button
          type="button"
          disabled={pendingPet}
          onClick={handlePetAll}
          className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-400/20 disabled:opacity-50"
        >
          {pendingPet ? <Loader2 size={14} className="animate-spin" /> : <Hand size={14} />}
          Carinho em todos
        </button>
      </div>
    </div>
  );
}
