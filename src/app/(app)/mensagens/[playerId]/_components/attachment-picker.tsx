"use client";

import { useEffect, useState, useTransition } from "react";
import { getMyAttachablesAction, type AttachmentData } from "../../actions";
import { X, Loader2 } from "lucide-react";

const RARITY_COLOR: Record<string, string> = {
  COMMON: "text-slate-400", UNCOMMON: "text-green-400", RARE: "text-blue-400",
  EPIC: "text-purple-400", LEGENDARY: "text-[#FFCB05]",
};

interface Props {
  onSelect: (a: AttachmentData) => void;
  onClose: () => void;
}

export function AttachmentPicker({ onSelect, onClose }: Props) {
  const [tab, setTab] = useState<"mascots" | "items">("mascots");
  const [mascots, setMascots] = useState<AttachmentData[]>([]);
  const [items, setItems] = useState<AttachmentData[]>([]);
  const [loading, start] = useTransition();

  useEffect(() => {
    start(async () => {
      const res = await getMyAttachablesAction();
      if (res.ok) { setMascots(res.mascots); setItems(res.items); }
    });
  }, []);

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

      {/* Content */}
      <div className="max-h-52 overflow-y-auto p-3">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        )}

        {!loading && tab === "mascots" && (
          mascots.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">Nenhum mascote ainda.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {mascots.map((m) => {
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
                  </button>
                );
              })}
            </div>
          )
        )}

        {!loading && tab === "items" && (
          items.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">Nenhum item no inventário.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((item) => {
                if (item.type !== "ITEM") return null;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onSelect(item); onClose(); }}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border bg-slate-800/60 p-2 text-center transition-colors hover:border-[#FFCB05]/40 hover:bg-slate-800"
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-12 w-12 object-contain" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-700 text-2xl">📦</div>
                    )}
                    <span className="line-clamp-2 text-[10px] font-medium text-slate-300 leading-tight">{item.name}</span>
                    <span className={`text-[10px] font-semibold ${RARITY_COLOR[item.rarity] ?? "text-slate-400"}`}>
                      {item.rarity}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
