"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Globe, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PokemonTypeSelector } from "@/components/ui/pokemon-type-selector";
import { saveDeck, updateDeck, deleteDeck } from "../actions";
import { CopyDeckButton } from "@/components/ui/copy-deck-button";

interface Deck { id: string; name: string; archetype: string | null; deckList: string; isPublic: boolean; updatedAt: string; }

const EMPTY = { name: "", archetype: [] as string[], deckList: "", isPublic: false };

function DeckForm({ init, onSave, onCancel, pending, label }: {
  init: typeof EMPTY; onSave: (d: typeof EMPTY) => void;
  onCancel: () => void; pending: boolean; label: string;
}) {
  const [form, setForm] = useState(init);
  return (
    <div className="space-y-3 rounded-xl border border-border bg-slate-900/50 p-4">
      <label className="space-y-1 text-xs text-slate-400 block">
        <span>Nome do deck *</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
          placeholder="Ex: Charizard ex" className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <PokemonTypeSelector selected={form.archetype} onChange={(types) => setForm({ ...form, archetype: types })} />
      <label className="space-y-1 text-xs text-slate-400 block">
        <span>Lista completa *</span>
        <textarea value={form.deckList} onChange={(e) => setForm({ ...form, deckList: e.target.value })} required
          rows={8} placeholder="Cole aqui a decklist exportada do PTCG Live"
          className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 outline-none focus:border-[#FFCB05]" />
      </label>
      <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
        <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} className="accent-[#FFCB05]" />
        Deck público (visível no seu perfil)
      </label>
      <div className="flex gap-2">
        <Button type="button" disabled={!form.name || !form.deckList || pending} onClick={() => onSave(form)}
          className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">{label}</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}

export function MyDecksClient({ decks }: { decks: Deck[] }) {
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toStr = (f: typeof EMPTY) => ({
    name: f.name, deckList: f.deckList, isPublic: f.isPublic,
    archetype: f.archetype.length > 0 ? f.archetype.join(", ") : undefined
  });

  const handleSave = (form: typeof EMPTY) => startTransition(async () => {
    try {
      const result = await saveDeck(toStr(form));
      if (result.error) { toast.error(result.error); return; }
      toast.success("Deck salvo!"); setShowCreate(false);
    } catch { toast.error("Erro ao salvar."); }
  });

  const handleUpdate = (id: string, form: typeof EMPTY) => startTransition(async () => {
    try {
      const result = await updateDeck(id, toStr(form));
      if (result.error) { toast.error(result.error); return; }
      toast.success("Deck atualizado!"); setEditingId(null);
    } catch { toast.error("Erro ao atualizar."); }
  });

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"?`)) return;
    startTransition(async () => {
      try {
        const result = await deleteDeck(id);
        if (result.error) { toast.error(result.error); return; }
        toast.success("Deck excluído.");
      } catch { toast.error("Erro ao excluir."); }
    });
  };

  return (
    <div className="space-y-4">
      <Button type="button" size="sm" onClick={() => setShowCreate(!showCreate)}
        className="gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
        <Plus size={14} /> Novo deck
      </Button>

      {showCreate && (
        <DeckForm init={EMPTY} onSave={handleSave} onCancel={() => setShowCreate(false)} pending={pending} label="Salvar deck" />
      )}

      {decks.length === 0 && !showCreate && (
        <p className="text-sm text-slate-500">Nenhum deck salvo ainda.</p>
      )}

      <div className="space-y-2">
        {decks.map((deck) => (
          <div key={deck.id} className="rounded-xl border border-border bg-slate-950/60 overflow-hidden">
            {editingId === deck.id ? (
              <div className="p-4">
                <DeckForm
                  init={{ name: deck.name, archetype: deck.archetype ? deck.archetype.split(",").map((t) => t.trim()).filter(Boolean) : [], deckList: deck.deckList, isPublic: deck.isPublic }}
                  onSave={(form) => handleUpdate(deck.id, form)}
                  onCancel={() => setEditingId(null)}
                  pending={pending} label="Atualizar"
                />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setExpandedId(expandedId === deck.id ? null : deck.id)}
                      className="text-left w-full">
                      <p className="font-semibold text-slate-200 flex items-center gap-2">
                        {deck.isPublic
                          ? <Globe size={13} className="text-[#7AC74C] shrink-0" />
                          : <Lock size={13} className="text-slate-500 shrink-0" />}
                        {deck.name}
                      </p>
                      {deck.archetype && <p className="text-xs text-slate-500">{deck.archetype}</p>}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <CopyDeckButton deckList={deck.deckList} />
                    <button type="button" disabled={pending}
                      onClick={() => setEditingId(deck.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200"><Pencil size={14} /></button>
                    <button type="button" disabled={pending}
                      onClick={() => handleDelete(deck.id, deck.name)}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </div>
                {expandedId === deck.id && (
                  <div className="border-t border-border px-4 pb-4">
                    <div className="flex items-center justify-between mt-3 mb-1">
                      <span className="text-[10px] text-slate-500">Lista do deck</span>
                      <CopyDeckButton deckList={deck.deckList} />
                    </div>
                    <pre className="max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300">
                      {deck.deckList}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
