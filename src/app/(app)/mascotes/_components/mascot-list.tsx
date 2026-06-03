"use client";

import { useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getPokemonName } from "@/lib/mascot-data";
import { MascotCard } from "./mascot-card";

interface MascotData {
  id: string; pokemonId: number; nickname: string | null;
  level: number; exp: number; happiness: number; mood: string;
  personality: string; isEquipped: boolean;
  statForce: number; statAgility: number; statCharisma: number;
  statInstinct: number; statVitality: number;
  battleWins: number; battleLosses: number;
  hatchedAt: Date; lastInteractedAt: Date | null; lastFedAt: Date | null;
  expeditions: { id: string; finishAt: Date; status: string }[];
  events: { id: string; emoji: string; description: string; createdAt: Date }[];
  hasFood: boolean; hasSweet: boolean;
  otherMascots?: { id: string; name: string }[];
}

const PAGE_SIZE = 6;

const MOOD_FILTER_OPTIONS = [
  { value: "", label: "Qualquer humor" },
  { value: "HAPPY",       label: "😊 Feliz" },
  { value: "EXCITED",     label: "🤩 Animado" },
  { value: "CONFIDENT",   label: "💪 Confiante" },
  { value: "NEUTRAL",     label: "😐 Neutro" },
  { value: "TIRED",       label: "😴 Cansado" },
  { value: "HUNGRY",      label: "😋 Faminto" },
  { value: "ANGRY",       label: "😠 Bravo" },
];

export function MascotList({ mascots, isAdmin = false }: { mascots: MascotData[]; isAdmin?: boolean }) {
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [equippedOnly, setEquippedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const filtered = mascots.filter(m => {
    const displayName = (m.nickname ?? getPokemonName(m.pokemonId)).toLowerCase();
    const matchSearch = !search || displayName.includes(search.toLowerCase()) ||
      String(m.pokemonId).includes(search) ||
      getPokemonName(m.pokemonId).toLowerCase().includes(search.toLowerCase());
    const matchMood   = !moodFilter || m.mood === moodFilter;
    const matchEquip  = !equippedOnly || m.isEquipped;
    return matchSearch && matchMood && matchEquip;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nome ou #ID…"
            className="w-full rounded-xl border border-border bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
          />
        </div>
        <select value={moodFilter} onChange={e => { setMoodFilter(e.target.value); setPage(1); }}
          className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-[#FFCB05]">
          {MOOD_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" onClick={() => { setEquippedOnly(v => !v); setPage(1); }}
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${equippedOnly ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-500 hover:text-slate-300"}`}>
          ★ Só equipado
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-slate-500">
          Nenhum mascote encontrado com esses filtros.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map(m => <MascotCard key={m.id} mascot={m} isAdmin={isAdmin} />)}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30">
                <ChevronLeft size={12}/> Anterior
              </button>
              <span className="text-xs text-slate-500">{safePage} / {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-30">
                Próximo <ChevronRight size={12}/>
              </button>
            </div>
          )}

          <p className="text-center text-[10px] text-slate-600">
            {filtered.length} mascote{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
