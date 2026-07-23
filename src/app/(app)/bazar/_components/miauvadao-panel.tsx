"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, ShoppingCart, Clock, RefreshCw } from "lucide-react";
import { buyMiauvadaoOffer, refreshMiauvadaoOfferSlot } from "../actions";
import type { MiauvadaoOffer, MiauvadaoPurchaseStatus } from "../actions";
import { getShopItemEmoji } from "@/lib/shop-config";

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
  if (itemType === "EGG_RARE"    || itemType === "RARE")    return <EggImg src="/mascot/egg-common.webp" />;
  if (itemType === "EGG_SPECIAL" || itemType === "SPECIAL") return <EggImg src="/mascot/egg-common.webp" />;
  if (itemType.startsWith("EGG_") || itemType === "COMMON" || itemType === "EVENT")
    return <EggImg src="/mascot/egg-common.webp" />;

  // 3. Buffs e comidas — emojis grandes (igual à ZikaShop)
  const emoji = getShopItemEmoji(itemType);
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

// ── Cores base ────────────────────────────────────────────────────────────────
const GOLD   = "#c9a800";
const GOLD_D = "#5a4700";

// ── Card TCG ──────────────────────────────────────────────────────────────────

function MiauvadaoCard({
  offer, idx, onBuy, onRefresh, pending, buying, balance, sabotaged, canPurchase, slotRefreshAvailable,
}: {
  offer: MiauvadaoOffer;
  idx: number;
  onBuy: (i: number) => void;
  onRefresh: (i: number) => void;
  pending: boolean;
  buying: boolean;
  balance: number;
  sabotaged?: boolean;
  canPurchase: boolean;
  slotRefreshAvailable: boolean;
}) {
  const soldOut = offer.sold >= offer.stock;
  const expired = new Date() > new Date(offer.validUntil);
  const canBuy  = canPurchase && !sabotaged && !soldOut && !expired && balance >= offer.finalPrice;
  const dimmed  = sabotaged || soldOut || expired;

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
          {sabotaged && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-purple-950/70">
              <div className="rounded-xl border border-purple-300/40 bg-slate-950/90 px-3 py-2 text-center shadow-[0_0_24px_rgba(168,85,247,0.35)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">Slot sabotado</p>
                <p className="mt-1 text-[10px] text-slate-400">Compra bloqueada pela Ordem</p>
              </div>
            </div>
          )}
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
            {sabotaged ? "SLOT CORROMPIDO" : dimmed ? (soldOut ? "ESGOTADO" : "EXPIRADO") : offer.name}
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
            {sabotaged ? "Sabotado" :
             soldOut   ? "Esgotado" :
             expired   ? <><Clock size={10}/> Expirado</> :
             buying && pending ? "Comprando…" :
             <><ShoppingCart size={11}/> Comprar</>}
          </button>
          {slotRefreshAvailable && (
            <button type="button" disabled={pending} onClick={() => onRefresh(idx)}
              className="w-full rounded-lg border border-[#c9a800]/50 py-1.5 text-[10px] font-bold text-[#c9a800] disabled:opacity-50">
              <RefreshCw size={10} className="mr-1 inline" /> Trocar este slot · 250 ZC
            </button>
          )}
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
  slotRefreshAvailable?: boolean;
  purchaseStatus: MiauvadaoPurchaseStatus;
  sabotagedOfferIndex?: number | null;
}

export function MiauvadaoPanel({ offers, vaultBalance, balance, playerId, lastNpcMessage, slotRefreshAvailable = false, purchaseStatus: initialPurchaseStatus, sabotagedOfferIndex = null }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buyingIdx, setBuyingIdx] = useState<number | null>(null);
  const [purchaseStatus, setPurchaseStatus] = useState(initialPurchaseStatus);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const availablePurchases = purchaseStatus.rechargeAt.filter((date) => new Date(date).getTime() > now).length;
  const purchaseCount = Math.max(purchaseStatus.available, 2 - availablePurchases);

  // Ao expirar o timer, recarrega a página para o servidor re-gerar as ofertas
  // (autoRefreshMiauvadaoIfNeeded roda no load). Throttle de 4s cobre a
  // defasagem de relógio entre cliente e servidor e evita refresh em loop.
  const lastRefreshRef = useRef(0);
  useEffect(() => {
    const validUntil = offers[0]?.validUntil;
    if (!validUntil) return;
    const target = new Date(validUntil).getTime();
    const check = () => {
      if (Date.now() >= target) {
        const now = Date.now();
        if (now - lastRefreshRef.current > 4000) {
          lastRefreshRef.current = now;
          router.refresh();
        }
      }
    };
    const iv = setInterval(check, 1000);
    return () => clearInterval(iv);
  }, [offers, router]);

  const handleBuy = (idx: number) => {
    const offer = offers[idx];
    if (!offer) return;
    if (sabotagedOfferIndex === idx) { toast.error("Esse slot foi sabotado pela Ordem da Trapaca."); return; }
    if (!playerId) { toast.error("Faça login para comprar."); return; }
    if (!confirm(`Comprar "${offer.name}" por ${offer.finalPrice.toLocaleString("pt-BR")} ZC?`)) return;
    setBuyingIdx(idx);
    startTransition(async () => {
      const r = await buyMiauvadaoOffer(idx);
      if (r.error) toast.error(r.error);
      else {
        if (r.purchaseStatus) setPurchaseStatus(r.purchaseStatus);
        toast.success(`"${offer.name}" adicionado ao inventário! 🎉`);
        router.refresh();
      }
      setBuyingIdx(null);
    });
  };

  const handleRefresh = (idx: number) => {
    if (!confirm("Trocar este slot e seu desconto para todos por 250 ZC? Esta troca só pode ser usada uma vez nesta rotação.")) return;
    startTransition(async () => {
      const result = await refreshMiauvadaoOfferSlot(idx);
      if (result.error) toast.error(result.error);
      else { toast.success("Slot trocado para todos os jogadores!"); router.refresh(); }
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
      {/*
        ── Layer 1: Gato ──
        Ancoramos pelo TOPO (top:8px) para que o rosto fique na parte
        superior e alinhado ao balão de diálogo.
        Os pés/caixas ficam abaixo do painel e são cortados pelo overflow:hidden.
        z-index: 8 → atrás dos cards (z-15) mas à frente do fundo (z-0).
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/miauvadao-cat.webp"
        alt="Miauvadão"
        className="pointer-events-none absolute left-0 hidden md:block"
        style={{
          top: 8,
          width: 300,
          height: "auto",
          objectFit: "contain",
          objectPosition: "top left",
          filter: "drop-shadow(4px 0 20px rgba(0,0,0,0.95))",
          zIndex: 8,
        }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />

      {/*
        ── Balão de diálogo ──
        Posicionado acima da linha dos cards (top negativo do cat area),
        sem invadir o primeiro slot.
        Fica entre o gato e o início do conteúdo (até left:262).
        Cauda aponta para a ESQUERDA → rosto do gato.
        z-index: 30.
      */}
      {lastNpcMessage && (
        <div className="hidden md:block absolute pointer-events-none"
          style={{ left: 178, top: 8, maxWidth: 220, zIndex: 30 }}>
          {/* Cauda apontando para a esquerda → rosto do gato */}
          <div style={{
            position: "absolute", left: -8, top: 12,
            width: 0, height: 0,
            borderTop: "6px solid transparent",
            borderBottom: "6px solid transparent",
            borderRight: "8px solid #e2d9c8",
          }} />
          <div
            className="max-h-[72px] overflow-hidden rounded-2xl px-3 py-2 text-[10px] leading-snug"
            style={{
              background: "#f5f0e8",
              border: "1.5px solid #e2d9c8",
              color: "#2a1a03",
              fontWeight: 600,
              boxShadow: "0 2px 16px rgba(0,0,0,0.6)",
            }}
          >
            {lastNpcMessage}
          </div>
        </div>
      )}

      {/* Conteúdo — padding-left reserva espaço para o gato (300px) */}
      <div className="md:pl-[265px] px-5 pt-5 pb-6 space-y-5">

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
              {playerId && <span>Compras disponíveis: <strong style={{ color: "#FFCB05" }}>{purchaseCount}/2</strong></span>}
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
            <div className="grid gap-5 sm:grid-cols-3 pt-1 relative" style={{ zIndex: 15 }}>{/* Layer 2: z-15 > gato z-8 */}
              {offers.map((offer, idx) => (
                <MiauvadaoCard
                  key={idx}
                  offer={offer}
                  idx={idx}
                  onBuy={handleBuy}
                  onRefresh={handleRefresh}
                  pending={pending}
                  buying={buyingIdx === idx}
                  balance={balance}
                  sabotaged={sabotagedOfferIndex === idx}
                  canPurchase={purchaseCount > 0}
                  slotRefreshAvailable={slotRefreshAvailable}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px]" style={{ color: "#3a2c00" }}>
              As taxas do Bazar alimentam o cofre do Miauvadão e financiam os descontos.
            </p>
            <span className="text-[10px]" style={{ color: slotRefreshAvailable ? "#c9a800" : "#5a4700" }}>
              {slotRefreshAvailable ? "1 troca de slot disponível nesta rotação" : "Troca de slot já utilizada nesta rotação"}
            </span>
          </div>
      </div>
    </div>
  );
}
