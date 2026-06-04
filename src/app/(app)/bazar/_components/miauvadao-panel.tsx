"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, ShoppingCart, Clock, RefreshCw } from "lucide-react";
import { buyMiauvadaoOffer } from "../actions";
import type { MiauvadaoOffer } from "../actions";

function RefreshCountdown({ validUntil }: { validUntil: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const target = new Date(validUntil).getTime();
    const update = () => setRemaining(Math.max(0, target - Date.now()));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [validUntil]);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);

  if (remaining === 0) return <span className="text-[#FFCB05]">Atualizando…</span>;
  return (
    <span className="flex items-center gap-1">
      <RefreshCw size={9} className="opacity-60"/>
      {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

const ITEM_EMOJI: Record<string, string> = {
  EGG_COMMON: "🥚", EGG_RARE: "💙", EGG_SPECIAL: "💜",
  EGG_GEN1: "1️⃣", EGG_GEN2: "2️⃣", EGG_GEN3: "3️⃣",
  EGG_GEN4: "4️⃣", EGG_GEN5: "5️⃣", EGG_GEN6: "6️⃣",
  EGG_GEN7: "7️⃣", EGG_GEN8: "8️⃣", EGG_GEN9: "9️⃣",
  MASCOT_FOOD: "🍖", MASCOT_SWEET: "🍬",
  MASCOT_BUFF_EXP: "⚡", MASCOT_BUFF_STAT: "💊",
  MASCOT_BUFF_HAPPY: "🍯", MASCOT_BUFF_LUCK: "🍀", MASCOT_BUFF_MOOD: "💧",
  ZIKALOOT_TICKET: "🎟️",
};

interface Props {
  offers: MiauvadaoOffer[];
  vaultBalance: number;
  balance: number;
  playerId: string | null;
  offersRefreshedAt?: string | null;
}

export function MiauvadaoPanel({ offers, vaultBalance, balance, playerId, offersRefreshedAt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buyingIdx, setBuyingIdx] = useState<number | null>(null);

  const handleBuy = (idx: number, offer: MiauvadaoOffer) => {
    if (!playerId) { toast.error("Faça login para comprar."); return; }
    if (!confirm(`Comprar "${offer.name}" por ${offer.finalPrice} ZC?`)) return;
    setBuyingIdx(idx);
    startTransition(async () => {
      const r = await buyMiauvadaoOffer(idx);
      if (r.error) toast.error(r.error);
      else { toast.success(`"${offer.name}" adicionado ao seu inventário!`); router.refresh(); }
      setBuyingIdx(null);
    });
  };

  return (
    <div className="rounded-2xl border border-[#FFCB05]/20 bg-gradient-to-br from-[#1a1410] via-[#1e1a0e] to-[#1a1410] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#FFCB05]/20 bg-[#FFCB05]/5 px-5 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#FFCB05]/60 bg-[#1a1410] text-lg shrink-0">
          🐱
        </div>
        <div>
          <h2 className="font-pixel text-sm text-[#FFCB05] flex items-center gap-1.5">
            Ofertas do Miauvadão <Zap size={13} className="fill-[#FFCB05] text-[#FFCB05]" />
          </h2>
          <p className="text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
            <span>Cofre: <span className="text-[#FFCB05] font-semibold">{vaultBalance.toLocaleString("pt-BR")} ZC</span></span>
            <span>·</span>
            {offers[0]?.validUntil
              ? <RefreshCountdown validUntil={offers[0].validUntil} />
              : <span>Atualiza diariamente</span>
            }
          </p>
        </div>
      </div>

      {/* 3 card slots */}
      <div className="p-4 grid gap-4 sm:grid-cols-3">
        {offers.length === 0 ? (
          <div className="col-span-3 py-10 text-center space-y-2">
            <p className="text-2xl">😿</p>
            <p className="text-sm text-slate-500">O Miauvadão ainda não definiu as ofertas de hoje.</p>
          </div>
        ) : (
          offers.map((offer, idx) => {
            const isSoldOut = offer.sold >= offer.stock;
            const canBuy = !isSoldOut && balance >= offer.finalPrice;
            const emoji = ITEM_EMOJI[offer.itemType] ?? "📦";
            const isExpired = new Date() > new Date(offer.validUntil);

            return (
              <div key={idx} className={`relative flex flex-col rounded-xl overflow-hidden border-2 transition-all ${
                isSoldOut || isExpired
                  ? "border-slate-700/40 opacity-50 grayscale"
                  : "border-[#FFCB05]/40 hover:border-[#FFCB05]/70"
              }`}>
                {/* Corner bolts */}
                <div className="absolute top-1 left-1 text-[#FFCB05]/40 text-[10px]">⚡</div>
                <div className="absolute top-1 right-1 text-[#FFCB05]/40 text-[10px]">⚡</div>

                {/* Card body */}
                <div className="flex flex-col items-center justify-center bg-[#0d0b08] py-8 gap-3 relative">
                  {offer.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={offer.imageUrl} alt={offer.name} className="h-20 object-contain" />
                  ) : (
                    <span className="text-6xl">{emoji}</span>
                  )}
                  {/* Desconto badge */}
                  <div className="absolute top-2 right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    -{offer.discountPct}%
                  </div>
                </div>

                {/* Item name banner */}
                <div className="bg-[#1a1410] border-t border-[#FFCB05]/30 px-2 py-1.5 text-center">
                  <p className="text-[11px] font-bold text-[#FFCB05] uppercase tracking-wide truncate">{offer.name}</p>
                  <p className="text-[9px] text-slate-500">
                    {offer.sold}/{offer.stock} vendidos
                  </p>
                </div>

                {/* Price + buy */}
                <div className="bg-[#100e08] border-t border-[#FFCB05]/20 p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 line-through">{offer.originalPrice} ZC</span>
                    <span className="font-bold text-[#FFCB05]">{offer.finalPrice} ZC</span>
                  </div>
                  <button
                    type="button"
                    disabled={pending || !canBuy || isExpired || isSoldOut}
                    onClick={() => handleBuy(idx, offer)}
                    className={`w-full flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      canBuy && !isExpired && !isSoldOut
                        ? "bg-[#FFCB05] text-[#1a1410] hover:bg-[#FFD700]"
                        : "bg-slate-800 text-slate-500"
                    }`}
                  >
                    {isSoldOut ? (
                      "Esgotado"
                    ) : isExpired ? (
                      <><Clock size={10}/> Expirado</>
                    ) : buyingIdx === idx && pending ? (
                      "Comprando…"
                    ) : (
                      <><ShoppingCart size={10}/> Comprar</>
                    )}
                  </button>
                </div>

                {/* Bottom corner bolts */}
                <div className="absolute bottom-16 left-1 text-[#FFCB05]/40 text-[10px]">⚡</div>
                <div className="absolute bottom-16 right-1 text-[#FFCB05]/40 text-[10px]">⚡</div>
              </div>
            );
          })
        )}
      </div>

      <p className="pb-3 text-center text-[10px] text-slate-600">
        As taxas do Bazar alimentam o cofre do Miauvadão e financiam os descontos.
      </p>
    </div>
  );
}
