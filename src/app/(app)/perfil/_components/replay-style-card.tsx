"use client";

import { useState, useEffect, useTransition } from "react";
import { Film, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { setReplayStyleAction } from "../actions";

const saveLocal = (v: string) => { try { localStorage.setItem("zc:replayStyle", v); } catch { /* ignore */ } };

export function ReplayStyleCard({ initial }: { initial: string }) {
  const [style, setStyle] = useState<"classic" | "modern">(initial === "modern" ? "modern" : "classic");
  const [pending, startTransition] = useTransition();

  // Propaga a preferência (fonte: servidor) para o cache local que os modais de
  // replay de todos os modos leem como padrão.
  useEffect(() => { saveLocal(initial === "modern" ? "modern" : "classic"); }, [initial]);

  function choose(next: "classic" | "modern") {
    if (next === style) return;
    setStyle(next); saveLocal(next);
    startTransition(async () => {
      const res = await setReplayStyleAction(next);
      if (res?.error) { toast.error(res.error); setStyle(style); saveLocal(style); }
      else toast.success("Preferência de replay salva.");
    });
  }

  const Option = ({ value, icon, title, desc }: { value: "classic" | "modern"; icon: React.ReactNode; title: string; desc: string }) => (
    <button
      type="button"
      onClick={() => choose(value)}
      disabled={pending}
      className={`flex-1 rounded-xl border p-3 text-left transition disabled:opacity-60 ${style === value ? "border-[#FFCB05] bg-[#FFCB05]/10" : "border-slate-700 bg-slate-900 hover:border-slate-500"}`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-white">{icon} {title}{style === value && <span className="ml-auto text-[10px] font-bold text-[#FFCB05]">ATUAL</span>}</p>
      <p className="mt-1 text-xs text-slate-400">{desc}</p>
    </button>
  );

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
      <p className="flex items-center gap-2 font-semibold text-white"><Film size={16} className="text-[#FFCB05]" /> Estilo de replay</p>
      <p className="mt-1 text-xs text-slate-400">Como você prefere assistir aos replays de combate. Dá pra trocar na hora de assistir também.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Option value="classic" icon={<Clapperboard size={15} className="text-slate-300" />} title="Clássico" desc="Replay turno a turno com cartões e barras — rápido e direto." />
        <Option value="modern" icon={<Film size={15} className="text-cyan-300" />} title="Moderno (animado)" desc="Sprites 2D se movendo pela arena, efeitos por tipo e nocautes." />
      </div>
    </div>
  );
}
