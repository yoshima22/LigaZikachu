"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldMinus } from "lucide-react";
import { PlayerSearchInput, type PlayerSearchOption } from "@/components/player-search-input";
import { setGamemasterRoleAction } from "../actions";

export function GamemasterPanel() {
  const [player, setPlayer] = useState<PlayerSearchOption | null>(null);
  const [pending, start] = useTransition();

  const update = (enabled: boolean) => {
    if (!player) return toast.error("Selecione um jogador.");
    start(async () => {
      const result = await setGamemasterRoleAction(player.id, enabled);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(enabled ? `${player.displayName} agora é Gamemaster.` : `${player.displayName} voltou a ser jogador comum.`);
      setPlayer(null);
    });
  };

  return <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
    <div className="mb-4"><h2 className="font-semibold text-violet-200">Controle de Gamemasters</h2><p className="mt-1 text-xs text-slate-400">Gamemasters acessam ferramentas administrativas, mas continuam participando do jogo, rankings e ligas como jogadores comuns. Apenas administradores podem conceder ou remover esta função.</p></div>
    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <PlayerSearchInput value={player?.id ?? ""} onChange={(_, option) => setPlayer(option)} placeholder="Buscar jogador por nome ou nick..."/>
      <button disabled={pending || !player} onClick={() => update(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><ShieldCheck size={14}/> Tornar Gamemaster</button>
      <button disabled={pending || !player} onClick={() => update(false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-40"><ShieldMinus size={14}/> Remover função</button>
    </div>
  </section>;
}
