"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendItemToAllPlayers } from "../actions";

interface ShopItem { id: string; name: string; type: string; rarity: string; active: boolean }

const TYPE_EMOJI: Record<string, string> = {
  TITLE: "🏷", BANNER: "🖼", FRAME: "🔵", ZIKALOOT_TICKET: "🎟",
  EGG_COMMON: "🥚", EGG_RARE: "🩵", EGG_SPECIAL: "💜", EGG_GEN1: "1️⃣", EGG_GEN2: "2️⃣",
  MASCOT_FOOD: "🍖", MASCOT_SWEET: "🍬",
  MASCOT_BUFF_EXP: "⚡", MASCOT_BUFF_STAT: "💊",
  MASCOT_BUFF_HAPPY: "🍯", MASCOT_BUFF_LUCK: "🍀", MASCOT_BUFF_MOOD: "💧",
};

export function BulkSendPanel({ items }: { items: ShopItem[] }) {
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<{ sent: number; skipped: number } | null>(null);

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.type.toLowerCase().includes(search.toLowerCase())
  );

  const selected = items.find(i => i.id === selectedId);

  const handleSend = () => {
    if (!selectedId || !selected) { toast.error("Selecione um item."); return; }
    const qty = Math.max(1, Math.floor(quantity));
    const label = qty > 1 ? `${qty}× "${selected.name}"` : `"${selected.name}"`;
    if (!confirm(`Enviar ${label} para TODOS os jogadores ativos? Esta ação não pode ser desfeita.`)) return;

    startTransition(async () => {
      const r = await sendItemToAllPlayers(selectedId, qty);
      if (r.error) { toast.error(r.error); return; }
      setResult({ sent: r.sent, skipped: r.skipped });
      toast.success(`${r.sent} jogador(es) receberam o item!`);
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Enviar Item para Todos os Jogadores</h3>
      </div>
      <p className="text-xs text-slate-500">
        Envia um item da ZikaShop para todos os jogadores ativos simultaneamente.
        Itens únicos (títulos, banners) são pulados se o jogador já possuir.
      </p>

      {/* Busca */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input value={search} onChange={e => { setSearch(e.target.value); setSelectedId(""); }}
          placeholder="Buscar item por nome ou tipo…"
          className="w-full rounded-xl border border-border bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600" />
      </div>

      {/* Lista */}
      {search && (
        <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-border bg-slate-900/50 p-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-2">Nenhum item encontrado.</p>
          ) : filtered.map(item => (
            <button key={item.id} type="button"
              onClick={() => { setSelectedId(item.id); setSearch(item.name); setResult(null); }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-left transition-colors ${selectedId === item.id ? "bg-[#FFCB05]/10 text-[#FFCB05]" : "hover:bg-slate-800 text-slate-300"}`}>
              <span>{TYPE_EMOJI[item.type] ?? "📦"}</span>
              <span className="font-medium truncate flex-1">{item.name}</span>
              <span className="text-slate-500 shrink-0">{item.type}</span>
              {!item.active && <span className="text-[9px] text-slate-600 shrink-0">[inativo]</span>}
            </button>
          ))}
        </div>
      )}

      {/* Selecionado */}
      {selected && (
        <div className="flex items-center gap-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-3 py-2">
          <span className="text-lg">{TYPE_EMOJI[selected.type] ?? "📦"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{selected.name}</p>
            <p className="text-[10px] text-slate-500">{selected.type} · {selected.rarity}</p>
          </div>
          <button type="button" onClick={() => { setSelectedId(""); setSearch(""); setResult(null); }}
            className="text-slate-500 hover:text-slate-300 text-xs px-1">✕</button>
        </div>
      )}

      {/* Quantidade */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 shrink-0">Quantidade por jogador:</label>
        <input
          type="number"
          min={1}
          max={999}
          value={quantity}
          onChange={e => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          className="w-20 rounded-xl border border-border bg-slate-900 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-[#FFCB05] text-center"
        />
      </div>

      <Button type="button" disabled={pending || !selectedId}
        onClick={handleSend}
        className="gap-2 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40">
        <Send size={13} />
        {pending ? "Enviando…" : `Enviar${quantity > 1 ? ` ×${quantity}` : ""} para todos`}
      </Button>

      {result && (
        <div className="flex gap-6 rounded-xl border border-border bg-slate-900/50 px-4 py-3 text-xs">
          <div><p className="text-slate-500">Receberam</p><p className="font-bold text-green-400 text-base mt-0.5">{result.sent}</p></div>
          <div><p className="text-slate-500">Já tinham / pulados</p><p className="font-bold text-slate-400 text-base mt-0.5">{result.skipped}</p></div>
        </div>
      )}
    </div>
  );
}
