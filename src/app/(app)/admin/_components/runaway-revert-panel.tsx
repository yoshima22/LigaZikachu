"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { listHungerRunaways, revertHungerRunaway, revertAllHungerRunaways } from "../actions";
import { getStaticSpriteUrl, getPokemonName } from "@/lib/mascot-data";

type RunawayItem = {
  eventId: string;
  mascotId: string;
  mascotName: string;
  pokemonId: number;
  originalOwnerId: string;
  originalOwnerName: string;
  currentOwnerId: string;
  currentOwnerName: string;
  transferred: boolean;
  eventStatus: string;
  createdAt: string;
};

export function RunawayRevertPanel() {
  const [items, setItems] = useState<RunawayItem[] | null>(null);
  const [pending, start] = useTransition();
  const [since, setSince] = useState("2026-06-28");

  function load() {
    start(async () => {
      const res = await listHungerRunaways(new Date(since).toISOString());
      if (res.error) { toast.error(res.error); return; }
      setItems(res.items ?? []);
    });
  }

  function revertOne(eventId: string) {
    start(async () => {
      const res = await revertHungerRunaway(eventId);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`✅ ${res.mascotName} devolvido a ${res.ownerName}`);
      setItems(prev => prev?.filter(i => i.eventId !== eventId) ?? null);
    });
  }

  function revertAll() {
    start(async () => {
      const res = await revertAllHungerRunaways(new Date(since).toISOString());
      if (res.error) { toast.error(res.error); return; }
      toast.success(`✅ ${res.reverted} mascotes devolvidos${res.skipped ? `, ${res.skipped} com erro` : ""}`);
      setItems([]);
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-4">
      <div>
        <p className="text-xs font-bold text-amber-400">🏃 Reversão de Fugas por Fome</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Lista eventos RUNAWAY_RESCUE criados a partir da data e devolve cada mascote ao dono original.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <p className="text-[10px] text-slate-500 mb-1">Desde</p>
          <input
            type="date"
            value={since}
            onChange={e => setSince(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          />
        </div>
        <button
          onClick={load}
          disabled={pending}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
        >
          {pending ? "Carregando..." : "Listar Fugitivos"}
        </button>
        {items && items.length > 0 && (
          <button
            onClick={revertAll}
            disabled={pending}
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
          >
            {pending ? "Revertendo..." : `Reverter Todos (${items.length})`}
          </button>
        )}
      </div>

      {items !== null && (
        items.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma fuga encontrada nesse período.</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.eventId} className={`flex items-center gap-3 rounded-xl border p-3 ${item.transferred ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getStaticSpriteUrl(item.pokemonId)} alt="" className="h-10 w-10 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-200">{getPokemonName(item.pokemonId) || item.mascotName} <span className="text-slate-500 font-normal">"{item.mascotName}"</span></p>
                  <p className="text-[10px] text-slate-400">
                    Dono original: <span className="text-green-300">{item.originalOwnerName}</span>
                    {item.transferred && (
                      <> → Adotado por: <span className="text-red-300">{item.currentOwnerName}</span></>
                    )}
                    {!item.transferred && <span className="text-amber-300"> (ainda com dono original — evento pendente)</span>}
                  </p>
                  <p className="text-[9px] text-slate-500">
                    {new Date(item.createdAt).toLocaleString("pt-BR")} · evento: {item.eventStatus}
                  </p>
                </div>
                <button
                  onClick={() => revertOne(item.eventId)}
                  disabled={pending}
                  className="shrink-0 rounded-lg border border-green-500/30 bg-green-500/10 px-2 py-1 text-[10px] font-bold text-green-300 hover:bg-green-500/20 disabled:opacity-40"
                >
                  Devolver
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
