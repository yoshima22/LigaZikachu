"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle, Coins, Lock, ShoppingCart } from "lucide-react";
import { purchaseItem } from "../actions";

const rarityColors: Record<string, string> = {
  COMMON:    "border-slate-600/50 text-slate-400",
  UNCOMMON:  "border-[#7AC74C]/40 text-[#7AC74C]",
  RARE:      "border-[#6390F0]/40 text-[#6390F0]",
  EPIC:      "border-[#735797]/40 text-[#735797]",
  LEGENDARY: "border-[#FFCB05]/40 text-[#FFCB05]"
};
const rarityLabel: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Rara", EPIC: "Épica", LEGENDARY: "Lendária"
};

interface Item {
  id: string;
  type: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: string;
  price: number;
}

interface Props {
  title: string;
  items: Item[];
  ownedIds: Set<string>;
  balance: number;
  playerId: string | null;
}

export function ShopGrid({ title, items, ownedIds, balance, playerId }: Props) {
  const [pending, startTransition] = useTransition();
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const handleBuy = (itemId: string, price: number, name: string) => {
    if (!playerId) { toast.error("Faça login com uma conta de jogador."); return; }
    if (balance < price) { toast.error(`Saldo insuficiente. Você tem ${balance} ZC.`); return; }
    if (!confirm(`Comprar "${name}" por ${price} ZikaCoins?`)) return;

    setBuyingId(itemId);
    startTransition(async () => {
      try {
        const result = await purchaseItem(itemId);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`"${name}" adicionado ao seu inventário!`);
      } catch { toast.error("Erro ao comprar item."); }
      finally { setBuyingId(null); }
    });
  };

  return (
    <div className="space-y-3">
      <h2 className="font-semibold text-slate-200">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => {
          const owned = ownedIds.has(item.id);
          const canAfford = balance >= item.price;
          const isBuying = buyingId === item.id && pending;

          return (
            <div
              key={item.id}
              className={`relative rounded-xl border bg-slate-950/60 overflow-hidden transition-all ${
                owned ? "border-[#7AC74C]/40" : rarityColors[item.rarity]?.split(" ")[0] ?? "border-border"
              }`}
            >
              {/* Preview image / banner */}
              {item.imageUrl ? (
                item.type === "BANNER" ? (
                  <div className="aspect-[3/1] w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-center bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt={item.name} className="max-h-20 object-contain" />
                  </div>
                )
              ) : item.type === "TITLE" ? (
                <div className="flex h-16 items-center justify-center bg-gradient-to-r from-slate-900 to-slate-800 px-4">
                  <p className="font-pixel text-xs text-[#FFCB05] text-center">{item.name}</p>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center bg-slate-900 text-slate-600 text-xs">
                  Sem preview
                </div>
              )}

              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-white text-sm leading-tight">{item.name}</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rarityColors[item.rarity]}`}>
                    {rarityLabel[item.rarity]}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-slate-400">{item.description}</p>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1 text-sm font-bold text-[#FFCB05]">
                    <Coins size={14} /> {item.price.toLocaleString("pt-BR")} ZC
                  </span>
                  {owned ? (
                    <span className="flex items-center gap-1 rounded-lg bg-[#7AC74C]/10 px-2 py-1 text-xs font-semibold text-[#7AC74C]">
                      <CheckCircle size={12} /> Possuído
                    </span>
                  ) : !canAfford ? (
                    <span className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-500">
                      <Lock size={12} /> Sem saldo
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isBuying}
                      onClick={() => handleBuy(item.id, item.price, item.name)}
                      className="flex items-center gap-1 rounded-lg bg-[#FFCB05] px-3 py-1 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60"
                    >
                      <ShoppingCart size={12} />
                      {isBuying ? "Comprando…" : "Comprar"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
