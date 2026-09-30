"use client";

import { useMemo, useState } from "react";
import { PawPrint, Search, X } from "lucide-react";
import { getPokemonName, getStaticSpriteUrl } from "@/lib/mascot-data";
import { buildMascotMissionOption, validateMascotMissionSubmission } from "@/lib/tcg-mascot-mission";

export type RawMissionMascot = { id: string; pokemonId: number; nickname: string | null; level: number };

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/**
 * Seletor de mascote da Missão de Mascote com busca real (nome, apelido, espécie
 * ou nível) e validação em tempo real contra a lista do deck.
 */
export function MascotMissionPicker({
  mascots, value, onChange, deckList, disabled,
}: {
  mascots: RawMissionMascot[];
  value: string;
  onChange: (id: string) => void;
  deckList: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = norm(query.trim());
    const list = q
      ? mascots.filter((m) => norm(`${m.nickname ?? ""} ${getPokemonName(m.pokemonId)} nv ${m.level} ${m.level}`).includes(q))
      : mascots;
    return list.slice(0, 12);
  }, [mascots, query]);

  const selectedRaw = mascots.find((m) => m.id === value) ?? null;
  const selected = useMemo(() => (selectedRaw ? buildMascotMissionOption(selectedRaw) : null), [selectedRaw]);
  const validation = useMemo(
    () => (selected && deckList.trim() ? validateMascotMissionSubmission(deckList, selected) : null),
    [selected, deckList],
  );

  return (
    <div className="space-y-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-2 text-[10px] text-slate-400">
      <span className="flex items-center gap-1 font-semibold uppercase tracking-wide text-emerald-300"><PawPrint size={11} /> Missão de Mascote (opcional)</span>

      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-2.5 text-emerald-300/60" />
        <input
          value={query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder={selected ? `${selected.displayName} (${selected.speciesName})` : "Buscar mascote por nome, espécie ou nível..."}
          className="w-full rounded-lg border border-emerald-400/25 bg-slate-950 py-2 pl-8 pr-8 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400 disabled:opacity-50"
        />
        {(selected || query) && !disabled && (
          <button type="button" aria-label="Limpar" onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
            className="absolute right-2 top-2 rounded p-0.5 text-slate-500 hover:text-white"><X size={14} /></button>
        )}
        {open && !disabled && (
          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-emerald-400/25 bg-slate-950 p-1.5 shadow-2xl">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(""); setQuery(""); setOpen(false); }}
              className="mb-1 flex w-full rounded-lg px-3 py-2 text-left text-[11px] text-slate-400 hover:bg-slate-800">Sem missão neste deck</button>
            {results.map((m) => {
              const species = getPokemonName(m.pokemonId);
              return (
                <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange(m.id); setQuery(""); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left hover:bg-emerald-400/10 ${value === m.id ? "bg-emerald-400/10" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getStaticSpriteUrl(m.pokemonId)} alt="" className="h-9 w-9 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                  <span className="min-w-0">
                    <b className="block truncate text-xs text-white">{m.nickname?.trim() || species}</b>
                    <small className="block truncate text-[10px] text-slate-500">{species} · Nv.{m.level}</small>
                  </span>
                </button>
              );
            })}
            {results.length === 0 && <span className="block px-3 py-4 text-center text-[11px] text-slate-500">Nenhum mascote encontrado.</span>}
          </div>
        )}
      </div>

      {selected && (
        <div className="flex items-start gap-3 rounded-lg border border-slate-700/70 bg-slate-950/70 p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selected.spriteUrl} alt={selected.displayName} className="h-12 w-12 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white">{selected.displayName} <span className="font-normal text-slate-500">({selected.speciesName})</span></p>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Linha aceita: {selected.acceptedCardNames.join(", ")}</p>
            <p className={`mt-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold ${
              !validation ? "border-slate-600/40 bg-slate-800/40 text-slate-400"
                : validation.valid ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-red-400/30 bg-red-500/10 text-red-300"}`}>
              {!validation
                ? "Cole a lista do deck para validar a missão."
                : validation.valid
                  ? `✓ Deck válido para a missão. Encontrado: ${validation.matchedCardNames.join(", ")}.`
                  : "✗ Deck ainda não é válido: nenhuma carta da espécie ou da linha evolutiva foi encontrada."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
