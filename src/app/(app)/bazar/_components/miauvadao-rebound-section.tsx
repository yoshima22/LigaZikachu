"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bug, Clock, Link2, RotateCcw, ShoppingCart } from "lucide-react";
import { buyMiauvadaoRebound } from "../actions";
import { REBOUND_BLOCK_MESSAGE, type ReboundOfferView, type ReboundView } from "@/lib/miauvadao-rebound";
import { getShopItemEmoji } from "@/lib/shop-config";

const GOLD = "#c9a800";

// Mesma proporção da ZikaShop (economia central). Espelha suggestedLigaCashPrice.
export function suggestedLcClient(zcPrice: number, mult: number, zcPerLc: number) {
  const raw = zcPrice / (zcPerLc * mult);
  if (raw < 100) return Math.max(1, Math.round(raw));
  if (raw < 500) return Math.max(5, Math.round(raw / 5) * 5);
  return Math.max(10, Math.round(raw / 10) * 10);
}

function BoundTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-cyan-300/50 bg-cyan-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-100 ${className}`}>
      <Link2 size={9} /> Vinculado à conta
    </span>
  );
}

const REBOUND_HELP = "Perdeu o slot? Compre 1 cópia do item esgotado com desconto um pouco menor. Só nos 25 min após a rotação, para quem não comprou slot. Gasta 1 compra diária, vale 2 por rotação e o item fica vinculado à conta (não pode ser trocado nem vendido).";

function HelpHint() {
  return (
    <span className="group/help relative inline-flex">
      <button
        type="button"
        aria-label="Como funciona o Rebote"
        title={REBOUND_HELP}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-400/10 text-[10px] font-black text-cyan-100 hover:bg-cyan-400/25 focus:bg-cyan-400/25"
      >?</button>
      <span role="tooltip" className="pointer-events-none invisible absolute right-0 top-6 z-40 w-64 rounded-lg border border-cyan-300/40 bg-slate-950 p-2.5 text-left text-[10px] font-medium leading-snug text-slate-200 opacity-0 shadow-xl transition group-hover/help:visible group-hover/help:opacity-100 group-focus-within/help:visible group-focus-within/help:opacity-100">
        {REBOUND_HELP}
      </span>
    </span>
  );
}

function ReboundCard({
  offer, canBuy, reason, debug, pending, buying, balance, ligaCashBalance, priceLc, ligaCashEnabled, onBuy, msLeft,
}: {
  offer: ReboundOfferView;
  canBuy: boolean;
  reason: string | null;
  debug: boolean;
  pending: boolean;
  buying: boolean;
  balance: number;
  ligaCashBalance: number;
  priceLc: number;
  ligaCashEnabled: boolean;
  onBuy: (index: number, currency: "ZC" | "LC") => void;
  /** Tempo restante da janela do Rebote (null no preview de debug). */
  msLeft: number | null;
}) {
  const enabled = canBuy && !debug && !offer.alreadyBought;
  const cantAffordZc = balance < offer.finalPrice;
  const cantAffordLc = ligaCashBalance < priceLc;
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/90 to-slate-950 p-3 shadow-[0_0_24px_rgba(34,211,238,0.07)]">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5">
        {debug && <span className="rounded-full bg-fuchsia-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">Preview</span>}
        {!debug && msLeft !== null && msLeft > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-amber-200">
            <Clock size={9} /> {windowLabel(msLeft)}
          </span>
        )}
        <HelpHint />
      </div>
      <div className="flex items-center gap-3 pt-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-slate-950">
          {offer.imageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={offer.imageUrl} alt="" className="max-h-[52px] max-w-[52px] object-contain" />
            : <span className="text-3xl leading-none">{getShopItemEmoji(offer.itemType)}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white" title={offer.name}>{offer.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-base font-black text-[#FFCB05]">{offer.finalPrice.toLocaleString("pt-BR")} ZC</span>
            <span className="text-[10px] text-slate-500 line-through">{offer.originalPrice.toLocaleString("pt-BR")}</span>
            {offer.discountPct > 0 && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">-{offer.discountPct}%</span>}
          </div>
          <div className="mt-1.5"><BoundTag /></div>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled={!enabled || pending || cantAffordZc}
          onClick={() => onBuy(offer.index, "ZC")}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[#FFCB05] py-2 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {offer.alreadyBought ? "Rebote já comprado" : buying && pending ? "Comprando…" : <><ShoppingCart size={11} /> Pagar {offer.finalPrice.toLocaleString("pt-BR")} ZC</>}
        </button>
        {ligaCashEnabled && !offer.alreadyBought && (
          <button
            type="button"
            disabled={!enabled || pending || cantAffordLc}
            onClick={() => onBuy(offer.index, "LC")}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-cyan-400 py-2 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingCart size={11} /> Pagar {priceLc.toLocaleString("pt-BR")} LC
          </button>
        )}
        {reason && <p className="text-center text-[10px] leading-snug text-slate-400">{reason}</p>}
      </div>
    </div>
  );
}

function windowLabel(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function MiauvadaoReboundSection({
  rebound, reboundDebug,   isPlatformAdmin, playerId, balance, ligaCashBalance, lcMult, lcRef, ligaCashEnabled, sabotagedOfferIndex, hasPurchaseCharge, nextChargeLabel,
}: {
  rebound: ReboundView | null;
  /** Visão com todos os slots (só admin de plataforma recebe; é apenas visual). */
  reboundDebug: ReboundView | null;
  isPlatformAdmin: boolean;
  playerId: string | null;
  balance: number;
  ligaCashBalance: number;
  lcMult: number;
  lcRef: number;
  ligaCashEnabled: boolean;
  sabotagedOfferIndex: number | null;
  /** O jogador tem ao menos 1 das 2 cargas de compra diárias disponível. */
  hasPurchaseCharge: boolean;
  nextChargeLabel: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [buyingIdx, setBuyingIdx] = useState<number | null>(null);
  const [debug, setDebug] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  // A preferência do preview vale só nesta aba; nunca altera o que o servidor libera.
  useEffect(() => {
    try { setDebug(localStorage.getItem("bazar-rebound-debug") === "1"); } catch { /* sem storage */ }
  }, []);
  const toggleDebug = () => {
    setDebug((current) => {
      const next = !current;
      try { localStorage.setItem("bazar-rebound-debug", next ? "1" : "0"); } catch { /* sem storage */ }
      return next;
    });
  };

  const view = debug && reboundDebug ? reboundDebug : rebound;
  const windowEnd = view ? new Date(view.windowEndsAt).getTime() : 0;
  const msLeft = windowEnd - now;
  const windowOpen = msLeft > 0;

  // Janela fechou enquanto a página estava aberta: some sozinho (para jogadores).
  useEffect(() => {
    if (!rebound || debug) return;
    const target = new Date(rebound.windowEndsAt).getTime();
    const t = setTimeout(() => router.refresh(), Math.max(0, target - Date.now()) + 800);
    return () => clearTimeout(t);
  }, [rebound, debug, router]);

  const adminButton = isPlatformAdmin && (
    <button
      type="button"
      onClick={toggleDebug}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${debug ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}
      title="Somente admin (não GM): mostra o Rebote em todos os slots, mesmo fora do horário. Apenas visual."
    >
      <Bug size={11} /> Debug visual do Rebote: {debug ? "ligado" : "desligado"}
    </button>
  );

  if (!view) return adminButton ? <div className="relative flex justify-end" style={{ zIndex: 15 }}>{adminButton}</div> : null;

  const real = rebound;
  const showReal = !debug;
  // Jogador comum: só aparece algo dentro da janela e se algum slot esgotou.
  if (showReal && (!windowOpen || view.offers.length === 0 || view.block === "bought_global")) {
    return adminButton ? <div className="relative flex justify-end" style={{ zIndex: 15 }}>{adminButton}</div> : null;
  }

  const blockMessage = view.block && view.block !== "window_closed" ? REBOUND_BLOCK_MESSAGE[view.block] : null;
  const canBuyNow = showReal && !blockMessage && windowOpen && Boolean(playerId) && hasPurchaseCharge;

  const handleBuy = (index: number, currency: "ZC" | "LC") => {
    const offer = view.offers.find((o) => o.index === index);
    if (!offer) return;
    if (sabotagedOfferIndex === index) { toast.error("Esse slot foi sabotado pela Ordem da Trapaca."); return; }
    const priceLabel = currency === "LC"
      ? `${suggestedLcClient(offer.finalPrice, lcMult, lcRef).toLocaleString("pt-BR")} LC`
      : `${offer.finalPrice.toLocaleString("pt-BR")} ZC`;
    if (!confirm(`Comprar o Rebote de "${offer.name}" por ${priceLabel}?\n\nO item ficará VINCULADO À CONTA: não poderá ser vendido, trocado nem enviado a outros jogadores. Esta compra gasta 1 das suas compras diárias. Depois de 2 compras de Rebote você só poderá comprar de novo na próxima rotação.`)) return;
    setBuyingIdx(index);
    startTransition(async () => {
      const r = await buyMiauvadaoRebound(index, currency);
      if (r.error) toast.error(r.error);
      else { toast.success(`Rebote: "${offer.name}" adicionado ao inventário (vinculado à conta).`); router.refresh(); }
      setBuyingIdx(null);
    });
  };

  const left = Math.max(0, view.maxPerCycle - view.boughtCount);

  return (
    <div className="relative space-y-3" style={{ zIndex: 15 }}>
      <div
        className={`overflow-hidden rounded-2xl border p-3 sm:p-4 ${debug ? "border-fuchsia-400/50 bg-fuchsia-500/5" : "border-cyan-400/40 bg-gradient-to-br from-cyan-500/10 via-slate-950/40 to-amber-500/10"}`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-400/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-cyan-200">
              <RotateCcw size={10} /> Rebote do Miauvadão
            </span>
            <span className="text-[10px] font-semibold text-cyan-100/70">Segunda chance para slots esgotados</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showReal && windowOpen && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-200" style={{ color: GOLD }}>
                <Clock size={10} /> Termina em {windowLabel(msLeft)}
              </span>
            )}
            {showReal && <span className="text-[10px] font-bold text-cyan-100/80">Rebotes disponíveis: {left}/{view.maxPerCycle}</span>}
            {adminButton}
          </div>
        </div>

        {debug && (
          <p className="mb-3 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-2 text-[11px] leading-snug text-fuchsia-100">
            <strong>Modo debug visual (admin).</strong> Mostrando o Rebote em todos os slots, mesmo fora do horário e com estoque. Nada aqui compra: os botões ficam desativados.
          </p>
        )}

        {showReal && (
          <p className="mb-3 text-[11px] leading-snug text-slate-300">
            Você não comprou nenhum slot nesta rotação, então pode pegar <strong className="text-white">1 cópia</strong> de cada item esgotado com um desconto um pouco menor.
            Os itens ficam <strong className="text-cyan-200">vinculados à conta</strong> (não podem ser vendidos nem trocados). Cada Rebote gasta <strong className="text-white">1 das suas compras diárias</strong> e o limite é de <strong className="text-white">2 por rotação</strong>.
          </p>
        )}
        {showReal && blockMessage && (
          <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] leading-snug text-amber-100">{blockMessage}</p>
        )}

        {view.offers.length === 0 ? (
          <p className="text-center text-xs text-slate-400">Nenhum slot está disponível para Rebote.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {view.offers.map((offer) => (
              <ReboundCard
                key={offer.key}
                offer={offer}
                msLeft={debug ? null : msLeft}
                canBuy={canBuyNow && sabotagedOfferIndex !== offer.index}
                reason={debug ? (offer.slotHasStock ? "Slot ainda tem estoque (só aparece no preview)." : null) : sabotagedOfferIndex === offer.index ? "Slot sabotado pela Ordem." : !hasPurchaseCharge && !offer.alreadyBought && !blockMessage ? `Suas compras diárias estão recarregando${nextChargeLabel ? ` (próxima em ${nextChargeLabel})` : ""}.` : null}
                debug={debug}
                pending={pending}
                buying={buyingIdx === offer.index}
                balance={balance}
                ligaCashBalance={ligaCashBalance}
                priceLc={suggestedLcClient(offer.finalPrice, lcMult, lcRef)}
                ligaCashEnabled={ligaCashEnabled}
                onBuy={handleBuy}
              />
            ))}
          </div>
        )}
        {showReal && real && <p className="mt-3 text-[9px] text-slate-500">O Rebote acompanha o item atual do slot e não consome o estoque do Miauvadão (mas usa uma das suas compras diárias).</p>}
      </div>
    </div>
  );
}
