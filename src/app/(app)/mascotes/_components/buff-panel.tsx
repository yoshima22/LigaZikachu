"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { useMascotBuffAction } from "../actions";

interface BuffItem { id: string; name: string; type: string; quantity: number }
interface MascotOption { id: string; name: string; isEquipped: boolean }

const BUFF_INFO: Record<string, { emoji: string; desc: string }> = {
  MASCOT_BUFF_EXP:   { emoji: "⚡", desc: "EXP dobrado por 2h" },
  MASCOT_BUFF_STAT:  { emoji: "💊", desc: "+3 em todos stats por 4h" },
  MASCOT_BUFF_HAPPY: { emoji: "🍯", desc: "Felicidade → 100 por 3h" },
  MASCOT_BUFF_LUCK:  { emoji: "🍀", desc: "Expedições com mais recompensas por 6h" },
  MASCOT_BUFF_MOOD:  { emoji: "💧", desc: "Remove humor negativo imediatamente" },
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
          const info = BUFF_INFO[buff.type];
          return (
            <button key={buff.id} type="button"
              onClick={() => setSelectedBuff(buff.id)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                selectedBuff === buff.id
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/10"
                  : "border-border bg-slate-900/40 hover:border-slate-600"
              }`}>
              <span className="text-2xl shrink-0">{info?.emoji ?? "✨"}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{buff.name}</p>
                <p className="text-[10px] text-slate-500">{info?.desc}</p>
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
