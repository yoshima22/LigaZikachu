"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PokemonRarity } from "@prisma/client";
import { setPokemonRarity } from "../actions";

const rarities = Object.values(PokemonRarity);
const rarityLabel: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Rara", EPIC: "Épica", LEGENDARY: "Lendária"
};

export function RarityEditor() {
  const [pending, startTransition] = useTransition();
  const [id, setId] = useState("");
  const [rarity, setRarity] = useState<PokemonRarity>(PokemonRarity.COMMON);

  const handleSubmit = () => {
    if (!id.trim()) { toast.error("Informe o ID do Pokémon (ex: cma123...)"); return; }
    startTransition(async () => {
      try {
        const result = await setPokemonRarity(id.trim(), rarity);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Raridade atualizada!");
        setId("");
      } catch { toast.error("Erro ao atualizar."); }
    });
  };

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <label className="space-y-1 text-xs text-slate-400 flex-1 min-w-48">
        <span>ID do Pokémon (cuid do banco)</span>
        <input value={id} onChange={(e) => setId(e.target.value)}
          placeholder="cma1b2c3d4..."
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <label className="space-y-1 text-xs text-slate-400">
        <span>Nova raridade</span>
        <select value={rarity} onChange={(e) => setRarity(e.target.value as PokemonRarity)}
          className="rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
          {rarities.map((r) => <option key={r} value={r}>{rarityLabel[r]}</option>)}
        </select>
      </label>
      <button type="button" disabled={pending} onClick={handleSubmit}
        className="rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60">
        Salvar
      </button>
    </div>
  );
}
