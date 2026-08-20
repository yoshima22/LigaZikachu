"use client";

import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { searchSpeciesAdminAction, updateSpeciesTypesAdminAction } from "./actions";

type Species = Awaited<ReturnType<typeof searchSpeciesAdminAction>>[number];
const TYPES = ["normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];
const LABELS: Record<string,string> = { normal:"Normal",fire:"Fogo",water:"Água",electric:"Elétrico",grass:"Grama",ice:"Gelo",fighting:"Lutador",poison:"Veneno",ground:"Terra",flying:"Voador",psychic:"Psíquico",bug:"Inseto",rock:"Pedra",ghost:"Fantasma",dragon:"Dragão",dark:"Sombrio",steel:"Aço",fairy:"Fada" };

export function SpeciesTypeEditor() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Species[]>([]);
  const [selected, setSelected] = useState<Species | null>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!query.trim()) { setItems([]); return; }
    const timer = setTimeout(() => start(async () => setItems(await searchSpeciesAdminAction(query))), 220);
    return () => clearTimeout(timer);
  }, [query]);

  const toggleType = (type: string) => {
    if (!selected) return;
    const active = selected.types.includes(type);
    if (active && selected.types.length === 1) return setMessage("O mascote precisa manter pelo menos um tipo.");
    if (!active && selected.types.length >= 2) return setMessage("Remova um dos tipos atuais antes de adicionar outro.");
    setMessage("");
    setSelected({ ...selected, types: active ? selected.types.filter((item) => item !== type) : [...selected.types, type] });
  };

  const save = () => selected && start(async () => {
    const result = await updateSpeciesTypesAdminAction({
      pokemonId: selected.pokemonId,
      name: selected.name,
      generation: selected.generation,
      primaryType: selected.types[0],
      secondaryType: selected.types[1] ?? null,
    });
    setMessage(result.error ?? `${result.affected} mascote(s) existente(s) atualizado(s).`);
  });

  return <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
    <div>
      <div className="relative mb-3"><Search className="absolute left-3 top-2.5 text-slate-500" size={14}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite nome ou ID do Pokémon..." className="w-full rounded-xl border border-border bg-slate-950 py-2 pl-9 text-xs text-white"/></div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto">{items.map((species) => <button key={species.pokemonId} onClick={() => { setSelected(species); setMessage(""); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-slate-950/50 p-3 text-left hover:border-cyan-500"><img src={species.staticSpriteUrl} alt="" className={`h-12 w-12 object-contain ${species.custom?"":"[image-rendering:pixelated]"}`}/><div><p className="text-sm font-bold text-white">#{species.pokemonId} · {species.name}</p><p className="text-[10px] text-slate-400">Geração {species.generation} · {species.types.map((type) => LABELS[type] ?? type).join(" / ")}</p></div></button>)}</div>
    </div>
    <div className="rounded-2xl border border-border bg-slate-950/55 p-4">
      {selected ? <div className="space-y-4">
        <div className="flex items-center gap-4"><img src={selected.animatedSpriteUrl} alt="" className={`h-24 w-24 object-contain ${selected.custom?"":"[image-rendering:pixelated]"}`}/><div><h3 className="font-bold text-white">{selected.name}</h3><p className="text-xs text-slate-500">ID {selected.pokemonId} · Geração {selected.generation}</p></div></div>
        <div><p className="mb-2 text-xs font-bold text-slate-300">Tipos ativos ({selected.types.length}/2)</p><div className="flex flex-wrap gap-2">{TYPES.map((type) => { const active = selected.types.includes(type); return <button type="button" key={type} onClick={() => toggleType(type)} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${active ? "border-cyan-300 bg-cyan-400/20 text-cyan-100" : "border-slate-700 bg-slate-900 text-slate-500 hover:border-slate-500"}`}>{active ? "✓ " : "+ "}{LABELS[type]}</button>; })}</div></div>
        <p className="text-[11px] text-slate-400">Clique em um tipo ativo para removê-lo ou em outro para adicioná-lo. É permitido manter um ou dois tipos.</p>
        <button disabled={pending || selected.types.length < 1} onClick={save} className="w-full rounded-xl bg-cyan-400 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40">Aplicar tipos globalmente</button>
        {message && <p className="text-xs text-cyan-300">{message}</p>}
      </div> : <p className="text-sm text-slate-500">Busque e selecione uma espécie.</p>}
    </div>
  </div>;
}
