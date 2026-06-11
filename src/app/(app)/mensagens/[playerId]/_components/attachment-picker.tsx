"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getMyAttachablesAction, type AttachmentData } from "../../actions";
import { X, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { getPokemonName } from "@/lib/mascot-data";

const RARITY_COLOR: Record<string, string> = {
  COMMON: "text-slate-400", UNCOMMON: "text-green-400", RARE: "text-blue-400",
  EPIC: "text-purple-400", LEGENDARY: "text-[#FFCB05]",
};

const PAGE_SIZE = 12;

interface Props {
  onSelect: (a: AttachmentData) => void;
  onClose: () => void;
}

export function AttachmentPicker({ onSelect, onClose }: Props) {
  const [tab, setTab] = useState<"mascots" | "items">("mascots");
  const [mascots, setMascots] = useState<AttachmentData[]>([]);
  const [items, setItems] = useState<AttachmentData[]>([]);
  const [loading, start] = useTransition();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    start(async () => {
      const res = await getMyAttachablesAction();
      if (res.ok) { setMascots(res.mascots); setItems(res.items); }
    });
  }, []);

  // Reset page when tab or search changes
  useEffect(() => { setPage(0); }, [tab, search]);

  const filteredMascots = useMemo(() => {
    if (!search.trim()) return mascots.filter((m) => m.type === "MASCOT");
    const q = search.toLowerCase();
    return mascots.filter((m) => {
      if (m.type !== "MASCOT") return false;
      return (
        (m.nickname ?? "").toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q)
      );
    });
  }, [mascots, search]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items.filter((i) => i.type === "ITEM");
    const q = search.toLowerCase();
    return items.filter((i) => i.type === "ITEM" && i.name.toLowerCase().includes(q));
  }, [items, search]);

  const current = tab === "mascots" ? filteredMascots : filteredItems;
  const totalPages = Math.ceil(current.length / PAGE_SIZE);
  const paged = current.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-border bg-slate-900 shadow-xl z-20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex gap-1">
          {(["mascots", "items"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === t ? "bg-[#FFCB05] text-[#1A1A2E]" : "text-slate-400 hover:text-white"
              }`}
            >
              {t === "mascots" ? "🐾 Mascotes" : "📦 Itens"}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-1.5">
          <Search size={13} className="shrink-0 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "mascots" ? "Buscar por nome ou apelido…" : "Buscar item…"}
            className="w-full bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="shrink-0 text-slate-500 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-52 overflow-y-auto p-3">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        )}

        {!loading && paged.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-500">
            {search ? "Nenhum resultado." : tab === "mascots" ? "Nenhum mascote ainda." : "Nenhum item no inventário."}
          </p>
        )}

        {!loading && tab === "mascots" && paged.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {paged.map((m) => {
              if (m.type !== "MASCOT") return null;
              return (
                <button
                  key={m.id}
                  onClick={() => { onSelect(m); onClose(); }}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border bg-slate-800/60 p-2 text-center transition-colors hover:border-[#FFCB05]/40 hover:bg-slate-800"
                >
                  <img src={m.spriteUrl} alt="" className="h-12 w-12 object-contain" />
                  <span className="line-clamp-1 text-[10px] font-medium text-slate-300">
                    {m.nickname || m.displayName}
                  </span>
                  <span className="text-[10px] text-slate-500">Lv.{m.level}</span>
                  {m.personality && (
                    <span className="line-clamp-1 text-[9px] italic text-slate-600">{m.personality}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {!loading && tab === "items" && paged.length > 0 && (
          <div className="space-y-1.5">
            {paged.map((item) => {
              if (item.type !== "ITEM") return null;
              return (
                <button
                  key={item.id}
                  onClick={() => { onSelect(item); onClose(); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-slate-800/60 px-3 py-2 text-left transition-colors hover:border-[#FFCB05]/40 hover:bg-slate-800"
                >
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xl">📦</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white">{item.name}</p>
                    <p className={`text-[10px] font-medium ${RARITY_COLOR[item.rarity] ?? "text-slate-400"}`}>
                      {item.rarity}
                    </p>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-slate-400">{item.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft size={13} /> Anterior
          </button>
          <span className="text-[10px] text-slate-500">
            {page + 1} / {totalPages} · {current.length} {tab === "mascots" ? "mascotes" : "itens"}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"
          >
            Próximo <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
