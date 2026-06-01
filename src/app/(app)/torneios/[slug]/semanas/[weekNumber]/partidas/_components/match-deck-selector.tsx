"use client";

import { useState, useTransition } from "react";
import { BookOpen, ChevronDown, ChevronUp, Swords, Trash2, CheckCircle } from "lucide-react";
import { POKEMON_TYPE_EMOJIS } from "@/lib/pokemon-types-data";
import { submitDeckForMatch, deleteOwnDeckSubmission } from "../../../../../actions";
import { DeckActionButtons } from "@/components/ui/deck-action-buttons";

interface SavedDeckOption {
  id: string;
  name: string;
  archetype: string | null;
  deckList: string;
}

interface ExistingSubmission {
  id: string;
  deckName: string;
  archetype: string | null;
  deckList: string;
}

interface Props {
  matchId: string;
  matchNumber: number;
  opponentName: string;
  weekOpen: boolean;
  savedDecks: SavedDeckOption[];
  existingSubmission: ExistingSubmission | null;
}

export function MatchDeckSelector({
  matchId,
  matchNumber,
  opponentName,
  weekOpen,
  savedDecks,
  existingSubmission,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(!existingSubmission);
  const [deckName, setDeckName] = useState(existingSubmission?.deckName ?? "");
  const [deckList, setDeckList] = useState(existingSubmission?.deckList ?? "");
  const [archetype, setArchetype] = useState(existingSubmission?.archetype ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadSavedDeck = (deck: SavedDeckOption) => {
    setDeckName(deck.name);
    setDeckList(deck.deckList);
    setArchetype(deck.archetype ?? "");
    setSuccess(false);
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await submitDeckForMatch({
        matchId,
        deckName,
        archetype: archetype || undefined,
        deckList,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setOpen(false);
      }
    });
  };

  const handleDelete = () => {
    if (!existingSubmission) return;
    if (!window.confirm("Remover deck desta partida?")) return;
    startTransition(async () => {
      const result = await deleteOwnDeckSubmission(existingSubmission.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDeckName(""); setDeckList(""); setArchetype("");
        setSuccess(false);
        setOpen(true);
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-slate-900/50 overflow-hidden">
      {/* Header da partida */}
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-400">
            {matchNumber}
          </span>
          <Swords size={13} className="shrink-0 text-slate-500" />
          <span className="text-sm font-medium text-white truncate">vs {opponentName}</span>
          {existingSubmission && !open && (
            <span className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400">
              <CheckCircle size={10} /> {existingSubmission.deckName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!existingSubmission && weekOpen && (
            <span className="text-[10px] text-amber-400 border border-amber-400/30 rounded-full px-2 py-0.5">
              Deck pendente
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
        </div>
      </button>

      {/* Formulário */}
      {open && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          {existingSubmission && (
            <div className="flex items-start justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-emerald-400">Deck registrado</p>
                <p className="text-[11px] text-slate-400">{existingSubmission.deckName}{existingSubmission.archetype ? ` · ${existingSubmission.archetype}` : ""}</p>
              </div>
              {weekOpen && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleDelete}
                  className="shrink-0 flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={10} /> Remover
                </button>
              )}
            </div>
          )}

          {weekOpen && (
            <>
              {/* Selecionar deck salvo */}
              {savedDecks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <BookOpen size={10} /> Selecionar dos meus decks
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {savedDecks.map(d => {
                      const types = d.archetype
                        ? d.archetype.split(/[,/]/).map(t => t.trim().toLowerCase()).filter(Boolean)
                        : [];
                      const selected = deckName === d.name;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => loadSavedDeck(d)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            selected
                              ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05]"
                              : "border-border text-slate-400 hover:border-slate-500 hover:text-slate-200"
                          }`}
                        >
                          {types.slice(0, 3).map((t, i) => {
                            const emoji = (POKEMON_TYPE_EMOJIS as Record<string, string>)[t];
                            return emoji ? <span key={i}>{emoji}</span> : null;
                          })}
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Campos do deck */}
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-[10px] text-slate-400">
                    <span>Nome do deck *</span>
                    <input
                      value={deckName}
                      onChange={e => { setDeckName(e.target.value); setSuccess(false); }}
                      placeholder="Ex: Charizard ex"
                      className="w-full rounded-lg border border-border bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
                    />
                  </label>
                  <label className="space-y-1 text-[10px] text-slate-400">
                    <span>Arquétipo (opcional)</span>
                    <input
                      value={archetype}
                      onChange={e => { setArchetype(e.target.value); setSuccess(false); }}
                      placeholder="Ex: Fogo"
                      className="w-full rounded-lg border border-border bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05]"
                    />
                  </label>
                </div>
                <label className="space-y-1 text-[10px] text-slate-400 block">
                  <div className="flex items-center justify-between mb-1">
                    <span>Lista do deck *</span>
                    {/* Botões: copiar + salvar nos meus decks */}
                    <DeckActionButtons
                      deckName={deckName}
                      deckList={deckList}
                      archetype={archetype}
                    />
                  </div>
                  <textarea
                    value={deckList}
                    onChange={e => { setDeckList(e.target.value); setSuccess(false); }}
                    placeholder={"Pokémon: 4\n4 Charizard ex OBF 125\n...\nTreinador: ...\nEnergia: ..."}
                    rows={6}
                    className="w-full rounded-lg border border-border bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05] font-mono resize-none"
                  />
                </label>
              </div>

              {error && <p className="text-[11px] text-red-400">{error}</p>}
              {success && <p className="text-[11px] text-emerald-400">✓ Deck registrado com sucesso!</p>}

              <button
                type="button"
                disabled={pending || !deckName.trim() || !deckList.trim()}
                onClick={handleSubmit}
                className="w-full rounded-lg bg-[#FFCB05] py-2 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? "Salvando…" : existingSubmission ? "Atualizar deck" : "Registrar deck para esta partida"}
              </button>
            </>
          )}

          {!weekOpen && !existingSubmission && (
            <p className="text-[11px] text-slate-500">Prazo encerrado — deck não enviado para esta partida.</p>
          )}
        </div>
      )}
    </div>
  );
}
