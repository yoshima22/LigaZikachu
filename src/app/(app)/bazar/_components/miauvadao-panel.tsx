"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, ShoppingCart, Clock, RefreshCw } from "lucide-react";
import { buyMiauvadaoOffer, refreshMiauvadaoShopNow } from "../actions";
import type { MiauvadaoOffer } from "../actions";

// ── Countdown ─────────────────────────────────────────────────────────────────

function RefreshCountdown({ validUntil }: { validUntil: string }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const target = new Date(validUntil).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [validUntil]);

  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  if (remaining === 0) return <span style={{ color: "#FFCB05" }}>Atualizando…</span>;
  return (
    <span className="flex items-center gap-1">
      <RefreshCw size={9} />
      {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

// ── Ícone/imagem do item — espelha exatamente o que a ZikaShop usa ────────────

function ItemDisplay({ itemType, imageUrl }: { itemType: string; imageUrl?: string }) {
  // 1. Imagem definida no cadastro do shop
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageUrl} alt=""
        className="max-h-[100px] max-w-[90%] object-contain
          drop-shadow-[0_2px_12px_rgba(201,168,0,0.4)]" />
    );
  }

  // 2. Ovos — mesmos arquivos estáticos da ZikaShop
  if (itemType === "EGG_RARE"    || itemType === "RARE")    return <EggImg src="/mascot/egg-rare.png" />;
  if (itemType === "EGG_SPECIAL" || itemType === "SPECIAL") return <EggImg src="/mascot/egg-special.png" />;
  if (itemType.startsWith("EGG_") || itemType === "COMMON" || itemType === "EVENT")
    return <EggImg src="/mascot/egg-common.png" />;

  // 3. Buffs e comidas — emojis grandes (igual à ZikaShop)
  const EMOJI: Record<string, string> = {
    MASCOT_FOOD:"🍖", MASCOT_SWEET:"🍬",
    MASCOT_BUFF_EXP:"⚡", MASCOT_BUFF_STAT:"💊",
    MASCOT_BUFF_HAPPY:"🍯", MASCOT_BUFF_LUCK:"🍀", MASCOT_BUFF_MOOD:"💧",
    ZIKALOOT_TICKET:"🎟️",
  };
  const emoji = EMOJI[itemType] ?? "📦";
  return (
    <span className="text-[72px] leading-none select-none
      drop-shadow-[0_2px_12px_rgba(255,203,5,0.3)]">
      {emoji}
    </span>
  );
}

function EggImg({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt=""
      className="h-[88px] object-contain
        drop-shadow-[0_2px_14px_rgba(201,168,0,0.45)]"
      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ── RefreshShopButton ─────────────────────────────────────────────────────────

function RefreshShopButton({ playerId }: { playerId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (!playerId) return null;
  return (
    <button type="button" disabled={pending}
      onClick={() => {
        if (!confirm("Pagar 80 ZC para atualizar as ofertas agora com descontos melhores?")) return;
        startTransition(async () => {
          const r = await refreshMiauvadaoShopNow();
          if (r.error) { toast.error(r.error); return; }
          toast.success("Ofertas atualizadas! Descontos melhorados. 🛍️");
          router.refresh();
        });
      }}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all disabled:opacity-50"
      style={{ background: "#2a1a03", border: "1px solid #c9a800", color: "#c9a800" }}>
      🔄 Atualizar ofertas (80 ZC)
    </button>
  );
}

// ── Cores base ────────────────────────────────────────────────────────────────
const GOLD   = "#c9a800";
const GOLD_D = "#5a4700";

// ── Card TCG ──────────────────────────────────────────────────────────────────

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
      <div
        className="relative flex flex-col"
        style={{
          background: "linear-gradient(180deg,#1c1507 0%,#0d0b08 100%)",
          borderRadius: 14,
          boxShadow: `0 0 0 3px ${GOLD}, 0 0 0 5px ${GOLD_D}, inset 0 0 0 2px ${GOLD_D}80`,
          overflow: "hidden",
        }}
      >
        {/* Orelhinhas */}
        {[true, false].map((isLeft) => (
          <div key={String(isLeft)}
            className="absolute -top-[6px]"
            style={{ [isLeft ? "left" : "right"]: 12 }}>
            <div style={{
              width: 16, height: 8,
              background: GOLD,
              borderRadius: "3px 3px 0 0",
              boxShadow: `0 0 0 2px ${GOLD_D}`,
            }} />
          </div>
        ))}

        {/* Área do item */}
        <div className="relative flex flex-col items-center justify-center"
          style={{ minHeight: 170, padding: "28px 16px 20px" }}>
          {/* ⚡ cantos — confinados nesta área */}
          <span className="absolute top-2 left-2 text-[11px] leading-none select-none" style={{ color: GOLD }}>⚡</span>
          <span className="absolute top-2 right-2 text-[11px] leading-none select-none" style={{ color: GOLD }}>⚡</span>
          <span className="absolute bottom-2 left-2 text-[11px] leading-none select-none" style={{ color: GOLD }}>⚡</span>
          <span className="absolute bottom-2 right-2 text-[11px] leading-none select-none" style={{ color: GOLD }}>⚡</span>

          {/* Badge desconto */}
          <div className="absolute top-2 right-7 z-10 rounded-full bg-red-600 px-2 py-0.5
            text-[10px] font-black text-white shadow-lg leading-none">
            -{offer.discountPct}%
          </div>

          <ItemDisplay itemType={offer.itemType} imageUrl={offer.imageUrl} />
        </div>

        {/* Banner nome */}
        <div style={{
          background: "#2a1a03",
          borderTop: `2px solid ${GOLD}`,
          borderBottom: `2px solid ${GOLD}`,
          padding: "7px 10px",
          textAlign: "center",
        }}>
          <p style={{
            fontSize: 11, fontWeight: 900, color: GOLD,
            textTransform: "uppercase", letterSpacing: "0.1em",
            lineHeight: 1.2, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {dimmed ? (soldOut ? "ESGOTADO" : "EXPIRADO") : offer.name}
          </p>
          {offer.description && !dimmed && (
            <p style={{
              fontSize: 9, color: "#8b6c00", marginTop: 2, lineHeight: 1.3,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
            }}>
              {offer.description}
            </p>
          )}
          <p style={{ fontSize: 9, color: GOLD_D, marginTop: 3 }}>
            {offer.sold}/{offer.stock} vendidos
          </p>
        </div>

        {/* Preço + botão */}
        <div style={{ background: "#0d0b08", padding: "8px 12px 10px" }} className="space-y-2">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 11, color: "#5a4700", textDecoration: "line-through" }}>
              {offer.originalPrice.toLocaleString("pt-BR")} ZC
            </span>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#FFCB05",
              textShadow: "0 0 8px rgba(255,203,5,0.4)" }}>
              {offer.finalPrice.toLocaleString("pt-BR")} ZC
            </span>
          </div>
          <button
            type="button"
            disabled={pending || !canBuy}
            onClick={() => onBuy(idx)}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2
              font-bold transition-all disabled:cursor-not-allowed"
            style={{
              fontSize: 12,
              background: canBuy ? GOLD : "#2a1a03",
              color: canBuy ? "#1a1209" : GOLD_D,
              boxShadow: canBuy ? "0 0 0 1px #5a4700, 0 2px 8px rgba(201,168,0,0.3)" : "none",
            }}
          >
            {soldOut   ? "Esgotado" :
             expired   ? <><Clock size={10}/> Expirado</> :
             buying && pending ? "Comprando…" :
             <><ShoppingCart size={11}/> Comprar</>}
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
  lastNpcMessage?: string | null;
}

export function MiauvadaoPanel({ offers, vaultBalance, balance, playerId, lastNpcMessage }: Props) {
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
    /*
      Wrapper único com overflow-hidden — o gato é posicionado dentro
      e clipped naturalmente nas bordas do painel.
    */
    <div
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg,#1a1105 0%,#0e0c06 60%,#1a1105 100%)",
        boxShadow: `0 0 0 1px ${GOLD_D}`,
      }}
    >
      {/* ── Gato NPC ── dentro do overflow-hidden, clipped naturalmente */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/miauvadao-cat.png"
        alt="Miauvadão"
        className="pointer-events-none absolute bottom-0 left-0 hidden md:block"
        style={{
          width: 215,
          height: "auto",
          maxHeight: "110%",
          objectFit: "contain",
          objectPosition: "bottom left",
          filter: "drop-shadow(3px 0 16px rgba(0,0,0,0.9))",
          zIndex: 5,
        }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {/* Speech bubble — estilo igual ao mascote, à direita do gato */}
      {lastNpcMessage && (
        <div className="hidden md:block absolute z-30 pointer-events-none"
          style={{ left: 195, top: 18, maxWidth: 270 }}>
          {/* Tail pointing left toward cat */}
          <div style={{
            position: "absolute", left: -8, top: 14,
            width: 0, height: 0,
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderRight: "8px solid #e2d9c8",
          }} />
          <div
            className="relative rounded-2xl px-3 py-2 text-[11px] leading-snug"
            style={{
              background: "#f5f0e8",
              border: "1.5px solid #e2d9c8",
              color: "#2a1a03",
              fontWeight: 600,
              boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
              maxWidth: 270,
            }}
          >
            {lastNpcMessage}
          </div>
        </div>
      )}

      {/* Conteúdo deslocado à direita — 215px para o gato */}
      <div className="md:pl-[215px] px-5 pt-5 pb-6 space-y-5">

        {/* Mobile speech bubble fallback */}
        {lastNpcMessage && (
          <div className="md:hidden rounded-xl px-3 py-2 text-[11px]"
            style={{ background: "#f5f0e8", color: "#2a1a03", fontWeight: 600, border: "1.5px solid #e2d9c8" }}>
            🐱 {lastNpcMessage}
          </div>
        )}

          {/* Header — título centralizado, cofre/timer à direita */}
          <div className="relative flex items-center justify-center">
            {/* Título centrado */}
            <div
              className="flex items-center gap-3 rounded-xl px-5 py-2.5"
              style={{
                background: "#1e1608",
                border: `2px solid ${GOLD}`,
                boxShadow: `0 0 0 1px ${GOLD_D}, 0 0 16px rgba(201,168,0,0.15)`,
              }}
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl"
                style={{ background: "#2a1a03", border: `2px solid ${GOLD}` }}
              >
                🐱
              </div>
              <h2
                className="font-pixel text-base flex items-center gap-1.5"
                style={{ color: "#FFCB05", textShadow: "0 0 10px rgba(255,203,5,0.5)" }}
              >
                Ofertas do Miauvadão
                <Zap size={13} className="fill-[#FFCB05] text-[#FFCB05]" />
              </h2>
            </div>

            {/* Cofre + timer — canto superior direito */}
            <div
              className="absolute right-0 flex flex-col items-end gap-0.5 text-[10px]"
              style={{ color: GOLD_D }}
            >
              <span>
                Cofre:{" "}
                <strong style={{ color: "#FFCB05" }}>
                  {vaultBalance.toLocaleString("pt-BR")} ZC
                </strong>
              </span>
              {offers[0]?.validUntil && (
                <span><RefreshCountdown validUntil={offers[0].validUntil} /></span>
              )}
            </div>
          </div>

          {/* Cards */}
          {offers.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-3xl">😿</p>
              <p className="text-sm" style={{ color: GOLD_D }}>
                O Miauvadão ainda não abriu as ofertas de hoje.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-3 pt-1 relative" style={{ zIndex: 10 }}>
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

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px]" style={{ color: "#3a2c00" }}>
              As taxas do Bazar alimentam o cofre do Miauvadão e financiam os descontos.
            </p>
            <RefreshShopButton playerId={playerId} />
          </div>
      </div>
    </div>
  );
}
