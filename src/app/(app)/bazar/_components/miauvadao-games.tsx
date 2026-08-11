"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShellGame } from "./shell-game";
import { fuseMiauvadaoEggsAction } from "../actions";
import {
  getFusionHatchBonusRange,
  getMiauvadaoFusionChances,
  MIAUVADAO_FUSION_HATCH_BONUS_CHANCES,
  MIAUVADAO_FUSION_EGG_TYPES,
  type MiauvadaoFusionEggType,
  type MiauvadaoFusionEgg,
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
  eggs: MiauvadaoFusionEgg[];
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
        <EggFusionGame playerId={props.playerId} balance={props.balance} vaultBalance={props.vaultBalance} initialEggs={props.eggs} />
      )}
    </div>
  );
}

const RARITY_EMOJI: Record<MiauvadaoFusionEggType, string> = { COMMON: "⚪", EVENT: "🎉", RARE: "🔵", SPECIAL: "🟣" };

function shortOrigin(origin: string | null): string {
  if (!origin) return "Origem desconhecida";
  if (origin.startsWith("Miauvadão")) return "Fusão de Ovos";
  if (origin.startsWith("Expedi")) return "Expedição";
  if (origin.startsWith("Devolvido")) return "Devolvido do Bazar";
  if (origin.startsWith("Comprado")) return "Comprado no Bazar";
  if (origin === "VIP_PASS") return "Passe Apoiador";
  return origin.length > 22 ? `${origin.slice(0, 22)}…` : origin;
}

function EggFusionGame({
  playerId, balance, vaultBalance, initialEggs,
}: {
  playerId: string | null;
  balance: number;
  vaultBalance: number;
  initialEggs: MiauvadaoFusionEgg[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [eggs, setEggs] = useState(initialEggs);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<MiauvadaoFusionEggType>("COMMON");
  const [result, setResult] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(balance);
  const vaultReady = vaultBalance >= 250;
  const playerReady = currentBalance >= 250;
  const machineOnline = vaultReady && playerReady;

  const eggById = useMemo(() => new Map(eggs.map((egg) => [egg.id, egg])), [eggs]);
  const selectedEggs = selectedIds.map((id) => eggById.get(id)).filter(Boolean) as MiauvadaoFusionEgg[];
  const selectedTypes = selectedEggs.map((egg) => egg.type);
  const chances = useMemo(() => getMiauvadaoFusionChances(selectedTypes), [selectedTypes]);
  const countByType = useMemo(() => {
    const map = { COMMON: 0, EVENT: 0, RARE: 0, SPECIAL: 0 } as Record<MiauvadaoFusionEggType, number>;
    for (const egg of eggs) map[egg.type]++;
    return map;
  }, [eggs]);
  const eggsOfTab = useMemo(() => eggs.filter((egg) => egg.type === activeTab), [eggs, activeTab]);

  const toggle = (id: string) => {
    setResult(null);
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        toast.error("Você já escolheu 3 ovos. Remova um para trocar.");
        return current;
      }
      return [...current, id];
    });
  };

  const fuse = () => {
    if (!playerId) return toast.error("Faça login para usar a máquina.");
    if (!vaultReady) return toast.error("A máquina está desligada: o cofre do Miauvadão precisa de 250 ZC.");
    if (!playerReady) return toast.error("Saldo insuficiente: você precisa de 250 ZC para usar a máquina.");
    if (selectedIds.length !== 3) return toast.error("Selecione exatamente 3 ovos.");
    const hasBonus = selectedEggs.some((egg) => egg.hatchRarityBonusPct > 0);
    const confirmMsg = hasBonus
      ? "Atenção: um ou mais ovos selecionados têm bônus de raridade aumentado. Eles serão consumidos permanentemente, mesmo se a fusão falhar. Continuar?"
      : "Os 3 ovos serão consumidos permanentemente, mesmo se a fusão falhar. Continuar?";
    if (!confirm(confirmMsg)) return;
    startTransition(async () => {
      const response = await fuseMiauvadaoEggsAction(selectedIds);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      const consumed = new Set(selectedIds);
      setEggs((current) => {
        const remaining = current.filter((egg) => !consumed.has(egg.id));
        if (response.newEgg) {
          remaining.push({ ...response.newEgg, obtainedAt: new Date().toISOString(), origin: "Miauvadão: Fusão de Ovos" });
        }
        return remaining;
      });
      const bonus = response.lootBonusPct
        ? ` com +${response.lootBonusPct} pontos percentuais de chance de mascote de alta raridade`
        : "";
      setResult(response.result === "BROKEN"
        ? "💥 Os três ovos quebraram. Nenhum ovo foi gerado."
        : `✨ Você recebeu ${LABELS[response.result ?? "COMMON"]}${bonus}.`);
      setSelectedIds([]);
      if (typeof response.newPlayerBalance === "number") setCurrentBalance(response.newPlayerBalance);
      router.refresh();
    });
  };

  return (
    <div className="rounded-2xl border border-[#5a4700] bg-[#0e0c06] p-5 text-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-pixel text-sm text-[#FFCB05]">Máquina de Fusão de Ovos</h3>
          <p className="mt-1 max-w-2xl text-xs text-[#8b6c00]">
            Escolha exatamente três ovos específicos (250 ZC seus + 250 ZC do cofre). Ingredientes melhores aumentam bastante as chances de resultados melhores.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${machineOnline ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
          {machineOnline ? "● Máquina ligada" : "● Máquina desligada"}
        </span>
      </div>
      {!vaultReady && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          O cofre possui {vaultBalance.toLocaleString("pt-BR")} ZC. São necessários 250 ZC do cofre para alimentar a máquina.
        </p>
      )}
      {!playerReady && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Seu saldo é de {currentBalance.toLocaleString("pt-BR")} ZC. Você precisa de 250 ZC para realizar a fusão.
        </p>
      )}

      {/* Abas por raridade */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {MIAUVADAO_FUSION_EGG_TYPES.map((type) => {
          const selectedInType = selectedEggs.filter((egg) => egg.type === type).length;
          return (
            <button key={type} type="button" onClick={() => setActiveTab(type)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${activeTab === type ? "bg-[#c9a800] text-[#1a1209]" : "bg-black/25 text-[#8b6c00]"}`}>
              <span>{RARITY_EMOJI[type]}</span>
              <span>{LABELS[type]}</span>
              <span className={`rounded-full px-1.5 text-[10px] ${activeTab === type ? "bg-[#1a1209]/20" : "bg-black/40"}`}>{countByType[type]}</span>
              {selectedInType > 0 && <span className="rounded-full bg-[#FFCB05] px-1.5 text-[10px] font-black text-[#1a1209]">{selectedInType}★</span>}
            </button>
          );
        })}
      </div>

      {/* Ovos individuais da raridade ativa */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {eggsOfTab.length === 0 && (
          <p className="col-span-full rounded-xl border border-[#5a4700]/40 bg-black/20 px-3 py-4 text-center text-xs text-slate-500">
            Você não tem {LABELS[activeTab]} disponível para fusão.
          </p>
        )}
        {eggsOfTab.map((egg) => {
          const isSelected = selectedIds.includes(egg.id);
          const augmented = egg.hatchRarityBonusPct > 0;
          const blocked = !isSelected && selectedIds.length >= 3;
          return (
            <button key={egg.id} type="button" onClick={() => toggle(egg.id)} disabled={blocked}
              className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                isSelected ? "border-[#FFCB05] bg-[#FFCB05]/10"
                : augmented ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-400/60"
                : "border-[#5a4700]/50 bg-black/20 hover:border-[#5a4700]"
              } ${blocked ? "cursor-not-allowed opacity-40" : ""}`}>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span>{RARITY_EMOJI[egg.type]}</span>
                  <span className="text-xs font-bold text-slate-100">{LABELS[egg.type]}</span>
                  {augmented && (
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300">★ +{egg.hatchRarityBonusPct}% raridade</span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500">{shortOrigin(egg.origin)}</span>
              </span>
              <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold ${isSelected ? "border-[#FFCB05] text-[#FFCB05]" : "border-slate-600 text-slate-500"}`}>
                {isSelected ? "✓ Escolhido" : "Escolher"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Resumo dos 3 escolhidos (entre raridades) */}
      <div className="mt-3 rounded-xl border border-[#5a4700]/50 bg-black/20 p-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Ovos escolhidos ({selectedIds.length}/3)</p>
        {selectedEggs.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-500">Toque nos ovos acima para escolher exatamente 3 (podem ser de raridades diferentes).</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedEggs.map((egg) => (
              <button key={egg.id} type="button" onClick={() => toggle(egg.id)}
                className="flex items-center gap-1.5 rounded-lg border border-[#FFCB05]/50 bg-[#FFCB05]/10 px-2 py-1 text-[11px] text-slate-100 hover:bg-[#FFCB05]/20">
                <span>{RARITY_EMOJI[egg.type]}</span>
                <span className="font-semibold">{LABELS[egg.type]}</span>
                {egg.hatchRarityBonusPct > 0 && <span className="text-[9px] font-black text-amber-300">★+{egg.hatchRarityBonusPct}%</span>}
                <span className="text-slate-400">✕</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-950/10 p-3">
        <p className="text-xs font-bold text-purple-200">Chances desta mistura</p>
        {selectedTypes.length === 3 ? (
          <div className="mt-2 grid grid-cols-1 gap-x-5 gap-y-1 text-[11px] sm:grid-cols-2">
            {(["BROKEN", "COMMON", "EVENT", "RARE", "SPECIAL", "LAB"] as const).map((outcome) => (
              <div key={outcome} className="flex justify-between gap-2">
                <span className="text-slate-400">{LABELS[outcome]}</span>
                <span className="text-right">
                  <strong className={outcome === "LAB" ? "text-purple-300" : outcome === "BROKEN" ? "text-red-300" : "text-slate-200"}>
                    {chances[outcome].toLocaleString("pt-BR", { minimumFractionDigits: chances[outcome] < 1 ? 2 : 1, maximumFractionDigits: 2 })}%
                  </strong>
                  {outcome !== "BROKEN" && (() => {
                    const [minimum, maximum] = getFusionHatchBonusRange(selectedTypes, outcome);
                    return (
                      <small className="ml-1.5 text-[9px] text-purple-300">
                        bônus +{minimum}–{maximum}
                      </small>
                    );
                  })()}
                </span>
              </div>
            ))}
          </div>
        ) : <p className="mt-1 text-[11px] text-slate-500">Selecione os três ingredientes para revelar as probabilidades exatas.</p>}
        <p className="mt-2 text-[10px] text-slate-500">
          O ovo gerado sorteia um bônus para aumentar a chance de nascer um mascote de raridade elevada.
          Ao fundir três ovos do mesmo nível e receber outro desse mesmo nível, o ovo volta aperfeiçoado com bônus garantido de +5 a +10 pontos percentuais.
          Se o resultado for inferior à qualidade média dos ingredientes, a compensação sobe para até +20 pontos percentuais.
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
      <button type="button" onClick={fuse} disabled={pending || !machineOnline || selectedIds.length !== 3}
        className="mt-4 w-full rounded-xl bg-[#FFCB05] px-4 py-2.5 text-sm font-black text-[#1A1A2E] disabled:opacity-40">
        {pending ? "Fundindo..." : "Fundir 3 ovos · 250 ZC seus + 250 ZC do cofre"}
      </button>
    </div>
  );
}
