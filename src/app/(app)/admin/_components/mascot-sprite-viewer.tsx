"use client";

import { useState, useTransition } from "react";
import { searchMascotSprites, type MascotSpriteHit } from "../actions";

export function MascotSpriteViewer() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<MascotSpriteHit[] | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    const q = query.trim();
    if (!q) { setHits(null); return; }
    start(async () => setHits(await searchMascotSprites(q)));
  };

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome ou ID do mascote (ex.: Pikachu, 10001, 201001)…"
          className="flex-1 rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-[#FFCB05]"
        />
        <button type="submit" disabled={pending}
          className="rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
          {pending ? "Buscando…" : "Ver sprite"}
        </button>
      </form>

      {hits && (
        hits.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Nenhum mascote encontrado.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {hits.map((h) => (
              <div key={h.id} className="flex flex-col items-center rounded-xl border border-border bg-slate-900/40 p-2 text-center">
                <img src={h.spriteUrl} alt={h.name} className="h-16 w-16 object-contain [image-rendering:pixelated]" />
                <p className="mt-1 line-clamp-1 w-full text-[11px] font-semibold text-white">{h.name}</p>
                <p className="text-[9px] text-slate-500">#{h.id}</p>
                <p className="text-[9px] text-slate-500">{h.types.join(" / ")}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
