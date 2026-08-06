"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldMinus, UserCog } from "lucide-react";
import { PlayerSearchInput, type PlayerSearchOption } from "@/components/player-search-input";
import { setGamemasterRoleAction } from "../actions";

type GamemasterOption = PlayerSearchOption;

export function GamemasterPanel({ initialGamemasters }: { initialGamemasters: GamemasterOption[] }) {
  const [player, setPlayer] = useState<PlayerSearchOption | null>(null);
  const [gamemasters, setGamemasters] = useState(initialGamemasters);
  const [pending, start] = useTransition();

  const update = (target: PlayerSearchOption | null, enabled: boolean) => {
    if (!target) return toast.error("Selecione um jogador.");
    start(async () => {
      const result = await setGamemasterRoleAction(target.id, enabled);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setGamemasters((current) => enabled
        ? [...current.filter((item) => item.id !== target.id), target].sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"))
        : current.filter((item) => item.id !== target.id));
      toast.success(enabled ? `${target.displayName} agora é Gamemaster.` : `${target.displayName} voltou a ser jogador comum.`);
      setPlayer(null);
    });
  };

  return <section className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5">
    <div className="mb-4"><h2 className="font-semibold text-violet-200">Controle de Gamemasters</h2><p className="mt-1 text-xs text-slate-400">Gamemasters acessam ferramentas administrativas, mas continuam participando do jogo, rankings e ligas como jogadores comuns. Apenas administradores podem conceder ou remover esta função.</p></div>
    <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
      <PlayerSearchInput value={player?.id ?? ""} onChange={(_, option) => setPlayer(option)} placeholder="Buscar jogador por nome ou nick..."/>
      <button disabled={pending || !player} onClick={() => update(player, true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><ShieldCheck size={14}/> Tornar Gamemaster</button>
      <button disabled={pending || !player} onClick={() => update(player, false)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 px-4 py-2 text-xs font-bold text-red-300 disabled:opacity-40"><ShieldMinus size={14}/> Remover função</button>
    </div>
    <div className="mt-5 border-t border-violet-500/15 pt-4">
      <div className="mb-2 flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-200"><UserCog size={14}/> Gamemasters atuais</p><span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">{gamemasters.length}</span></div>
      {gamemasters.length === 0 ? <p className="rounded-xl border border-dashed border-violet-500/20 px-3 py-4 text-center text-xs text-slate-500">Nenhuma conta possui esta função.</p> : <div className="grid gap-2 md:grid-cols-2">{gamemasters.map((gamemaster) => <div key={gamemaster.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-violet-500/15 bg-slate-950/40 px-3 py-2"><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{gamemaster.displayName}</p>{gamemaster.ptcglNick && <p className="truncate text-[10px] text-slate-500">@{gamemaster.ptcglNick}</p>}</div><button type="button" disabled={pending} onClick={() => update(gamemaster, false)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-red-500/25 px-2.5 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-40"><ShieldMinus size={12}/> Remover</button></div>)}</div>}
    </div>
  </section>;
}
