"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Award, Check, X } from "lucide-react";
import { adminListConstrutorGymDecksAction, adminValidateConstrutorGymDeckAction, type AdminConstrutorGymDeck } from "./actions";

/** Admin: revisar os decks que declararam Jornada de Ginásio (insígnia), antes mesmo da partida. */
export function ConstrutorAdminPanel({ weekId }: { weekId: string }) {
  const [decks, setDecks] = useState<AdminConstrutorGymDeck[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const load = useCallback(() => {
    adminListConstrutorGymDecksAction(weekId).then((res) => {
      if (res.error) toast.error(res.error);
      else setDecks(res.decks ?? []);
    });
  }, [weekId]);
  useEffect(() => { load(); }, [load]);

  const validate = (deckId: string, valid: boolean) => start(async () => {
    const res = await adminValidateConstrutorGymDeckAction({ deckId, valid, notes: notes[deckId] });
    if (res.error) { toast.error(res.error); return; }
    toast.success(valid ? "Deck validado para a insígnia." : "Deck marcado como inválido para a insígnia.");
    load();
  });

  if (!decks) return null;
  const pendingCount = decks.filter((d) => d.valid === null).length;

  return (
    <div className="rounded-2xl border border-amber-400/25 bg-amber-500/5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200"><Award size={15} /> Validação de Jornadas de Ginásio (admin)</h3>
        <span className="rounded-full border border-amber-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
          {pendingCount} pendente{pendingCount === 1 ? "" : "s"} de {decks.length}
        </span>
      </div>
      {decks.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhum deck declarou Jornada de Ginásio neste dia.</p>
      ) : (
        <div className="space-y-2">
          {decks.map((d) => (
            <div key={d.deckId} className="rounded-xl border border-white/10 bg-slate-900/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setOpen(open === d.deckId ? null : d.deckId)} className="min-w-0 text-left">
                  <p className="truncate text-xs font-bold text-white">{d.playerName} · Deck {d.slot}: {d.deckName}</p>
                  <p className="text-[10px] text-amber-300">Insígnia: {d.badgeName}</p>
                </button>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  d.valid === true ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                    : d.valid === false ? "border-red-400/30 bg-red-500/10 text-red-300"
                      : "border-amber-400/30 bg-amber-500/10 text-amber-300"}`}>
                  {d.valid === true ? "Válido" : d.valid === false ? "Inválido" : "Em revisão"}
                </span>
              </div>
              {open === d.deckId && (
                <div className="mt-2 space-y-2">
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] leading-relaxed text-slate-300">{d.deckList}</pre>
                  <input
                    value={notes[d.deckId] ?? d.notes ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [d.deckId]: e.target.value }))}
                    placeholder="Observação (opcional)"
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-amber-400/50"
                  />
                  <div className="flex gap-2">
                    <button type="button" disabled={pending} onClick={() => validate(d.deckId, true)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-900 disabled:opacity-50"><Check size={13} /> Validar</button>
                    <button type="button" disabled={pending} onClick={() => validate(d.deckId, false)}
                      className="flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><X size={13} /> Invalidar</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
