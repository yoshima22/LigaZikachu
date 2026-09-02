"use client";

import { useState, useTransition } from "react";
import { Copy, FilePlus2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminCopyDeckToMatch, adminCreateDeckForMatch } from "../actions";
import { useRouter } from "next/navigation";

type DeckOption = { id: string; playerId: string; deckName: string; archetype: string | null; weekNumber: number };
type MatchOption = {
  id: string; label: string;
  players: Array<{ id: string; name: string; deckSubmissionId: string | null }>;
};

function PlayerDeckAdmin({ matchId, player, decks }: {
  matchId: string;
  player: MatchOption["players"][number];
  decks: DeckOption[];
}) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState("");
  const [deckName, setDeckName] = useState("");
  const [archetype, setArchetype] = useState("");
  const [deckList, setDeckList] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-bold text-white">{player.name}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${player.deckSubmissionId ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
          {player.deckSubmissionId ? "Deck vinculado" : "Sem deck"}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white">
          <option value="">Copiar deck já registrado...</option>
          {decks.map((deck) => <option key={deck.id} value={deck.id}>S{deck.weekNumber} · {deck.deckName}{deck.archetype ? ` · ${deck.archetype}` : ""}</option>)}
        </select>
        <Button size="sm" variant="outline" disabled={pending || !sourceId} onClick={() => startTransition(async () => {
          const result = await adminCopyDeckToMatch({ matchId, playerId: player.id, sourceSubmissionId: sourceId });
          if (result.error) toast.error(result.error); else { toast.success(`Deck ${result.deckName} copiado.`); router.refresh(); }
        })}><Copy size={13} /></Button>
      </div>
      <details className="mt-3 rounded-lg border border-cyan-400/15 bg-cyan-500/5 p-2.5">
        <summary className="cursor-pointer list-none text-[11px] font-bold text-cyan-200">Cadastrar lista manualmente</summary>
        <div className="mt-3 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={deckName} onChange={(event) => setDeckName(event.target.value)} placeholder="Nome do deck" maxLength={120} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
            <input value={archetype} onChange={(event) => setArchetype(event.target.value)} placeholder="Arquétipo (opcional)" maxLength={120} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
          </div>
          <textarea value={deckList} onChange={(event) => setDeckList(event.target.value)} placeholder="Cole a lista exportada do PTCG Live" rows={6} maxLength={12000} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-[11px] text-white" />
          <Button size="sm" disabled={pending || deckName.trim().length < 2 || deckList.trim().length < 10} onClick={() => startTransition(async () => {
            const result = await adminCreateDeckForMatch({ matchId, playerId: player.id, deckName, archetype, deckList });
            if (result.error) toast.error(result.error); else { toast.success(`Deck ${result.deckName} registrado.`); router.refresh(); }
          })} className="w-full gap-2 bg-cyan-300 text-slate-950 hover:bg-cyan-200"><FilePlus2 size={14} /> Registrar e vincular à partida</Button>
        </div>
      </details>
    </div>
  );
}

export function AdminDeckManager({ matches, decks }: { matches: MatchOption[]; decks: DeckOption[] }) {
  return (
    <details className="rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-slate-950/80 to-cyan-950/15 p-4 sm:p-5">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center gap-3"><ShieldCheck className="text-cyan-300" size={20} /><div><h2 className="font-bold text-slate-100">Correção administrativa de decks</h2><p className="mt-1 text-xs text-slate-400">Copie uma lista já registrada ou cadastre manualmente. Funciona após o bloqueio e toda alteração fica auditada.</p></div></div>
      </summary>
      <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
        {matches.map((match) => (
          <div key={match.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{match.label}</p>
            <div className="grid gap-2 lg:grid-cols-2">
              {match.players.map((player) => <PlayerDeckAdmin key={player.id} matchId={match.id} player={player} decks={decks.filter((deck) => deck.playerId === player.id)} />)}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
