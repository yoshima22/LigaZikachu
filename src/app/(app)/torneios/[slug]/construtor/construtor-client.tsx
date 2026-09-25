"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { Check, Clock, Swords } from "lucide-react";
import { getConstrutorStateAction, pickOpponentDeckAction, type ConstrutorMatchView } from "./actions";

export function ConstrutorClient({ weekId, slug, weekNumber }: { weekId: string; slug: string; weekNumber: number }) {
  const [loading, setLoading] = useState(true);
  const [myDecks, setMyDecks] = useState<{ deckNumber: number; name: string; archetype: string | null }[]>([]);
  const [matches, setMatches] = useState<ConstrutorMatchView[]>([]);
  const [pending, start] = useTransition();

  const load = useCallback(() => {
    setLoading(true);
    getConstrutorStateAction(weekId).then((res) => {
      if (res.error) { toast.error(res.error); return; }
      setMyDecks(res.myDecks ?? []);
      setMatches(res.matches ?? []);
    }).finally(() => setLoading(false));
  }, [weekId]);

  useEffect(() => { load(); }, [load]);

  const pick = (matchId: string, deckSubmissionId: string) => start(async () => {
    const res = await pickOpponentDeckAction({ matchId, deckSubmissionId });
    if (res.error) { toast.error(res.error); return; }
    toast.success("Deck do adversário escolhido!");
    load();
  });

  if (loading) return <div className="rounded-2xl border border-border bg-slate-950/60 p-6 text-center text-sm text-slate-500">Carregando…</div>;

  const registered = myDecks.length >= 3;

  return (
    <div className="space-y-5">
      {/* Seus decks (registrados na janela padrão da semana) */}
      <div className="rounded-2xl border border-border bg-slate-950/60 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">Seus 3 decks</h3>
          <a href={`/torneios/${slug}/semanas/${weekNumber}`} className="text-[11px] font-bold text-[#FFCB05] hover:underline">Registrar/editar na janela da semana →</a>
        </div>
        {registered ? (
          <div className="flex flex-wrap gap-2">
            {myDecks.map((d) => (
              <span key={d.deckNumber} className="rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-200">
                <span className="font-black text-[#FFCB05]">Deck {d.deckNumber}:</span> {d.name}{d.archetype ? ` · ${d.archetype}` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-amber-300">Você ainda não registrou os 3 decks. Use a janela normal da semana (botão acima) — o modo Construtor pede exatamente 3 decks.</p>
        )}
      </div>

      {/* Partidas */}
      <div className="rounded-2xl border border-border bg-slate-950/60 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white"><Swords size={15} /> Suas partidas</h3>
        {matches.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma partida sua nesta semana ainda.</p>
        ) : (
          <div className="space-y-3">
            {matches.map((m, idx) => (
              <div key={m.matchId} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-200">Jogo {idx + 1} · vs {m.opponentName}</p>
                  {m.scheduledAt && <span className="text-[10px] text-slate-500">{new Date(m.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
                </div>

                <div className="mt-2 rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-2.5 py-1.5 text-[11px]">
                  {m.bothVoted && m.myDeckChosen
                    ? <span className="text-cyan-200"><Check size={11} className="mr-1 inline" /> Você joga com: <strong>{m.myDeckChosen.name}</strong> (escolhido por {m.opponentName})</span>
                    : <span className="text-slate-400"><Clock size={11} className="mr-1 inline" /> 🔒 As escolhas só aparecem quando os dois votarem.{m.iVoted ? " Você já votou — aguardando o adversário." : ""}</span>}
                </div>

                <div className="mt-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Escolha o deck de {m.opponentName}</p>
                  {!m.opponentHasRegistered ? (
                    <p className="text-[11px] text-slate-500">{m.opponentName} ainda não registrou os 3 decks.</p>
                  ) : m.opponentChosenByMe ? (
                    <p className="text-[11px] text-emerald-300"><Check size={11} className="mr-1 inline" /> Você já escolheu o deck dele para este jogo.</p>
                  ) : m.waitReason ? (
                    <p className="text-[11px] text-amber-300"><Clock size={11} className="mr-1 inline" /> {m.waitReason}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {m.opponentDeckOptions.map((o) => (
                        <button key={o.id} disabled={pending || !m.iCanPick} onClick={() => pick(m.matchId, o.id)}
                          className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-200 hover:border-rose-300/60 disabled:opacity-40">
                          Deck {o.deckNumber}: {o.name}{o.archetype ? ` · ${o.archetype}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
