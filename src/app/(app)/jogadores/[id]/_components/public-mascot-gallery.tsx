"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { getPokemonElement, getPokemonName, getSpriteUrl, MOOD_EMOJI } from "@/lib/mascot-data";

type PublicMascot = {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  mood: string;
  isEquipped: boolean;
  isFavorite: boolean;
};

const TYPE_OPTIONS = [
  "normal", "fire", "water", "grass", "electric", "psychic", "fighting",
  "dark", "steel", "dragon", "fairy", "ghost", "poison", "ground", "rock",
  "flying", "bug", "ice",
];

const TYPE_LABELS: Record<string, string> = {
  normal: "Normal",
  fire: "Fogo",
  water: "Agua",
  grass: "Grama",
  electric: "Eletrico",
  psychic: "Psiquico",
  fighting: "Lutador",
  dark: "Noturno",
  steel: "Metal",
  dragon: "Dragao",
  fairy: "Fada",
  ghost: "Fantasma",
  poison: "Venenoso",
  ground: "Terra",
  rock: "Pedra",
  flying: "Voador",
  bug: "Inseto",
  ice: "Gelo",
};

const PAGE_SIZE = 12;

export function PublicMascotGallery({ mascots }: { mascots: PublicMascot[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PublicMascot | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mascots.filter((mascot) => {
      const pokemonName = getPokemonName(mascot.pokemonId);
      const displayName = mascot.nickname ?? pokemonName;
      const element = getPokemonElement(mascot.pokemonId);
      const matchesSearch =
        !query ||
        displayName.toLowerCase().includes(query) ||
        pokemonName.toLowerCase().includes(query) ||
        String(mascot.pokemonId).includes(query);
      const matchesType = !type || element === type;
      return matchesSearch && matchesType;
    });
  }, [mascots, search, type]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateType = (value: string) => {
    setType(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Buscar mascote..."
            className="w-full rounded-xl border border-border bg-slate-900 py-2 pl-8 pr-3 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#FFCB05]"
          />
        </div>
        <select
          value={type}
          onChange={(event) => updateType(event.target.value)}
          className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-300 outline-none focus:border-[#FFCB05]"
        >
          <option value="">Todos os tipos</option>
          {TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>{TYPE_LABELS[option]}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((mascot) => {
          const pokemonName = getPokemonName(mascot.pokemonId);
          return (
            <button
              key={mascot.id}
              type="button"
              onClick={() => setSelected(mascot)}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-slate-950/50 p-2 text-left transition-colors hover:border-[#FFCB05]/50 hover:bg-[#FFCB05]/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getSpriteUrl(mascot.pokemonId, true)}
                alt=""
                className="h-11 w-11 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-slate-100">
                  {mascot.nickname ?? pokemonName}
                </span>
                <span className="text-[10px] text-slate-500">
                  Nv.{mascot.level} | {TYPE_LABELS[getPokemonElement(mascot.pokemonId)] ?? getPokemonElement(mascot.pokemonId)}
                </span>
                <span className="block text-[10px] text-slate-600">
                  {MOOD_EMOJI[mascot.mood] ?? ""}{mascot.isFavorite ? " Favorito" : mascot.isEquipped ? " Equipado" : mascot.mood}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-slate-500">
          Nenhum mascote encontrado com esses filtros.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>{filtered.length} mascote{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border border-border p-1.5 text-slate-400 disabled:opacity-30"
          >
            <ChevronLeft size={13} />
          </button>
          <span>Pagina {safePage}/{totalPages}</span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="rounded-lg border border-border p-1.5 text-slate-400 disabled:opacity-30"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#FFCB05]/30 bg-slate-950 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#FFCB05]">Mascote</p>
                <h3 className="mt-1 text-lg font-bold text-slate-100">
                  {selected.nickname ?? getPokemonName(selected.pokemonId)}
                </h3>
                {selected.nickname && (
                  <p className="text-xs text-slate-500">{getPokemonName(selected.pokemonId)}</p>
                )}
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-border p-2 text-slate-400 hover:text-white">
                <X size={14} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getSpriteUrl(selected.pokemonId, true)}
              alt=""
              className="mx-auto my-5 h-40 w-40 object-contain"
              style={{ imageRendering: "pixelated" }}
            />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label="Nivel" value={`Nv.${selected.level}`} />
              <Info label="Tipo" value={TYPE_LABELS[getPokemonElement(selected.pokemonId)] ?? getPokemonElement(selected.pokemonId)} />
              <Info label="Humor" value={`${MOOD_EMOJI[selected.mood] ?? ""} ${selected.mood}`} />
              <Info label="Status" value={selected.isFavorite ? "Favorito" : selected.isEquipped ? "Equipado" : "Colecao"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-slate-900/60 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-200">{value}</p>
    </div>
  );
}
