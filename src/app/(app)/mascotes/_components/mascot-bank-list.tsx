"use client";

import { useState, useTransition, useCallback } from "react";
import { ChevronDown, ChevronUp, Loader2, Search } from "lucide-react";
import { getPokemonElement, getPokemonName, getStaticSpriteUrl, MOOD_EMOJI } from "@/lib/mascot-data";
import { getMascotDetailAction } from "../actions";
import { MascotCard } from "./mascot-card";

type BankMascot = {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  mood: string;
  isShiny: boolean;
  arenaState: string;
  bazarListed: boolean;
  injuredAt: Date | null;
  restingUntil: Date | null;
  expeditions: { id: string; finishAt: Date; status: string }[];
};

type FullMascotData = NonNullable<Awaited<ReturnType<typeof getMascotDetailAction>>["data"]>;

const TYPE_LABELS: Record<string, string> = {
  normal:"Normal", fire:"Fogo", water:"Água", grass:"Grama", electric:"Elétrico",
  psychic:"Psíquico", fighting:"Lutador", dark:"Noturno", steel:"Metal",
  dragon:"Dragão", fairy:"Fada", ghost:"Fantasma", poison:"Venenoso",
  ground:"Terra", rock:"Pedra", flying:"Voador", bug:"Inseto", ice:"Gelo",
};

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  ARENA:   { label: "Na Arena",  cls: "bg-red-500/15 text-red-300" },
  RESTING: { label: "Repouso",   cls: "bg-blue-500/15 text-blue-300" },
  INJURED: { label: "Ferido",    cls: "bg-orange-500/15 text-orange-300" },
};

function BankRow({
  mascot,
  hasFood,
  hasSweet,
  isAdmin,
}: {
  mascot: BankMascot;
  hasFood: boolean;
  hasSweet: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"basic" | "full">("basic");
  const [loading, startLoading] = useTransition();
  const [fullData, setFullData] = useState<FullMascotData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleExpand = useCallback(() => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (fullData) return; // already loaded
    startLoading(async () => {
      const res = await getMascotDetailAction(mascot.id);
      if (res.error || !res.data) { setLoadError(res.error ?? "Erro ao carregar."); return; }
      setFullData(res.data);
    });
  }, [open, fullData, mascot.id]);

  const name = mascot.nickname ?? getPokemonName(mascot.pokemonId);
  const element = getPokemonElement(mascot.pokemonId);
  const stateBadge = STATE_BADGE[mascot.arenaState];
  const hasActiveExp = mascot.expeditions.length > 0;

  return (
    <div className="rounded-xl border border-border/50 bg-slate-950/40 overflow-hidden">
      {/* Row — click to expand */}
      <button
        type="button"
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
      >
        {/* Static sprite — tiny, no GIF */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getStaticSpriteUrl(mascot.pokemonId)}
          alt=""
          className="h-8 w-8 object-contain shrink-0 opacity-80"
          style={{ imageRendering: "pixelated" }}
          loading="lazy"
        />

        {/* Name + level */}
        <span className="flex-1 min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-200">{name}</span>
          <span className="text-[10px] text-slate-500">
            Nv.{mascot.level} · {TYPE_LABELS[element] ?? element} · {MOOD_EMOJI[mascot.mood] ?? "•"} {mascot.mood}
          </span>
        </span>

        {/* State badges */}
        <span className="flex items-center gap-1 shrink-0">
          {stateBadge && (
            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${stateBadge.cls}`}>
              {stateBadge.label}
            </span>
          )}
          {hasActiveExp && (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[9px] font-bold text-blue-300">
              Expedição
            </span>
          )}
          {mascot.bazarListed && (
            <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[9px] font-bold text-yellow-300">
              No Bazar
            </span>
          )}
          {loading ? (
            <Loader2 size={13} className="animate-spin text-slate-500 ml-1" />
          ) : open ? (
            <ChevronUp size={13} className="text-slate-500 ml-1" />
          ) : (
            <ChevronDown size={13} className="text-slate-500 ml-1" />
          )}
        </span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-border/40 bg-slate-900/30">
          {loadError && (
            <p className="px-4 py-3 text-xs text-red-400">{loadError}</p>
          )}
          {!fullData && !loadError && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Carregando dados do mascote...
            </div>
          )}
          {fullData && (
            <>
              {/* Basic / Full toggle */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => setView("basic")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    view === "basic"
                      ? "bg-[#FFCB05]/15 text-[#FFCB05] border border-[#FFCB05]/30"
                      : "text-slate-500 hover:text-slate-300 border border-transparent"
                  }`}
                >
                  Básico
                </button>
                <button
                  type="button"
                  onClick={() => setView("full")}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    view === "full"
                      ? "bg-slate-700 text-slate-200 border border-slate-600"
                      : "text-slate-500 hover:text-slate-300 border border-transparent"
                  }`}
                >
                  Completo
                </button>
              </div>
              <div className="px-2 pb-2">
                <MascotCard
                  mascot={{ ...fullData, hasFood, hasSweet }}
                  isAdmin={isAdmin}
                  compactView={view === "basic"}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MascotBankList({
  mascots,
  hasFood,
  hasSweet,
  isAdmin,
}: {
  mascots: BankMascot[];
  hasFood: boolean;
  hasSweet: boolean;
  isAdmin: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? mascots.filter(m => {
        const name = (m.nickname ?? getPokemonName(m.pokemonId)).toLowerCase();
        return name.includes(search.toLowerCase()) || String(m.pokemonId).includes(search);
      })
    : mascots;

  if (mascots.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-300">
          Banco de mascotes
          <span className="ml-2 text-[10px] text-slate-500 font-normal">({mascots.length})</span>
        </h2>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="rounded-xl border border-border bg-slate-900 pl-7 pr-3 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600 w-36"
          />
        </div>
      </div>

      <div className="space-y-1">
        {filtered.map(m => (
          <BankRow
            key={m.id}
            mascot={m}
            hasFood={hasFood}
            hasSweet={hasSweet}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-xs text-slate-600 py-4">Nenhum mascote encontrado.</p>
      )}
    </section>
  );
}
