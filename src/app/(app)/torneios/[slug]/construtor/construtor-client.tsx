"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { Check, Clock, Lock, Swords } from "lucide-react";
import { getConstrutorStateAction, saveConstrutorDecksAction, pickOpponentDeckAction, type ConstrutorMatchView } from "./actions";

type DeckForm = { slot: number; name: string; deckList: string; archetype: string };
const EMPTY: DeckForm[] = [1, 2, 3].map((slot) => ({ slot, name: "", deckList: "", archetype: "" }));

export function ConstrutorClient({ weekId }: { weekId: string }) {
  const [loading, setLoading] = useState(true);
  const [decks, setDecks] = useState<DeckForm[]>(EMPTY);
  const [decksLocked, setDecksLocked] = useState(false);
  const [matches, setMatches] = useState<ConstrutorMatchView[]>([]);
  const [pending, start] = useTransition();

  const load = useCallback(() => {
    setLoading(true);
    getConstrutorStateAction(weekId).then((res) => {
      if (res.error) { toast.error(res.error); return; }
      if (res.myDecks?.length) {
        setDecks([1, 2, 3].map((slot) => {
          const d = res.myDecks!.find((x) => x.slot === slot);
          return { slot, name: d?.name ?? "", deckList: d?.deckList ?? "", archetype: d?.archetype ?? "" };
        }));
      }
      setDecksLocked(!!res.decksLocked);
      setMatches(res.matches ?? []);
    }).finally(() => setLoading(false));
  }, [weekId]);

  useEffect(() => { load(); }, [load]);

  const saveDecks = () => start(async () => {
    const res = await saveConstrutorDecksAction({ tournamentWeekId: weekId, decks });
    if (res.error) { toast.error(res.error); return; }
    toast.success("Decks salvos!");
    load();
  });

  const pick = (matchId: string, deckId: string) => start(async () => {
    const res = await pickOpponentDeckAction({ matchId, deckId });
    if (res.error) { toast.error(res.error); return; }
    toast.success("Deck do adversário escolhido!");
    load();
  });

  if (loading) return <div className="rounded-2xl border border-border bg-slate-950/60 p-6 text-center text-sm text-slate-500">Carregando…</div>;

  return (
    <div className="space-y-5">
      {/* Registro dos 3 decks */}
      <div className="rounded-2xl border border-border bg-slate-950/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">Seus 3 decks</h3>
          {decksLocked && <span className="flex items-center gap-1 text-[11px] text-amber-300"><Lock size={12} /> Em jogo — não editável</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {decks.map((d, i) => (
            <div key={d.slot} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
              <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-[#FFCB05]">Deck {d.slot}</p>
              <input
                value={d.name} disabled={decksLocked}
                onChange={(e) => setDecks((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                placeholder="Nome do deck"
                className="mb-2 w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05]/50 disabled:opacity-60"
              />
              <input
                value={d.archetype} disabled={decksLocked}
                onChange={(e) => setDecks((s) => s.map((x, j) => j === i ? { ...x, archetype: e.target.value } : x))}
                placeholder="Arquétipo (opcional)"
                className="mb-2 w-full rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-[11px] text-slate-300 outline-none focus:border-[#FFCB05]/50 disabled:opacity-60"
              />
              <textarea
                value={d.deckList} disabled={decksLocked} rows={4}
                onChange={(e) => setDecks((s) => s.map((x, j) => j === i ? { ...x, deckList: e.target.value } : x))}
                placeholder="Lista do deck"
                className="w-full resize-y rounded-lg border border-border bg-slate-950 px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-[#FFCB05]/50 disabled:opacity-60"
              />
            </div>
          ))}
        </div>
        {!decksLocked && (
          <div className="mt-3 flex justify-end">
            <button onClick={saveDecks} disabled={pending} className="rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">
              {pending ? "Salvando…" : "Salvar decks"}
            </button>
          </div>
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

                {/* O deck que EU vou jogar (escolhido pelo adversário) */}
                <div className="mt-2 rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-2.5 py-1.5 text-[11px]">
                  {m.myDeckChosen
                    ? <span className="text-cyan-200"><Check size={11} className="mr-1 inline" /> Você joga com: <strong>{m.myDeckChosen.name}</strong> (escolhido por {m.opponentName})</span>
                    : <span className="text-slate-400"><Clock size={11} className="mr-1 inline" /> Aguardando {m.opponentName} escolher o seu deck.</span>}
                </div>

                {/* Minha vez de escolher o deck do adversário */}
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
                          Deck {o.slot}: {o.name}{o.archetype ? ` · ${o.archetype}` : ""}
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
