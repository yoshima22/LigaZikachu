"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, ShoppingCart, Clock, RefreshCw } from "lucide-react";
import { buyMiauvadaoOffer } from "../actions";
import type { MiauvadaoOffer } from "../actions";

// ── Countdown ─────────────────────────────────────────────────────────────────

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
      <RefreshCw size={9} className="opacity-60" />
      {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

// ── Emoji por tipo ────────────────────────────────────────────────────────────

const ITEM_EMOJI: Record<string, string> = {
  EGG_COMMON:"🥚", EGG_RARE:"💙", EGG_SPECIAL:"💜",
  EGG_GEN1:"1️⃣", EGG_GEN2:"2️⃣", EGG_GEN3:"3️⃣", EGG_GEN4:"4️⃣", EGG_GEN5:"5️⃣",
  EGG_GEN6:"6️⃣", EGG_GEN7:"7️⃣", EGG_GEN8:"8️⃣", EGG_GEN9:"9️⃣",
  MASCOT_FOOD:"🍖", MASCOT_SWEET:"🍬",
  MASCOT_BUFF_EXP:"⚡", MASCOT_BUFF_STAT:"💊",
  MASCOT_BUFF_HAPPY:"🍯", MASCOT_BUFF_LUCK:"🍀", MASCOT_BUFF_MOOD:"💧",
  ZIKALOOT_TICKET:"🎟️",
};

// ── Card TCG individual ───────────────────────────────────────────────────────

function MiauvadaoCard({
  offer, idx, onBuy, pending, buying, balance,
}: {
  offer: MiauvadaoOffer;
  idx: number;
  onBuy: (idx: number) => void;
  pending: boolean;
  buying: boolean;
  balance: number;
}) {
  const soldOut  = offer.sold >= offer.stock;
  const expired  = new Date() > new Date(offer.validUntil);
  const canBuy   = !soldOut && !expired && balance >= offer.finalPrice;
  const emoji    = ITEM_EMOJI[offer.itemType] ?? "📦";
  const unavailable = soldOut || expired;

  return (
    <div className={`relative flex flex-col transition-opacity ${unavailable ? "opacity-50 grayscale" : ""}`}>

      {/* ── Outer gold frame ─────────────────────────────────────────── */}
      <div
        className="relative flex flex-col rounded-2xl overflow-visible"
        style={{
          background: "linear-gradient(180deg, #1c1507 0%, #0d0b08 100%)",
          boxShadow: "0 0 0 3px #c9a800, 0 0 0 5px #5a4700, inset 0 0 0 2px #5a4700",
          borderRadius: "14px",
        }}
      >
        {/* Top ears / tabs */}
        <div className="absolute -top-[7px] left-5">
          <div style={{ width: 14, height: 8, background: "#c9a800", borderRadius: "3px 3px 0 0",
            boxShadow: "0 0 0 2px #5a4700" }} />
        </div>
        <div className="absolute -top-[7px] right-5">
          <div style={{ width: 14, height: 8, background: "#c9a800", borderRadius: "3px 3px 0 0",
            boxShadow: "0 0 0 2px #5a4700" }} />
        </div>

        {/* Corner lightning bolts */}
        <span className="absolute top-2 left-2 text-[#c9a800] text-[11px] leading-none select-none">⚡</span>
        <span className="absolute top-2 right-2 text-[#c9a800] text-[11px] leading-none select-none">⚡</span>

        {/* Item area */}
        <div className="relative flex flex-col items-center justify-center py-8 px-4 min-h-[160px]">
          {/* Discount badge */}
          <div className="absolute top-2 right-3 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-lg z-10">
            -{offer.discountPct}%
          </div>

          {offer.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offer.imageUrl} alt={offer.name}
              className="max-h-[100px] max-w-full object-contain drop-shadow-[0_2px_8px_rgba(201,168,0,0.3)]" />
          ) : (
            <span className="text-6xl drop-shadow-[0_2px_8px_rgba(201,168,0,0.3)]">{emoji}</span>
          )}
        </div>

        {/* ── ITEM EM PROMOÇÃO banner ──────────────────────────────── */}
        <div
          style={{
            background: "#2a1a03",
            borderTop: "2px solid #c9a800",
            borderBottom: "2px solid #c9a800",
          }}
          className="px-2 py-2 text-center"
        >
          <p className="text-[11px] font-black text-[#c9a800] uppercase tracking-[0.12em] leading-tight truncate">
            {unavailable ? (soldOut ? "ESGOTADO" : "EXPIRADO") : offer.name}
          </p>
          <p className="text-[9px] text-[#8b6c00] mt-0.5">{offer.sold}/{offer.stock} vendidos</p>
        </div>

        {/* Bottom corner lightning */}
        <span className="absolute bottom-[52px] left-2 text-[#c9a800] text-[11px] leading-none select-none">⚡</span>
        <span className="absolute bottom-[52px] right-2 text-[#c9a800] text-[11px] leading-none select-none">⚡</span>

        {/* ── Price + buy area ─────────────────────────────────────── */}
        <div className="px-3 pt-2 pb-3 space-y-2" style={{ background: "#0d0b08", borderRadius: "0 0 11px 11px" }}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#5a4700] line-through">{offer.originalPrice.toLocaleString("pt-BR")} ZC</span>
            <span className="font-black text-[#FFCB05] text-sm">{offer.finalPrice.toLocaleString("pt-BR")} ZC</span>
          </div>
          <button
            type="button"
            disabled={pending || !canBuy}
            onClick={() => onBuy(idx)}
            className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold transition-all disabled:cursor-not-allowed ${
              canBuy
                ? "bg-[#FFCB05] text-[#1a1209] hover:bg-[#FFD700] hover:shadow-[0_0_8px_rgba(255,203,5,0.5)]"
                : "bg-[#2a1f04] text-[#5a4700]"
            }`}
          >
            {soldOut ? "Esgotado" : expired ? <><Clock size={10}/> Expirado</> :
             buying && pending ? "Comprando…" : <><ShoppingCart size={10}/> Comprar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel principal ───────────────────────────────────────────────────────────

interface Props {
  offers: MiauvadaoOffer[];
  vaultBalance: number;
  balance: number;
  playerId: string | null;
  offersRefreshedAt?: string | null;
}

export function MiauvadaoPanel({ offers, vaultBalance, balance, playerId, offersRefreshedAt: _ }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buyingIdx, setBuyingIdx] = useState<number | null>(null);

  const handleBuy = (idx: number) => {
    const offer = offers[idx];
    if (!offer) return;
    if (!playerId) { toast.error("Faça login para comprar."); return; }
    if (!confirm(`Comprar "${offer.name}" por ${offer.finalPrice} ZC?`)) return;
    setBuyingIdx(idx);
    startTransition(async () => {
      const r = await buyMiauvadaoOffer(idx);
      if (r.error) toast.error(r.error);
      else { toast.success(`"${offer.name}" adicionado ao inventário!`); router.refresh(); }
      setBuyingIdx(null);
    });
  };

  return (
    /* Wrapper com fundo escuro dourado */
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg, #1a1105 0%, #0e0c06 50%, #1a1105 100%)",
        boxShadow: "0 0 0 1px #5a4700",
      }}
    >
      {/* ── Gato NPC (posicionado à esquerda, sobressai do container) ── */}
      <div
        className="pointer-events-none absolute -left-2 -bottom-2 z-10 hidden md:block"
        style={{ width: 180, height: "calc(100% + 16px)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/miauvadao-cat.png"
          alt="Miauvadão"
          className="h-full w-full object-contain object-bottom select-none"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      {/* ── Conteúdo principal (deslocado à direita para o gato) ──────── */}
      <div className="md:ml-40 lg:ml-44 px-4 pt-4 pb-5 space-y-4">

        {/* ── Banner título ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-2"
            style={{
              background: "#1e1608",
              border: "2px solid #c9a800",
              boxShadow: "0 0 0 1px #5a4700, inset 0 0 12px rgba(201,168,0,0.08)",
            }}
          >
            {/* Avatar do Miauvadão */}
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ background: "#2a1a03", border: "2px solid #c9a800" }}
            >
              🐱
            </div>
            <div>
              <h2
                className="font-pixel text-sm flex items-center gap-1.5"
                style={{ color: "#FFCB05", textShadow: "0 0 8px rgba(255,203,5,0.4)" }}
              >
                Ofertas do Miauvadão
                <Zap size={12} className="fill-[#FFCB05] text-[#FFCB05]" />
              </h2>
            </div>
          </div>

          {/* Cofre + countdown */}
          <div className="flex items-center gap-3 text-[10px]" style={{ color: "#8b6c00" }}>
            <span>
              Cofre:{" "}
              <span style={{ color: "#FFCB05" }} className="font-semibold">
                {vaultBalance.toLocaleString("pt-BR")} ZC
              </span>
            </span>
            {offers[0]?.validUntil && (
              <span className="flex items-center gap-1" style={{ color: "#8b6c00" }}>
                <RefreshCountdown validUntil={offers[0].validUntil} />
              </span>
            )}
          </div>
        </div>

        {/* ── 3 cards ───────────────────────────────────────────────── */}
        {offers.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-3xl">😿</p>
            <p className="text-sm" style={{ color: "#5a4700" }}>
              O Miauvadão ainda não definiu as ofertas de hoje.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3 pt-2">
            {offers.map((offer, idx) => (
              <MiauvadaoCard
                key={idx}
                offer={offer}
                idx={idx}
                onBuy={handleBuy}
                pending={pending}
                buying={buyingIdx === idx}
                balance={balance}
              />
            ))}
          </div>
        )}

        {/* Rodapé */}
        <p className="text-center text-[10px]" style={{ color: "#4a3800" }}>
          As taxas do Bazar alimentam o cofre do Miauvadão e financiam os descontos.
        </p>
      </div>
    </div>
  );
}
