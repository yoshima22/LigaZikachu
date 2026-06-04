"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, ShoppingCart, Clock, RefreshCw } from "lucide-react";
import { buyMiauvadaoOffer } from "../actions";
import type { MiauvadaoOffer } from "../actions";

// ── Countdown ao vivo ─────────────────────────────────────────────────────────

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
  if (remaining === 0) return <span style={{ color: "#FFCB05" }}>Atualizando…</span>;
  return (
    <span className="flex items-center gap-1">
      <RefreshCw size={9} className="opacity-60" />
      {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

// ── Ícones por tipo — ovos sempre mostram 🥚 ──────────────────────────────────

function ItemIcon({ itemType, imageUrl }: { itemType: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt="" className="max-h-[96px] max-w-full object-contain
        drop-shadow-[0_2px_12px_rgba(201,168,0,0.35)]" />
    );
  }

  // Ovos — todos mostram 🥚, tipo diferenciado apenas pelo label/nome
  if (itemType.startsWith("EGG_") || ["EGG_COMMON","EGG_RARE","EGG_SPECIAL","COMMON","RARE","SPECIAL","EVENT"].includes(itemType)) {
    const tint =
      itemType.includes("RARE")    ? "#6390F0" :
      itemType.includes("SPECIAL") ? "#a855f7" :
      itemType.includes("EVENT")   ? "#FFCB05" :
      "#e2c27a";
    return (
      <span className="text-[72px] leading-none select-none" style={{ filter: `drop-shadow(0 2px 12px ${tint}88)` }}>
        🥚
      </span>
    );
  }

  const ICON: Record<string, string> = {
    MASCOT_FOOD:"🍖", MASCOT_SWEET:"🍬",
    MASCOT_BUFF_EXP:"⚡", MASCOT_BUFF_STAT:"💊",
    MASCOT_BUFF_HAPPY:"🍯", MASCOT_BUFF_LUCK:"🍀", MASCOT_BUFF_MOOD:"💧",
    ZIKALOOT_TICKET:"🎟️",
  };
  const emoji = ICON[itemType] ?? "📦";
  return <span className="text-[72px] leading-none select-none drop-shadow-[0_2px_12px_rgba(255,203,5,0.3)]">{emoji}</span>;
}

// ── Card TCG ──────────────────────────────────────────────────────────────────

const GOLD   = "#c9a800";
const GOLD_D = "#5a4700";
const CARD_BG = "linear-gradient(180deg,#1c1507 0%,#0d0b08 100%)";

function MiauvadaoCard({
  offer, idx, onBuy, pending, buying, balance,
}: {
  offer: MiauvadaoOffer;
  idx: number;
  onBuy: (i: number) => void;
  pending: boolean;
  buying: boolean;
  balance: number;
}) {
  const soldOut = offer.sold >= offer.stock;
  const expired = new Date() > new Date(offer.validUntil);
  const canBuy  = !soldOut && !expired && balance >= offer.finalPrice;
  const dimmed  = soldOut || expired;

  return (
    <div className={`relative flex flex-col select-none transition-opacity ${dimmed ? "opacity-50 grayscale" : ""}`}>

      {/* ── Frame principal ─── */}
      <div
        className="relative flex flex-col"
        style={{
          background: CARD_BG,
          borderRadius: 14,
          /* Borda dupla: 3px gold + 1px escura dentro */
          boxShadow: `0 0 0 3px ${GOLD}, 0 0 0 5px ${GOLD_D}, inset 0 0 0 2px ${GOLD_D}80`,
          overflow: "hidden",
        }}
      >
        {/* Orelhinhas (tabs no topo) */}
        {[8, undefined].map((left, i) => (
          <div key={i} className="absolute -top-[6px]" style={{ [i === 0 ? "left" : "right"]: 12 }}>
            <div style={{
              width: 16, height: 8,
              background: GOLD,
              borderRadius: "3px 3px 0 0",
              boxShadow: `0 0 0 2px ${GOLD_D}`,
            }} />
          </div>
        ))}

        {/* ── Área do item (conteúdo) ── */}
        <div className="relative flex flex-col items-center justify-center"
          style={{ minHeight: 180, padding: "28px 20px 20px" }}>

          {/* ⚡ cantos — DENTRO da área de conteúdo, não sobrepondo preço */}
          <span className="absolute top-2 left-2 text-[11px] leading-none" style={{ color: GOLD }}>⚡</span>
          <span className="absolute top-2 right-2 text-[11px] leading-none" style={{ color: GOLD }}>⚡</span>
          <span className="absolute bottom-2 left-2 text-[11px] leading-none" style={{ color: GOLD }}>⚡</span>
          <span className="absolute bottom-2 right-2 text-[11px] leading-none" style={{ color: GOLD }}>⚡</span>

          {/* Badge desconto */}
          <div className="absolute top-2 right-8 z-10 rounded-full bg-red-600 px-2 py-0.5
            text-[10px] font-black text-white shadow-lg leading-none">
            -{offer.discountPct}%
          </div>

          {/* Ícone do item */}
          <ItemIcon itemType={offer.itemType} imageUrl={offer.imageUrl} />
        </div>

        {/* ── "ITEM EM PROMOÇÃO" banner ── */}
        <div style={{
          background: "#2a1a03",
          borderTop: `2px solid ${GOLD}`,
          borderBottom: `2px solid ${GOLD}`,
          padding: "7px 8px",
          textAlign: "center",
        }}>
          <p style={{
            fontSize: 11,
            fontWeight: 900,
            color: GOLD,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {dimmed ? (soldOut ? "ESGOTADO" : "EXPIRADO") : offer.name}
          </p>
          {offer.description && !dimmed && (
            <p style={{ fontSize: 9, color: "#8b6c00", marginTop: 2, lineHeight: 1.3,
              overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const }}>
              {offer.description}
            </p>
          )}
          <p style={{ fontSize: 9, color: GOLD_D, marginTop: 3 }}>
            {offer.sold}/{offer.stock} vendidos
          </p>
        </div>

        {/* ── Área de preço + botão (SEM ícones absolutos sobrepostos) ── */}
        <div style={{ background: "#0d0b08", borderRadius: "0 0 11px 11px", padding: "8px 12px 10px" }}
          className="space-y-2">
          {/* Preço: original riscado → final */}
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 11, color: "#5a4700", textDecoration: "line-through" }}>
              {offer.originalPrice.toLocaleString("pt-BR")} ZC
            </span>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#FFCB05",
              textShadow: "0 0 8px rgba(255,203,5,0.4)" }}>
              {offer.finalPrice.toLocaleString("pt-BR")} ZC
            </span>
          </div>

          {/* Botão comprar */}
          <button
            type="button"
            disabled={pending || !canBuy}
            onClick={() => onBuy(idx)}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 font-bold
              transition-all disabled:cursor-not-allowed"
            style={{
              fontSize: 12,
              background: canBuy ? GOLD : "#2a1a03",
              color: canBuy ? "#1a1209" : GOLD_D,
              boxShadow: canBuy ? "0 0 0 1px #5a4700" : "none",
            }}
          >
            {soldOut   ? "Esgotado"  :
             expired   ? <><Clock size={10} /> Expirado</> :
             buying && pending ? "Comprando…" :
             <><ShoppingCart size={11} /> Comprar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface Props {
  offers: MiauvadaoOffer[];
  vaultBalance: number;
  balance: number;
  playerId: string | null;
  offersRefreshedAt?: string | null;
}

export function MiauvadaoPanel({ offers, vaultBalance, balance, playerId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buyingIdx, setBuyingIdx] = useState<number | null>(null);

  const handleBuy = (idx: number) => {
    const offer = offers[idx];
    if (!offer) return;
    if (!playerId) { toast.error("Faça login para comprar."); return; }
    if (!confirm(`Comprar "${offer.name}" por ${offer.finalPrice.toLocaleString("pt-BR")} ZC?`)) return;
    setBuyingIdx(idx);
    startTransition(async () => {
      const r = await buyMiauvadaoOffer(idx);
      if (r.error) toast.error(r.error);
      else { toast.success(`"${offer.name}" adicionado ao inventário! 🎉`); router.refresh(); }
      setBuyingIdx(null);
    });
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg,#1a1105 0%,#0e0c06 60%,#1a1105 100%)",
        boxShadow: `0 0 0 1px ${GOLD_D}`,
      }}
    >
      {/* Gato NPC à esquerda (usa /miauvadao-cat.png se existir) */}
      <div className="pointer-events-none absolute -left-2 bottom-0 z-10 hidden md:block"
        style={{ width: 190, height: "calc(100% + 8px)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/miauvadao-cat.png" alt="" className="h-full w-full object-contain object-bottom"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>

      {/* Conteúdo (recuado para o gato em desktop) */}
      <div className="md:ml-44 lg:ml-48 px-5 pt-5 pb-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Banner ornamentado */}
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-2.5"
            style={{
              background: "#1e1608",
              border: `2px solid ${GOLD}`,
              boxShadow: `0 0 0 1px ${GOLD_D}, 0 0 16px rgba(201,168,0,0.15)`,
            }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl"
              style={{ background: "#2a1a03", border: `2px solid ${GOLD}` }}>
              🐱
            </div>
            <h2 className="font-pixel text-base flex items-center gap-1.5"
              style={{ color: "#FFCB05", textShadow: "0 0 10px rgba(255,203,5,0.5)" }}>
              Ofertas do Miauvadão
              <Zap size={13} className="fill-[#FFCB05] text-[#FFCB05]" />
            </h2>
          </div>

          {/* Info: cofre + timer */}
          <div className="flex flex-col items-end gap-0.5 text-[10px]" style={{ color: GOLD_D }}>
            <span>
              Cofre:{" "}
              <strong style={{ color: "#FFCB05" }}>
                {vaultBalance.toLocaleString("pt-BR")} ZC
              </strong>
            </span>
            {offers[0]?.validUntil && (
              <span style={{ color: GOLD_D }}>
                <RefreshCountdown validUntil={offers[0].validUntil} />
              </span>
            )}
          </div>
        </div>

        {/* ── 3 Cards ── */}
        {offers.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-3xl">😿</p>
            <p className="text-sm" style={{ color: GOLD_D }}>
              O Miauvadão ainda não abriu as ofertas de hoje.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-3 pt-1">
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

        <p className="text-center text-[10px]" style={{ color: "#3a2c00" }}>
          As taxas do Bazar alimentam o cofre do Miauvadão e financiam os descontos.
        </p>
      </div>
    </div>
  );
}
