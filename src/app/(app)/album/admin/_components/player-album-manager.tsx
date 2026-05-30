"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetPlayerAlbum, removePlayerSticker, addCardToPlayer } from "../actions";

interface Props {
  players: { id: string; displayName: string }[];
}

export function PlayerAlbumManager({ players }: Props) {
  const [pending, startTransition] = useTransition();
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [nationalId, setNationalId] = useState(1);
  const [removeCardId, setRemoveCardId] = useState("");

  const handleReset = () => {
    if (!selectedPlayerId) { toast.error("Selecione um jogador."); return; }
    const name = players.find((p) => p.id === selectedPlayerId)?.displayName;
    if (!confirm(`Resetar TODO o álbum de ${name}? Esta ação é irreversível.`)) return;
    startTransition(async () => {
      try {
        const result = await resetPlayerAlbum(selectedPlayerId);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Álbum de ${name} resetado.`);
      } catch { toast.error("Erro ao resetar."); }
    });
  };

  const handleAdd = () => {
    if (!selectedPlayerId) { toast.error("Selecione um jogador."); return; }
    startTransition(async () => {
      try {
        const result = await addCardToPlayer(selectedPlayerId, nationalId);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`Pokémon #${nationalId} adicionado!`);
      } catch { toast.error("Erro ao adicionar."); }
    });
  };

  const handleRemove = () => {
    if (!selectedPlayerId || !removeCardId.trim()) { toast.error("Selecione jogador e informe o ID da carta."); return; }
    startTransition(async () => {
      try {
        const result = await removePlayerSticker(selectedPlayerId, removeCardId.trim());
        if (result.error) { toast.error(result.error); return; }
        toast.success("Figurinha removida.");
        setRemoveCardId("");
      } catch { toast.error("Erro ao remover."); }
    });
  };

  return (
    <div className="space-y-4">
      <label className="space-y-1 text-xs text-slate-400 block">
        <span>Jogador</span>
        <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
          <option value="">Selecione</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Adicionar carta */}
        <div className="rounded-xl border border-border bg-slate-900/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-[#7AC74C]">Adicionar Pokémon</p>
          <label className="space-y-1 text-xs text-slate-400 block">
            <span>National ID</span>
            <input type="number" min={1} max={1025} value={nationalId}
              onChange={(e) => setNationalId(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          </label>
          <button type="button" disabled={pending} onClick={handleAdd}
            className="w-full rounded-lg bg-[#7AC74C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#7AC74C]/80 disabled:opacity-50">
            Adicionar
          </button>
        </div>

        {/* Remover carta por ID */}
        <div className="rounded-xl border border-border bg-slate-900/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-400">Remover Figurinha</p>
          <label className="space-y-1 text-xs text-slate-400 block">
            <span>ID da carta (cuid)</span>
            <input value={removeCardId} onChange={(e) => setRemoveCardId(e.target.value)}
              placeholder="cma1b2c3..."
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
          </label>
          <button type="button" disabled={pending} onClick={handleRemove}
            className="w-full rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-400 disabled:opacity-50">
            Remover
          </button>
        </div>

        {/* Resetar álbum */}
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-red-400">Resetar Álbum Completo</p>
          <p className="text-xs text-slate-500">Remove TODAS as figurinhas do jogador selecionado. Irreversível.</p>
          <button type="button" disabled={pending || !selectedPlayerId} onClick={handleReset}
            className="w-full rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50">
            Resetar Álbum
          </button>
        </div>
      </div>
    </div>
  );
}
