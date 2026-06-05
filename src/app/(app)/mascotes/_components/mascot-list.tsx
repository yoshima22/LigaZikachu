"use client";

import { useState } from "react";
import { Search, Star } from "lucide-react";
import { getPokemonName, getSpriteUrl } from "@/lib/mascot-data";
import { MascotCard } from "./mascot-card";

interface MascotData {
  id: string; pokemonId: number; nickname: string | null;
  level: number; exp: number; happiness: number; mood: string;
  personality: string; isEquipped: boolean; isFavorite: boolean;
  statForce: number; statAgility: number; statCharisma: number;
  statInstinct: number; statVitality: number;
  battleWins: number; battleLosses: number;
  bazarListed: boolean;
  socialCooldownUntil: Date | null;
  evolutionLocked: boolean;
  arenaState: string; injuredAt: Date | null; restingUntil: Date | null;
  relations?: Array<{ type: string; interactionCount: number; mascotB: { id: string; pokemonId: number; nickname: string | null; ownerName: string; ownerId: string } }>;
  hatchedAt: Date; lastInteractedAt: Date | null; lastFedAt: Date | null;
  expeditions: { id: string; finishAt: Date; status: string }[];
  events: { id: string; emoji: string; description: string; createdAt: Date }[];
  hasFood: boolean; hasSweet: boolean;
  otherMascots?: { id: string; name: string }[];
}

const MOOD_FILTER_OPTIONS = [
  { value: "", label: "Qualquer humor" },
  { value: "HAPPY", label: "Feliz" },
  { value: "EXCITED", label: "Animado" },
  { value: "CONFIDENT", label: "Confiante" },
  { value: "NEUTRAL", label: "Neutro" },
  { value: "TIRED", label: "Cansado" },
  { value: "HUNGRY", label: "Faminto" },
  { value: "ANGRY", label: "Bravo" },
];

function MiniMascot({ mascot }: { mascot: MascotData }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-slate-950/50 p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={getSpriteUrl(mascot.pokemonId, true)} alt="" className="h-10 w-10 object-contain" style={{ imageRendering: "pixelated" }} />
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-slate-200">{mascot.nickname ?? getPokemonName(mascot.pokemonId)}</span>
        <span className="text-[10px] text-slate-500">Nv.{mascot.level} | {mascot.isEquipped ? "Equipado" : mascot.mood}</span>
      </span>
    </div>
  );
}

export function MascotList({ mascots, isAdmin = false }: { mascots: MascotData[]; isAdmin?: boolean }) {
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [equippedOnly, setEquippedOnly] = useState(false);
  const [expandedOthers, setExpandedOthers] = useState(false);

  const filtered = mascots.filter(m => {
    const displayName = (m.nickname ?? getPokemonName(m.pokemonId)).toLowerCase();
    const query = search.toLowerCase();
    const matchSearch = !query || displayName.includes(query) || String(m.pokemonId).includes(query) || getPokemonName(m.pokemonId).toLowerCase().includes(query);
    const matchMood = !moodFilter || m.mood === moodFilter;
    const matchEquip = !equippedOnly || m.isEquipped;
    return matchSearch && matchMood && matchEquip;
  });

  const favorites = filtered.filter(m => m.isFavorite).slice(0, 6);
  const highlighted = favorites.length > 0 ? favorites : filtered.slice(0, 6);
  const highlightedIds = new Set(highlighted.map(m => m.id));
  const others = filtered.filter(m => !highlightedIds.has(m.id));
  const compactOthers = expandedOthers ? others : others.slice(0, 12);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou #ID..."
            className="w-full rounded-xl border border-border bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
          />
        </div>
        <select value={moodFilter} onChange={e => setMoodFilter(e.target.value)}
          className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-[#FFCB05]">
          {MOOD_FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" onClick={() => setEquippedOnly(v => !v)}
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${equippedOnly ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]" : "border-border text-slate-500 hover:text-slate-300"}`}>
          So equipado
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-slate-500">
          Nenhum mascote encontrado com esses filtros.
        </p>
      ) : (
        <>
          {highlighted.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold text-[#FFCB05]"><Star size={14} fill="currentColor" /> {favorites.length > 0 ? "Favoritos" : "Destaques"}</h2>
                <span className="text-[10px] text-slate-500">{favorites.length}/6</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {highlighted.map(m => <MascotCard key={m.id} mascot={m} isAdmin={isAdmin} />)}
              </div>
            </section>
          ) : null}

          {others.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-300">Banco de mascotes</h2>
                <button type="button" onClick={() => setExpandedOthers(v => !v)}
                  className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-200">
                  {expandedOthers ? "Recolher" : `Expandir (${others.length})`}
                </button>
              </div>
              {expandedOthers ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {others.map(m => <MascotCard key={m.id} mascot={m} isAdmin={isAdmin} />)}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {compactOthers.map(m => <MiniMascot key={m.id} mascot={m} />)}
                </div>
              )}
            </section>
          )}

          <p className="text-center text-[10px] text-slate-600">
            {filtered.length} mascote{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
