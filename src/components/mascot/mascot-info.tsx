"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Swords, ShieldAlert } from "lucide-react";
import { getPokemonName, getPokemonTypes, getStaticSpriteUrl } from "@/lib/mascot-data";
import { TypeChip, strongAgainst, weakAgainst } from "@/components/mascot/type-badges";

const uniq = (list: string[]) => [...new Set(list)];

function MascotInfoModal({ pokemonId, displayName, level, types, onClose }: {
  pokemonId: number; displayName?: string; level?: number; types?: string[]; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const original = getPokemonName(pokemonId);
  const mascotTypes = types?.length ? types : getPokemonTypes(pokemonId);
  // O motor dá bônus quando QUALQUER tipo do atacante é forte contra QUALQUER tipo do alvo.
  const strong = uniq(mascotTypes.flatMap(strongAgainst));
  const weak = uniq(mascotTypes.flatMap(weakAgainst));
  const showNickname = displayName && displayName.trim().toLowerCase() !== original.toLowerCase();

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getStaticSpriteUrl(pokemonId)} alt="" className="h-14 w-14 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-white">{original}{level ? ` · Nv.${level}` : ""}</p>
            {showNickname && <p className="truncate text-[11px] text-slate-400">Apelido: “{displayName}”</p>}
            <div className="mt-1 flex flex-wrap gap-1">{mascotTypes.map((t) => <TypeChip key={t} type={t} />)}</div>
          </div>
          <button onClick={onClose} className="self-start rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-4">
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-300"><Swords size={14} /> Forte contra</div>
            {strong.length ? <div className="flex flex-wrap gap-1.5">{strong.map((t) => <TypeChip key={t} type={t} size="md" />)}</div>
              : <p className="text-[11px] text-slate-500">Não recebe bônus de ataque contra nenhum tipo.</p>}
          </section>
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-300"><ShieldAlert size={14} /> Vulnerável a</div>
            {weak.length ? <div className="flex flex-wrap gap-1.5">{weak.map((t) => <TypeChip key={t} type={t} size="md" />)}</div>
              : <p className="text-[11px] text-slate-500">Nenhum tipo recebe bônus de ataque contra ele.</p>}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Envolve qualquer trecho de replay: ao clicar abre nome original + vantagens/fraquezas de tipo. */
export function MascotInfoTrigger({ pokemonId, displayName, level, types, className = "", children }: {
  pokemonId?: number | null; displayName?: string; level?: number; types?: string[]; className?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!pokemonId) return <div className={className}>{children}</div>;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        title="Ver mascote, vantagens e fraquezas"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}
        className={`cursor-pointer ${className}`}
      >
        {children}
      </div>
      {open && <MascotInfoModal pokemonId={pokemonId} displayName={displayName} level={level} types={types} onClose={() => setOpen(false)} />}
    </>
  );
}
