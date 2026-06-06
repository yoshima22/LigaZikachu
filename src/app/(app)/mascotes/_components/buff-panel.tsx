"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { useMascotBuffAction } from "../actions";

interface BuffItem {
  id: string; name: string; type: string; quantity: number;
  description?: string; imageUrl?: string;
}
interface MascotOption { id: string; name: string; isEquipped: boolean }

const BUFF_EMOJI: Record<string, string> = {
  MASCOT_BUFF_EXP:   "⚡",
  MASCOT_BUFF_STAT:  "💊",
  MASCOT_BUFF_HAPPY: "🍯",
  MASCOT_BUFF_LUCK:  "🍀",
  MASCOT_BUFF_MOOD:  "💧",
};

const PROTEIN_LIMIT = 3;

interface Props {
  buffs: BuffItem[];
  mascots: MascotOption[];
  proteinBoostedMascotIds?: string[];
}

export function BuffPanel({ buffs, mascots, proteinBoostedMascotIds = [] }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedBuff, setSelectedBuff] = useState<string>("");
  const [selectedMascot, setSelectedMascot] = useState<string>(mascots.find(m => m.isEquipped)?.id ?? "");

  if (buffs.length === 0) return null;

  const boostedSet = new Set(proteinBoostedMascotIds);
  const selectedBuffItem = buffs.find(b => b.id === selectedBuff);
  const isProtein = selectedBuffItem?.type === "MASCOT_BUFF_STAT";
  const proteinUsed = boostedSet.size;
  const proteinFull = proteinUsed >= PROTEIN_LIMIT;

  const handleUse = () => {
    if (!selectedBuff || !selectedMascot) { toast.error("Selecione um item e um mascote."); return; }
    if (!selectedBuffItem) return;
    const mascotName = mascots.find(m => m.id === selectedMascot)?.name ?? "mascote";

    if (isProtein && boostedSet.has(selectedMascot)) {
      toast.error("Este mascote já recebeu Proteína Zika.");
      return;
    }
    if (isProtein && proteinFull) {
      toast.error(`Limite atingido: Proteína Zika já foi usada em ${PROTEIN_LIMIT} mascotes.`);
      return;
    }

    if (!confirm(`Usar ${selectedBuffItem.name} em ${mascotName}?`)) return;

    startTransition(async () => {
      const r = await useMascotBuffAction(selectedMascot, selectedBuff);
      if (r.error) toast.error(r.error);
      else toast.success("Item usado com sucesso! ✨");
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-[#FFCB05]" />
        <h2 className="font-semibold text-slate-200">Itens Especiais</h2>
        <span className="text-xs text-slate-500">— use em seus mascotes</span>
      </div>

      {/* Lista de buffs disponíveis */}
      <div className="grid gap-2 sm:grid-cols-2">
        {buffs.map(buff => {
          const emoji = BUFF_EMOJI[buff.type] ?? "✨";
          const isThisProtein = buff.type === "MASCOT_BUFF_STAT";
          return (
            <button key={buff.id} type="button"
              onClick={() => setSelectedBuff(buff.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                selectedBuff === buff.id
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/10"
                  : "border-border bg-slate-900/40 hover:border-slate-600"
              }`}>
              {buff.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={buff.imageUrl} alt="" className="h-8 w-8 object-contain shrink-0" />
              ) : (
                <span className="text-2xl shrink-0">{emoji}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{buff.name}</p>
                {buff.description && (
                  <p className="text-[10px] text-slate-500 line-clamp-2">{buff.description}</p>
                )}
                <p className="text-[10px] text-[#FFCB05] mt-0.5">×{buff.quantity} disponível</p>

                {/* Indicador de limite da Proteína Zika */}
                {isThisProtein && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="flex gap-1">
                      {Array.from({ length: PROTEIN_LIMIT }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 w-4 rounded-full ${
                            i < proteinUsed ? "bg-green-400" : "bg-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`text-[9px] font-semibold ${proteinFull ? "text-red-400" : "text-slate-400"}`}>
                      {proteinUsed}/{PROTEIN_LIMIT} mascotes
                    </span>
                    {proteinFull && <span className="text-[9px] text-red-400 font-bold">ESGOTADO</span>}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Alerta quando proteína selecionada e limite chegou */}
      {isProtein && proteinFull && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Você já usou Proteína Zika em {PROTEIN_LIMIT} mascotes. Não é possível usar mais.
        </div>
      )}

      {/* Seletor de mascote + botão */}
      {selectedBuff && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedMascot}
            onChange={e => setSelectedMascot(e.target.value)}
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]"
          >
            <option value="">Selecione o mascote</option>
            {mascots.map(m => {
              const alreadyBoosted = isProtein && boostedSet.has(m.id);
              return (
                <option key={m.id} value={m.id} disabled={alreadyBoosted}>
                  {m.name}{m.isEquipped ? " ★" : ""}{alreadyBoosted ? " ✅ (já recebeu)" : ""}
                </option>
              );
            })}
          </select>

          {/* Aviso por mascote já boosted */}
          {isProtein && selectedMascot && boostedSet.has(selectedMascot) && (
            <span className="text-[10px] text-amber-400 font-semibold">
              ✅ Este mascote já recebeu Proteína Zika
            </span>
          )}

          <button
            type="button"
            disabled={
              pending ||
              !selectedMascot ||
              (isProtein && (proteinFull || boostedSet.has(selectedMascot)))
            }
            onClick={handleUse}
            className="rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Usando…" : "Usar item ✨"}
          </button>
        </div>
      )}
    </div>
  );
}
