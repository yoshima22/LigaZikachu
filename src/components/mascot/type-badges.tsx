"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Swords, ShieldAlert, Info } from "lucide-react";
import { TYPE_ADVANTAGE } from "@/lib/mascot-data";

const TYPE_COLORS: Record<string, string> = {
  normal:"bg-slate-500/25 text-slate-300 border-slate-500/30", fire:"bg-orange-500/20 text-orange-300 border-orange-500/30",
  water:"bg-blue-500/20 text-blue-300 border-blue-500/30", grass:"bg-green-500/20 text-green-300 border-green-500/30",
  electric:"bg-yellow-400/20 text-yellow-300 border-yellow-400/30", psychic:"bg-pink-500/20 text-pink-300 border-pink-500/30",
  fighting:"bg-red-600/20 text-red-300 border-red-600/30", dark:"bg-slate-700/40 text-slate-400 border-slate-600/30",
  steel:"bg-slate-400/20 text-slate-300 border-slate-400/30", dragon:"bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  fairy:"bg-pink-400/20 text-pink-200 border-pink-400/30", ghost:"bg-purple-600/20 text-purple-300 border-purple-600/30",
  poison:"bg-purple-500/20 text-purple-300 border-purple-500/30", ground:"bg-amber-600/20 text-amber-300 border-amber-600/30",
  rock:"bg-stone-500/20 text-stone-300 border-stone-500/30", flying:"bg-sky-500/20 text-sky-300 border-sky-500/30",
  bug:"bg-lime-500/20 text-lime-300 border-lime-500/30", ice:"bg-cyan-400/20 text-cyan-300 border-cyan-400/30",
};
const TYPE_LABELS: Record<string, string> = {
  normal:"Normal", fire:"Fogo", water:"Água", grass:"Grama", electric:"Elétrico",
  psychic:"Psíquico", fighting:"Lutador", dark:"Noturno", steel:"Metal",
  dragon:"Dragão", fairy:"Fada", ghost:"Fantasma", poison:"Venenoso",
  ground:"Terra", rock:"Pedra", flying:"Voador", bug:"Inseto", ice:"Gelo",
};
const fallbackChip = "bg-slate-500/20 text-slate-400 border-slate-500/20";
const label = (t: string) => TYPE_LABELS[t] ?? t;

/** Tipos contra os quais `type` é super-eficaz (bônus ofensivo no combate). */
const strongAgainst = (type: string) => TYPE_ADVANTAGE[type] ?? [];
/** Tipos que são super-eficazes contra `type` (bônus recebido = vulnerabilidade). */
const weakAgainst = (type: string) =>
  Object.entries(TYPE_ADVANTAGE).filter(([, targets]) => targets.includes(type)).map(([atk]) => atk);

function TypeChip({ type, size = "sm" }: { type: string; size?: "sm" | "md" }) {
  const cls = size === "md" ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]";
  return (
    <span className={`inline-block rounded border font-bold ${cls} ${TYPE_COLORS[type] ?? fallbackChip}`}>
      {label(type)}
    </span>
  );
}

function MatchupModal({ type, onClose }: { type: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const strong = strongAgainst(type);
  const weak = weakAgainst(type);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <span className={`rounded-lg border px-3 py-1 text-sm font-black ${TYPE_COLORS[type] ?? fallbackChip}`}>{label(type)}</span>
            <span className="text-xs font-semibold text-slate-400">forças e fraquezas</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <Swords size={14} /> Forte contra
            </div>
            {strong.length ? (
              <div className="flex flex-wrap gap-1.5">{strong.map((t) => <TypeChip key={t} type={t} size="md" />)}</div>
            ) : (
              <p className="text-[11px] text-slate-500">Não recebe bônus de ataque contra nenhum tipo.</p>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-300">
              <ShieldAlert size={14} /> Vulnerável a
            </div>
            {weak.length ? (
              <div className="flex flex-wrap gap-1.5">{weak.map((t) => <TypeChip key={t} type={t} size="md" />)}</div>
            ) : (
              <p className="text-[11px] text-slate-500">Nenhum tipo recebe bônus de ataque contra ele.</p>
            )}
          </section>

          <p className="flex items-start gap-1.5 rounded-lg border border-white/5 bg-white/5 p-2.5 text-[10px] leading-relaxed text-slate-400">
            <Info size={12} className="mt-0.5 shrink-0" />
            No combate, quem ataca com um tipo <strong className="text-slate-200">forte contra</strong> o alvo recebe bônus de dano. Escolha equipes que exploram as fraquezas do adversário.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Tags de tipo clicáveis. Ao clicar, abre uma janela com forças/fraquezas do
 * tipo (derivadas da tabela de vantagem usada pelo motor de combate).
 */
export function TypeBadges({ types, className = "", chipClassName = "" }: { types: string[]; className?: string; chipClassName?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {types.map((t) => (
        <span
          key={t}
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); setOpen(t); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(t); } }}
          title={`Ver forças e fraquezas de ${label(t)}`}
          className={`cursor-pointer select-none rounded border px-1.5 py-px text-[9px] font-bold transition hover:brightness-125 hover:ring-1 hover:ring-white/30 ${TYPE_COLORS[t] ?? fallbackChip} ${chipClassName} ${className}`}
        >
          {label(t)}
        </span>
      ))}
      {open && <MatchupModal type={open} onClose={() => setOpen(null)} />}
    </>
  );
}
