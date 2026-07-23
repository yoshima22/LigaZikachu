"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShellGame } from "./shell-game";
import { fuseMiauvadaoEggsAction } from "../actions";
import {
  getMiauvadaoFusionChances,
  MIAUVADAO_FUSION_HATCH_BONUS_CHANCES,
  MIAUVADAO_FUSION_EGG_TYPES,
  type MiauvadaoFusionEggType,
} from "@/lib/miauvadao-egg-fusion";

const LABELS: Record<string, string> = {
  BROKEN: "Quebrar os 3 ovos",
  COMMON: "Ovo Comum",
  EVENT: "Ovo de Evento",
  RARE: "Ovo Raro",
  SPECIAL: "Ovo Especial",
  LAB: "Ovo de Laboratório",
};

type Props = {
  balance: number;
  playerId: string | null;
  vaultBalance: number;
  lastWinnerMessage: string | null;
  isAdmin: boolean;
  eggCounts: Record<MiauvadaoFusionEggType, number>;
};

export function MiauvadaoGames(props: Props) {
  const [tab, setTab] = useState<"SHELL" | "FUSION">("SHELL");
  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-xl border border-[#5a4700]/70 bg-[#0e0c06] p-1.5">
        <button type="button" onClick={() => setTab("SHELL")}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${tab === "SHELL" ? "bg-[#c9a800] text-[#1a1209]" : "text-[#8b6c00]"}`}>
          🎩 Jogo dos Copos
        </button>
        <button type="button" onClick={() => setTab("FUSION")}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${tab === "FUSION" ? "bg-[#c9a800] text-[#1a1209]" : "text-[#8b6c00]"}`}>
          🥚 Fusão de Ovos
        </button>
      </div>
      {tab === "SHELL" ? (
        <ShellGame
          balance={props.balance}
          playerId={props.playerId}
          vaultBalance={props.vaultBalance}
          lastWinnerMessage={props.lastWinnerMessage}
          isAdmin={props.isAdmin}
        />
      ) : (
        <EggFusionGame playerId={props.playerId} vaultBalance={props.vaultBalance} initialCounts={props.eggCounts} />
      )}
    </div>
  );
}

function EggFusionGame({
  playerId, vaultBalance, initialCounts,
}: {
  playerId: string | null;
  vaultBalance: number;
  initialCounts: Record<MiauvadaoFusionEggType, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [counts, setCounts] = useState(initialCounts);
  const [selected, setSelected] = useState<MiauvadaoFusionEggType[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const machineOnline = vaultBalance >= 500;
  const chances = useMemo(() => getMiauvadaoFusionChances(selected), [selected]);

  const selectedCount = (type: MiauvadaoFusionEggType) => selected.filter((item) => item === type).length;
  const add = (type: MiauvadaoFusionEggType) => {
    if (selected.length >= 3 || selectedCount(type) >= counts[type]) return;
    setSelected((current) => [...current, type]);
    setResult(null);
  };
  const remove = (type: MiauvadaoFusionEggType) => {
    const index = selected.lastIndexOf(type);
    if (index < 0) return;
    setSelected((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };
  const fuse = () => {
    if (!playerId) return toast.error("Faça login para usar a máquina.");
    if (!machineOnline) return toast.error("O cofre do Miauvadão não possui os 500 ZC necessários.");
    if (selected.length !== 3) return toast.error("Selecione exatamente 3 ovos.");
    if (!confirm("Os 3 ovos serão consumidos permanentemente, mesmo se a fusão falhar. Continuar?")) return;
    startTransition(async () => {
      const response = await fuseMiauvadaoEggsAction(selected);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      setCounts((current) => {
        const next = { ...current };
        selected.forEach((type) => { next[type]--; });
        if (response.result && response.result !== "BROKEN" && response.result !== "LAB") next[response.result]++;
        return next;
      });
      const bonus = response.lootBonusPct
        ? ` com +${response.lootBonusPct} pontos percentuais de chance de mascote de alta raridade`
        : "";
      setResult(response.result === "BROKEN"
        ? "💥 Os três ovos quebraram. Nenhum ovo foi gerado."
        : `✨ Você recebeu ${LABELS[response.result ?? "COMMON"]}${bonus}.`);
      setSelected([]);
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-[#5a4700] bg-[#0e0c06] p-5 text-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-pixel text-sm text-[#FFCB05]">Máquina de Fusão de Ovos</h3>
          <p className="mt-1 max-w-2xl text-xs text-[#8b6c00]">
            Consome exatamente três ovos e 500 ZC do cofre. Ingredientes melhores aumentam bastante as chances de resultados melhores.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${machineOnline ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
          {machineOnline ? "● Máquina ligada" : "● Máquina desligada"}
        </span>
      </div>
      {!machineOnline && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          O cofre possui {vaultBalance.toLocaleString("pt-BR")} ZC. São necessários 500 ZC para alimentar a máquina.
        </p>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {MIAUVADAO_FUSION_EGG_TYPES.map((type) => (
          <div key={type} className="rounded-xl border border-[#5a4700]/60 bg-black/20 p-3">
            <p className="text-xs font-bold text-slate-100">{LABELS[type]}</p>
            <p className="text-[10px] text-slate-500">Disponíveis: {counts[type]}</p>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" onClick={() => remove(type)} disabled={selectedCount(type) === 0}
                className="h-7 w-7 rounded bg-slate-800 disabled:opacity-30">−</button>
              <strong className="text-[#FFCB05]">{selectedCount(type)}</strong>
              <button type="button" onClick={() => add(type)}
                disabled={selected.length >= 3 || selectedCount(type) >= counts[type]}
                className="h-7 w-7 rounded bg-slate-800 disabled:opacity-30">+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-950/10 p-3">
        <p className="text-xs font-bold text-purple-200">Chances desta mistura</p>
        {selected.length === 3 ? (
          <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-[11px] sm:grid-cols-3">
            {(["BROKEN", "COMMON", "EVENT", "RARE", "SPECIAL", "LAB"] as const).map((outcome) => (
              <div key={outcome} className="flex justify-between gap-2">
                <span className="text-slate-400">{LABELS[outcome]}</span>
                <strong className={outcome === "LAB" ? "text-purple-300" : outcome === "BROKEN" ? "text-red-300" : "text-slate-200"}>
                  {chances[outcome].toLocaleString("pt-BR", { minimumFractionDigits: chances[outcome] < 1 ? 2 : 1, maximumFractionDigits: 2 })}%
                </strong>
              </div>
            ))}
          </div>
        ) : <p className="mt-1 text-[11px] text-slate-500">Selecione os três ingredientes para revelar as probabilidades exatas.</p>}
        <p className="mt-2 text-[10px] text-slate-500">
          O ovo gerado também sorteia um bônus para aumentar a chance de nascer um mascote de raridade elevada.
          Esse bônus não altera os atributos do mascote.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-400">
          {MIAUVADAO_FUSION_HATCH_BONUS_CHANCES.map(({ bonusPct, chancePct }) => (
            <span key={bonusPct} className="rounded-md bg-black/25 px-2 py-1">
              +{bonusPct} ponto{bonusPct === 1 ? "" : "s"}: {chancePct}%
            </span>
          ))}
        </div>
      </div>
      {result && <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-100">{result}</p>}
      <button type="button" onClick={fuse} disabled={pending || !machineOnline || selected.length !== 3}
        className="mt-4 w-full rounded-xl bg-[#FFCB05] px-4 py-2.5 text-sm font-black text-[#1A1A2E] disabled:opacity-40">
        {pending ? "Fundindo..." : "Fundir 3 ovos · custo do cofre: 500 ZC"}
      </button>
    </div>
  );
}
