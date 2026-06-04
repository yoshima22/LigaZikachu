"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Swords, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerMascotSocialEvents, clearPlayerExpeditions } from "../actions";

interface Props { players: { id: string; displayName: string }[] }

export function MascotSocialPanel({ players }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ battles: number; friendships: number; pairs: number } | null>(null);
  const [clearTarget, setClearTarget] = useState("");
  const [clearResult, setClearResult] = useState<number | null>(null);

  const handle = () => {
    startTransition(async () => {
      const r = await triggerMascotSocialEvents();
      if (r.error) { toast.error(r.error); return; }
      setResult(r);
      toast.success(`${r.battles} batalhas + ${r.friendships} amizades geradas!`);
    });
  };

  const handleClearExpeditions = () => {
    if (!clearTarget) { toast.error("Selecione um jogador."); return; }
    const player = players.find(p => p.id === clearTarget);
    if (!confirm(`Limpar todas as expedições ativas de ${player?.displayName}?`)) return;
    startTransition(async () => {
      const r = await clearPlayerExpeditions(clearTarget);
      if (r.error) { toast.error(r.error); return; }
      setClearResult(r.cleared);
      toast.success(`${r.cleared} expedição(ões) limpas!`);
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Swords size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Mascotes — Ferramentas Admin</h3>
      </div>

      {/* Eventos sociais */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-400">Eventos Sociais</p>
        <p className="text-xs text-slate-500">
          Dispara batalhas e amizades aleatórias entre mascotes equipados de treinadores diferentes.
          Roda automaticamente 1x por dia via cron.
        </p>
        <Button type="button" disabled={pending} onClick={handle}
          className="gap-2 bg-slate-700 hover:bg-slate-600 text-white">
          <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
          {pending ? "Gerando…" : "Disparar agora"}
        </Button>
        {result && (
          <div className="flex gap-6 rounded-xl border border-border bg-slate-900/50 px-4 py-3 text-xs">
            <div><p className="text-slate-500">Pares</p><p className="font-bold text-slate-200 text-base">{result.pairs}</p></div>
            <div><p className="text-slate-500">Batalhas</p><p className="font-bold text-red-400 text-base">{result.battles}</p></div>
            <div><p className="text-slate-500">Amizades</p><p className="font-bold text-green-400 text-base">{result.friendships}</p></div>
          </div>
        )}
      </div>

      {/* Limpar expedições bugadas */}
      <div className="space-y-2 border-t border-border/40 pt-4">
        <p className="text-xs font-semibold text-slate-400">Limpar Expedições Bugadas</p>
        <p className="text-xs text-slate-500">
          Remove expedições presas (ativas mas sem possibilidade de coletar). O mascote volta ao normal sem recompensa.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={clearTarget} onChange={e => { setClearTarget(e.target.value); setClearResult(null); }}
            className="rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]">
            <option value="">Selecione o jogador</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
          <Button type="button" disabled={pending || !clearTarget} onClick={handleClearExpeditions}
            className="gap-2 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20">
            <Trash2 size={13} /> Limpar expedições
          </Button>
        </div>
        {clearResult !== null && (
          <p className="text-xs text-green-400">{clearResult} expedição(ões) limpas com sucesso.</p>
        )}
      </div>
    </div>
  );
}
