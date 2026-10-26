"use client";

import { useState, useTransition } from "react";
import { searchMascotSprites, type MascotSpriteHit } from "../actions";
import { EVOLUTION_MAP } from "@/lib/mascot-data";
import { MEGA_STONES } from "@/lib/mega-evolution";
import { EvolutionAnimation } from "@/components/mascot/evolution-animation";

export function EvolutionDebug() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MascotSpriteHit[] | null>(null);
  const [anim, setAnim] = useState<{ from: number; to: number; mega?: boolean; stoneName?: string } | null>(null);
  const [stoneType, setStoneType] = useState<string>(MEGA_STONES[0]?.type ?? "");
  const stone = MEGA_STONES.find((s) => s.type === stoneType);
  const [pending, start] = useTransition();

  const run = () => {
    const q = query.trim();
    if (!q) { setHits(null); return; }
    start(async () => setHits((await searchMascotSprites(q)).filter((h) => EVOLUTION_MAP.has(h.id))));
  };

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pokémon que evolui (ex.: Charmander, Eevee…)"
          className="flex-1 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#FFCB05]" />
        <button type="submit" disabled={pending}
          className="rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
          {pending ? "Buscando…" : "Buscar"}
        </button>
      </form>
      {hits && (hits.length === 0
        ? <p className="py-3 text-center text-sm text-slate-500">Nenhum Pokémon evolutivo encontrado.</p>
        : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {hits.map((h) => {
              const evo = EVOLUTION_MAP.get(h.id)!;
              const targets = evo.toOptions?.length ? evo.toOptions : [evo.to];
              return (
                <div key={h.id} className="flex flex-col items-center gap-1 rounded-xl border border-border bg-slate-900/40 p-2 text-center">
                  <img src={h.spriteUrl} alt={h.name} className="h-16 w-16 object-contain [image-rendering:pixelated]" />
                  <p className="line-clamp-1 w-full text-[11px] font-semibold text-white">{h.name}</p>
                  {targets.map((to) => (
                    <button key={to} type="button" onClick={() => setAnim({ from: h.id, to })}
                      className="w-full rounded-md border border-cyan-400/30 px-1 py-1 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-500/10">
                      ✨ Evoluir{targets.length > 1 ? ` → #${to}` : ""}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>)}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        <select value={stoneType} onChange={(e) => setStoneType(e.target.value)}
          className="min-w-56 rounded-lg border border-fuchsia-500/25 bg-slate-950 px-3 py-2 text-sm text-slate-200">
          {MEGA_STONES.map((s) => <option key={s.type} value={s.type}>{s.stoneName} — {s.compatiblePokemonName}</option>)}
        </select>
        <button type="button" disabled={!stone} onClick={() => stone && setAnim({ from: stone.compatiblePokemonId, to: stone.megaPokemonId, mega: true, stoneName: stone.stoneName })}
          className="rounded-lg border border-fuchsia-400/40 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-500/10">
          💎 Mega Evoluir
        </button>
      </div>
      <p className="text-xs text-slate-500">Simulação visual: não altera nenhum mascote.</p>
      {anim && <EvolutionAnimation fromId={anim.from} toId={anim.to} mega={anim.mega} stoneName={anim.stoneName} onClose={() => setAnim(null)} />}
    </div>
  );
}
