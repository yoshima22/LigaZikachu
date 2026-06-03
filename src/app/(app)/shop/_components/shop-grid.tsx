"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, Coins, Lock, ShoppingCart, ZoomIn, X } from "lucide-react";
import { purchaseItem } from "../actions";
import { TitleDisplay } from "@/components/ui/title-display";
import type { TitleRarity, TitleTheme } from "@/components/ui/title-display";

const rarityColors: Record<string, string> = {
  COMMON:    "border-slate-600/50 text-slate-400",
  UNCOMMON:  "border-[#7AC74C]/40 text-[#7AC74C]",
  RARE:      "border-[#6390F0]/40 text-[#6390F0]",
  EPIC:      "border-[#735797]/40 text-[#735797]",
  LEGENDARY: "border-[#FFCB05]/40 text-[#FFCB05]",
  MYTHIC:    "border-yellow-400/50 text-yellow-400",
  RELIC:     "border-red-500/50 text-red-400",
};
const rarityLabel: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Raro", EPIC: "Épico",
  LEGENDARY: "Lendário", MYTHIC: "Mítico", RELIC: "Relíquia",
};

interface Item {
  id: string;
  type: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  rarity: string;
  price: number;
  theme?: string;
  flavorText?: string | null;
  entranceEffect?: string;
}

interface Props {
  title: string;
  items: Item[];
  ownedIds: Set<string>;
  inventoryCounts: Record<string, number>;
  balance: number;
  playerId: string | null;
}

const consumableTypes = new Set(["ZIKALOOT_TICKET", "EGG_COMMON", "EGG_RARE", "EGG_SPECIAL", "MASCOT_FOOD", "MASCOT_SWEET"]);

export function ShopGrid({ title, items, ownedIds, inventoryCounts, balance, playerId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buyingId, setBuyingId]   = useState<string | null>(null);
  const [lightbox, setLightbox]   = useState<{ src: string; name: string; type: string } | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Fecha ao pressionar Esc
  const closeLightbox = useCallback(() => setLightbox(null), []);
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, closeLightbox]);

  const getQuantity = (itemId: string) => quantities[itemId] ?? 1;

  const setQuantity = (itemId: string, quantity: number) => {
    const next = Math.min(99, Math.max(1, Math.floor(quantity || 1)));
    setQuantities((current) => ({ ...current, [itemId]: next }));
  };

  const handleBuy = (itemId: string, price: number, name: string, quantity: number) => {
    const totalPrice = price * quantity;
    if (!playerId) { toast.error("Faça login com uma conta de jogador."); return; }
    if (balance < totalPrice) { toast.error(`Saldo insuficiente. Você tem ${balance} ZC.`); return; }
    if (!confirm(`Comprar ${quantity}x "${name}" por ${totalPrice} ZikaCoins?`)) return;

    setBuyingId(itemId);
    startTransition(async () => {
      try {
        const result = await purchaseItem({ itemId, quantity });
        if (result.error) { toast.error(result.error); return; }
        toast.success(quantity > 1
          ? `${quantity}x "${name}" adicionados ao seu inventário!`
          : `"${name}" adicionado ao seu inventário!`
        );
        router.refresh();
      } catch { toast.error("Erro ao comprar item."); }
      finally { setBuyingId(null); }
    });
  };

  return (
    <>
    {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
    {lightbox && (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
        onClick={closeLightbox}
      >
        <div
          className="relative max-h-[90vh] max-w-[90vw] rounded-2xl overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.name}
            className={`block max-h-[85vh] max-w-[88vw] ${
              lightbox.type === "BANNER" ? "w-full object-cover" : "object-contain"
            }`}
            style={{ background: lightbox.type === "FRAME" ? "transparent" : undefined }}
          />
          <button
            onClick={closeLightbox}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-6">
            <p className="text-sm font-semibold text-white">{lightbox.name}</p>
            <p className="text-[10px] text-slate-400">Clique fora ou pressione Esc para fechar</p>
          </div>
        </div>
      </div>
    )}

    <div className="space-y-3">
      <h2 className="font-semibold text-slate-200">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item, itemIndex) => {
          const owned = ownedIds.has(item.id);
          const isConsumable = consumableTypes.has(item.type);
          const quantity = isConsumable ? getQuantity(item.id) : 1;
          const totalPrice = item.price * quantity;
          const canAfford = balance >= totalPrice;
          const isBuying = buyingId === item.id && pending;
          const ownedCount = inventoryCounts[item.id] ?? 0;

          return (
            <div
              key={item.id}
              className={`relative rounded-xl border bg-slate-950/60 overflow-hidden transition-all ${
                owned ? "border-[#7AC74C]/40" : rarityColors[item.rarity]?.split(" ")[0] ?? "border-border"
              }`}
            >
              {/* Preview image / banner — clicável para ampliar */}
              {item.imageUrl ? (
                item.type === "BANNER" ? (
                  <div
                    className="group relative aspect-[3/1] w-full overflow-hidden cursor-zoom-in"
                    onClick={() => setLightbox({ src: item.imageUrl!, name: item.name, type: item.type })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <ZoomIn size={24} className="text-white drop-shadow" />
                    </div>
                  </div>
                ) : (
                  <div
                    className="group relative flex h-24 items-center justify-center bg-slate-900 cursor-zoom-in"
                    onClick={() => setLightbox({ src: item.imageUrl!, name: item.name, type: item.type })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imageUrl} alt={item.name} className="max-h-20 object-contain transition-transform group-hover:scale-110" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-t-xl">
                      <ZoomIn size={20} className="text-white drop-shadow" />
                    </div>
                  </div>
                )
              ) : item.type === "TITLE" ? (
                <div className="flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900/80 to-slate-800 px-4 py-5 min-h-[72px]">
                  <TitleDisplay
                    name={item.name}
                    rarity={item.rarity as TitleRarity}
                    theme={(item.theme ?? "NEUTRAL") as TitleTheme}
                    flavorText={item.flavorText ?? null}
                    context="inventory"
                    staggerDelay={itemIndex * 120}
                  />
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
                {(isConsumable || ownedCount > 0) && (
                  <div className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    Inventário: <span className="text-[#FFCB05]">{ownedCount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="flex items-center gap-1 text-sm font-bold text-[#FFCB05]">
                    <Coins size={14} /> {totalPrice.toLocaleString("pt-BR")} ZC
                  </span>
                  {owned ? (
                    <span className="flex items-center gap-1 rounded-lg bg-[#7AC74C]/10 px-2 py-1 text-xs font-semibold text-[#7AC74C]">
                      <CheckCircle size={12} /> Possuído
                    </span>
                  ) : !canAfford ? (
                    <div className="flex items-center gap-1.5">
                      {isConsumable && (
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={quantity}
                          onChange={(event) => setQuantity(item.id, Number(event.target.value))}
                          className="h-7 w-14 rounded-lg border border-border bg-slate-950 px-2 text-center text-xs text-slate-100 outline-none focus:border-[#FFCB05]/60"
                          aria-label={`Quantidade de ${item.name}`}
                        />
                      )}
                      <span className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-500">
                        <Lock size={12} /> Sem saldo
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                    {isConsumable && (
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={quantity}
                        onChange={(event) => setQuantity(item.id, Number(event.target.value))}
                        className="h-7 w-14 rounded-lg border border-border bg-slate-950 px-2 text-center text-xs text-slate-100 outline-none focus:border-[#FFCB05]/60"
                        aria-label={`Quantidade de ${item.name}`}
                      />
                    )}
                    <button
                      type="button"
                      disabled={isBuying}
                      onClick={() => handleBuy(item.id, item.price, item.name, quantity)}
                      className="flex items-center gap-1 rounded-lg bg-[#FFCB05] px-3 py-1 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-60"
                    >
                      <ShoppingCart size={12} />
                      {isBuying ? "Comprando…" : "Comprar"}
                    </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
