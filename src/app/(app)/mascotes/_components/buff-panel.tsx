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

// Emoji por tipo de buff — descrição sempre vem do ShopItem.description (banco)
const BUFF_EMOJI: Record<string, string> = {
  MASCOT_BUFF_EXP:   "⚡",
  MASCOT_BUFF_STAT:  "💊",
  MASCOT_BUFF_HAPPY: "🍯",
  MASCOT_BUFF_LUCK:  "🍀",
  MASCOT_BUFF_MOOD:  "💧",
};

interface Props {
  buffs: BuffItem[];
  mascots: MascotOption[];
}

export function BuffPanel({ buffs, mascots }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedBuff, setSelectedBuff] = useState<string>("");
  const [selectedMascot, setSelectedMascot] = useState<string>(mascots.find(m => m.isEquipped)?.id ?? "");

  if (buffs.length === 0) return null;

  const handleUse = () => {
    if (!selectedBuff || !selectedMascot) { toast.error("Selecione um item e um mascote."); return; }
    const buff = buffs.find(b => b.id === selectedBuff);
    if (!buff) return;
    if (!confirm(`Usar ${buff.name} em ${mascots.find(m => m.id === selectedMascot)?.name}?`)) return;

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
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{buff.name}</p>
                {buff.description && (
                  <p className="text-[10px] text-slate-500 line-clamp-2">{buff.description}</p>
                )}
                <p className="text-[10px] text-[#FFCB05] mt-0.5">×{buff.quantity} disponível</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Seletor de mascote + botão */}
      {selectedBuff && (
        <div className="flex flex-wrap items-center gap-3">
          <select value={selectedMascot} onChange={e => setSelectedMascot(e.target.value)}
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]">
            <option value="">Selecione o mascote</option>
            {mascots.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}{m.isEquipped ? " ★" : ""}
              </option>
            ))}
          </select>
          <button type="button" disabled={pending || !selectedMascot}
            onClick={handleUse}
            className="rounded-xl bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40">
            {pending ? "Usando…" : "Usar item ✨"}
          </button>
        </div>
      )}
    </div>
  );
}
