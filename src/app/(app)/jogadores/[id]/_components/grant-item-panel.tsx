"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Gift, Plus, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { grantItemToPlayer } from "../actions";

interface ShopItem {
  id: string;
  name: string;
  type: string;
  rarity: string;
  active?: boolean;
}

interface Props {
  playerId: string;
  shopItems: ShopItem[];
  ownedItemIds: Set<string>;
}

const TYPE_LABEL: Record<string, string> = {
  TITLE: "🏷 Título",
  BANNER: "🖼 Banner",
  FRAME: "🔵 Moldura",
  ZIKALOOT_TICKET: "🎟 Ticket",
};
const RARITY_COLOR: Record<string, string> = {
  COMMON: "text-slate-400",
  UNCOMMON: "text-[#4ade80]",
  RARE: "text-[#60a5fa]",
  EPIC: "text-[#c084fc]",
  LEGENDARY: "text-[#fb923c]",
  MYTHIC: "text-yellow-400",
  RELIC: "text-red-400",
};
const RARITY_LABEL: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Raro",
  EPIC: "Épico", LEGENDARY: "Lendário", MYTHIC: "Mítico", RELIC: "Relíquia",
};

export function GrantItemPanel({ playerId, shopItems, ownedItemIds }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [qty, setQty] = useState(1);

  const filtered = shopItems.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || i.type === typeFilter;
    return matchSearch && matchType;
  });

  const handleGrant = (item: ShopItem) => {
    if (ownedItemIds.has(item.id)) {
      if (!confirm(`Este jogador já possui "${item.name}". Conceder ${qty}x mesmo assim (vai incrementar quantidade)?`)) return;
    } else {
      if (!confirm(`Conceder ${qty}x "${item.name}" (${RARITY_LABEL[item.rarity] ?? item.rarity} · ${TYPE_LABEL[item.type] ?? item.type}) para este jogador gratuitamente?`)) return;
    }
    startTransition(async () => {
      try {
        const result = await grantItemToPlayer(playerId, item.id, qty);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`${qty}x "${item.name}" concedido com sucesso!`);
        router.refresh();
      } catch { toast.error("Erro ao conceder item."); }
    });
  };

  const typeOpts = ["ALL", "TITLE", "BANNER", "FRAME", "ZIKALOOT_TICKET"];

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gift size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Conceder Item da ZikaShop</h3>
      </div>
      <p className="text-xs text-slate-500">
        Adiciona o item diretamente ao inventário do jogador sem custo de ZikaCoins.
        Se já possuído, incrementa a quantidade.
      </p>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="w-full rounded-lg border border-border bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Quantidade:</label>
          <input
            type="number"
            min={1}
            max={99}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value))))}
            className="w-16 rounded-lg border border-border bg-slate-900 px-2 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] text-center"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {typeOpts.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                typeFilter === t
                  ? "border-[#FFCB05]/50 bg-[#FFCB05]/10 text-[#FFCB05]"
                  : "border-border text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "ALL" ? "Todos" : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-4 text-xs text-slate-600">
          <Package size={14} /> Nenhum item encontrado.
        </div>
      ) : (
        <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map((item) => {
            const owned = ownedItemIds.has(item.id);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-slate-900/40 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                    {item.active === false && (
                      <span className="rounded bg-slate-700/60 px-1 py-0.5 text-[9px] text-slate-500 border border-slate-600/40">inativo</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {TYPE_LABEL[item.type] ?? item.type}
                    <span className={`ml-2 font-semibold ${RARITY_COLOR[item.rarity]}`}>
                      {RARITY_LABEL[item.rarity] ?? item.rarity}
                    </span>
                    {owned && (
                      <span className="ml-2 rounded bg-green-500/10 px-1 py-0.5 text-[9px] text-green-400 border border-green-500/20">
                        já possui
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleGrant(item)}
                  className="shrink-0 h-7 gap-1 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] text-xs px-2"
                >
                  <Plus size={11} /> Conceder {qty > 1 ? `×${qty}` : ""}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
