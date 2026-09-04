"use client";

import Link from "next/link";
import { Coins, Crown, Heart, MessageSquare, Clock, Gavel, Handshake } from "lucide-react";
import { getMascotRarity, getShinySprite, getSpriteUrl, RARITY_COLOR, RARITY_LABEL } from "@/lib/mascot-data";
import { getShopItemEmoji } from "@/lib/shop-config";
import { getHatchedEggLabel } from "@/lib/egg-origin";
import { PremiumCountdown } from "./premium-countdown";

const CATEGORY_LABEL: Record<string, string> = {
  MASCOT: "Mascote", ITEM: "Item", COSMETIC: "Cosmético",
};
// Estilo do rank de avaliação do Laboratório (IVs).
const IV_RATING_STYLE: Record<string, string> = {
  SSS: "text-fuchsia-300 border-fuchsia-400/50 bg-fuchsia-500/15",
  SS:  "text-purple-300 border-purple-400/50 bg-purple-500/15",
  S:   "text-amber-300 border-amber-400/50 bg-amber-500/15",
  A:   "text-emerald-300 border-emerald-400/50 bg-emerald-500/15",
  B:   "text-sky-300 border-sky-400/50 bg-sky-500/15",
  C:   "text-slate-300 border-slate-400/40 bg-slate-500/15",
  D:   "text-orange-300 border-orange-400/40 bg-orange-500/10",
  E:   "text-red-300 border-red-400/40 bg-red-500/10",
};
const LISTING_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  SALE:         { label: "Venda",       color: "text-green-400 border-green-500/30 bg-green-500/10" },
  TRADE:        { label: "Troca",       color: "text-blue-400  border-blue-500/30  bg-blue-500/10" },
  SALE_OR_TRADE:{ label: "Venda/Troca", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
  AUCTION:      { label: "Leilão",      color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
};

function auctionTimeLeft(endsAt: Date): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Encerrado";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fullMascotName(payload: Record<string, unknown>) {
  const original = String(payload.pokemonName ?? "Mascote").trim();
  const nickname = typeof payload.nickname === "string" ? payload.nickname.trim() : "";
  return nickname && nickname.localeCompare(original, "pt-BR", { sensitivity: "base" }) !== 0
    ? `${original} (${nickname})`
    : original;
}

interface Listing {
  id: string;
  category: string;
  listingType: string;
  status: string;
  payload: Record<string, unknown>;
  priceCoins: number | null;
  priceLigaCash?: number | null;
  description: string | null;
  loanEnabled?: boolean;
  loanAmountCoins?: number | null;
  loanInterestPct?: number | null;
  expiresAt: Date;
  createdAt: Date;
  premiumUntil?: Date | null;
  premiumHighlights?: string[];
  player: { id: string; displayName: string };
  _count: { proposals: number; favorites: number };
  // Auction fields
  minBidCoins?: number | null;
  currentBidCoins?: number | null;
  auctionEndsAt?: Date | null;
}

export function BazarListingCard({ listing }: { listing: Listing }) {
  const isAuction = listing.listingType === "AUCTION";
  const payload = listing.payload as Record<string, unknown>;
  const isDirectNegotiation = payload.directNegotiation === true;
  const type = isDirectNegotiation
    ? { label: "Negociação direta", color: "text-cyan-300 border-cyan-500/30 bg-cyan-500/10" }
    : LISTING_TYPE_LABEL[listing.listingType] ?? LISTING_TYPE_LABEL.SALE;
  const daysLeft = Math.max(0, Math.ceil((new Date(listing.expiresAt).getTime() - Date.now()) / 86400000));
  const auctionEnd = listing.auctionEndsAt ? new Date(listing.auctionEndsAt) : null;
  const mascotRarity = listing.category === "MASCOT" ? getMascotRarity(Number(payload.pokemonId)) : null;
  const mascotRarityLabel = mascotRarity ? (RARITY_LABEL[mascotRarity] || "Comum") : null;
  const isShiny = listing.category === "MASCOT" && payload.isShiny === true;
  const ivRating = listing.category === "MASCOT" && typeof payload.ivRating === "string" ? payload.ivRating : null;
  const eggOriginLabel = listing.category === "MASCOT"
    ? getHatchedEggLabel(payload.hatchedFromEggType as string | null, payload.hatchedFromEggOrigin as string | null)
    : null;
  const isPremium = Boolean(listing.premiumUntil && new Date(listing.premiumUntil).getTime() > Date.now());
  const stats = (payload.stats ?? {}) as Record<string, unknown>;
  const statTotal = ["force", "agility", "charisma", "instinct", "vitality"]
    .reduce((sum, key) => sum + Number(stats[key] ?? 0), 0);
  const fallbackPremiumHighlights = isPremium ? [
    ...(isShiny ? ["Versão shiny, muito mais difícil de encontrar."] : []),
    ...(mascotRarity && mascotRarity !== "COMMON" && mascotRarityLabel
      ? [`Classificação ${mascotRarityLabel.toLowerCase()}, com aparição menos comum em ovos.`]
      : []),
    ...(eggOriginLabel ? [`Origem confirmada: ${eggOriginLabel}.`] : []),
    ...(statTotal > 0 ? [`${statTotal} pontos somados nos cinco atributos.`] : []),
  ].slice(0, 2) : [];
  const premiumHighlights = listing.premiumHighlights?.length
    ? listing.premiumHighlights
    : fallbackPremiumHighlights;

  return (
    <Link href={`/bazar/${listing.id}`}
      className={`relative flex flex-col rounded-xl border bg-slate-950/60 transition-all overflow-hidden group ${isPremium ? "border-amber-300/70 ring-1 ring-amber-300/20 shadow-[0_0_24px_rgba(250,204,21,0.16)] hover:border-amber-200" : isAuction ? "border-amber-500/30 hover:border-amber-400/50" : "border-border hover:border-slate-600"}`}>

      {/* Preview */}
      <div className="flex items-center justify-center bg-slate-900/80 h-32 relative">
        {isDirectNegotiation ? (
          <div className="flex flex-col items-center gap-2 text-cyan-200">
            <Handshake size={54} strokeWidth={1.4}/>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Mesa aberta</span>
          </div>
        ) : listing.category === "MASCOT" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={(payload.animatedSpriteUrlOverride || payload.staticSpriteUrlOverride) as string || (isShiny ? getShinySprite(payload.pokemonId as number, true) : getSpriteUrl(payload.pokemonId as number, true))}
              alt={fullMascotName(payload)}
              className="h-24 object-contain group-hover:scale-110 transition-transform"
              style={{ imageRendering: "pixelated" }}
              onError={e => {
                const image = e.currentTarget as HTMLImageElement;
                image.onerror = null;
                image.src = payload.staticSpriteUrlOverride as string || (isShiny
                  ? getShinySprite(payload.pokemonId as number, false)
                  : getSpriteUrl(payload.pokemonId as number));
              }}
            />
            <div className="absolute bottom-1 right-1 rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold text-[#FFCB05]">
              Nv.{payload.level as number}
            </div>
            {eggOriginLabel && (
              <div className="absolute bottom-1 left-1 max-w-[72%] truncate rounded-full border border-cyan-400/30 bg-slate-950/90 px-2 py-0.5 text-[9px] font-semibold text-cyan-200" title={eggOriginLabel}>
                🥚 {eggOriginLabel}
              </div>
            )}
            {mascotRarity && mascotRarityLabel && (
              <div className={`absolute top-1.5 right-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${RARITY_COLOR[mascotRarity] || "border-slate-500/40 bg-slate-800/80 text-slate-300"}`}>
                {mascotRarityLabel}
              </div>
            )}
            {ivRating && (
              <div className={`absolute right-1.5 top-8 rounded-full border px-2 py-0.5 text-[9px] font-black ${IV_RATING_STYLE[ivRating] ?? "border-slate-500/40 bg-slate-800/80 text-slate-300"}`} title="Avaliação do Laboratório (IVs)">
                🔬 {ivRating}
              </div>
            )}
            {isShiny && (
              <div className="absolute left-1.5 top-8 rounded-full border border-yellow-300/60 bg-gradient-to-r from-yellow-400/25 via-purple-400/20 to-cyan-400/20 px-2 py-0.5 text-[9px] font-black tracking-wide text-yellow-100 shadow-[0_0_14px_rgba(250,204,21,0.28)]">
                ✨ SHINY
              </div>
            )}
          </>
        ) : payload.imageUrl ? (
          // Imagem real cadastrada no shop
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={payload.imageUrl as string}
            alt={(payload.displayName as string) ?? ""}
            className="h-20 max-w-[80%] object-contain"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (payload.itemType as string)?.startsWith("EGG_") || ["COMMON","RARE","SPECIAL","EVENT"].includes(payload.itemType as string) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/mascot/egg-common.webp"
            alt={(payload.displayName as string) ?? "Ovo"}
            className="h-20 object-contain"
          />
        ) : (
          <span className="text-5xl">
            {getShopItemEmoji(payload.itemType as string)}
          </span>
        )}
        {/* Quantidade — apenas para itens com qty > 1 */}
        {listing.category !== "MASCOT" && (payload.quantity as number) > 1 && (
          <div className="absolute bottom-1 right-1 rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold text-slate-200">
            ×{payload.quantity as number}
          </div>
        )}
        {/* Type badge */}
        <div className={`absolute top-1.5 left-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${type.color}`}>
          {type.label}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2 flex-1">
        {isPremium && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-400/10 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-amber-200">
              <Crown size={10} /> Destaque premium
            </span>
            <PremiumCountdown until={listing.premiumUntil!} className="rounded-full border border-amber-300/25 bg-slate-900/80 px-2 py-1 text-[9px] font-semibold text-amber-100/80" />
          </div>
        )}
        {isPremium && premiumHighlights.length > 0 && (
          <div className="rounded-xl border border-amber-300/25 bg-gradient-to-br from-amber-400/10 to-purple-500/5 px-2.5 py-2">
            <p className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-amber-300">
              🐾 Dica do Miauvadão
            </p>
            <ul className="space-y-0.5 text-[10px] leading-snug text-amber-50/80">
              {premiumHighlights.map((highlight) => (
                <li key={highlight} className="flex gap-1.5"><span className="text-amber-400">•</span><span>{highlight}</span></li>
              ))}
            </ul>
          </div>
        )}
        {listing.loanEnabled && listing.loanAmountCoins && (
          <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-1.5 text-[10px] text-cyan-100">
            Empréstimo: {listing.loanAmountCoins.toLocaleString("pt-BR")} ZC · {listing.loanInterestPct ?? 0}% juros
          </div>
        )}
        <div>
          <p className="font-semibold text-white text-sm truncate">
            {listing.category === "MASCOT"
              ? fullMascotName(payload)
              : String(payload.displayName ?? payload.itemType ?? "Item")}
          </p>
          <p className="text-[10px] text-slate-500">
            {CATEGORY_LABEL[listing.category]}
            {listing.category === "MASCOT" && ` · #${payload.pokemonId as number}`}
          </p>
        </div>

        {listing.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2">{listing.description}</p>
        )}

        {isDirectNegotiation ? (
          <>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2 py-2 text-[10px] leading-relaxed text-cyan-100/75">
              Mesa de {listing.player.displayName}. Entre, monte sua oferta e confirme a troca.
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-cyan-500/20 pt-1.5">
              <span className="truncate">Anunciante: {listing.player.displayName}</span>
              <span className="flex items-center gap-2">
                <span className="flex items-center gap-0.5"><Heart size={9}/>{listing._count.favorites}</span>
                <span className="flex items-center gap-0.5"><Clock size={8}/> {daysLeft}d</span>
              </span>
            </div>
          </>
        ) : isAuction ? (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] text-slate-500">{listing.currentBidCoins ? "Lance atual" : "Lance mínimo"}</p>
                <span className="flex items-center gap-1 text-sm font-bold text-amber-400">
                  <Gavel size={12}/> {(listing.currentBidCoins ?? listing.minBidCoins ?? 0).toLocaleString("pt-BR")} ZC
                </span>
              </div>
              <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
                <Heart size={9}/>{listing._count.favorites}
              </span>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-amber-500/20 pt-1.5">
              <span>{listing.player.displayName}</span>
              <span className="flex items-center gap-0.5 text-amber-400/80">
                <Clock size={8}/> {auctionEnd ? auctionTimeLeft(auctionEnd) : `${daysLeft}d`}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pt-1">
              {listing.priceCoins || listing.priceLigaCash ? (
                <span className="flex flex-col gap-0.5 leading-tight">
                  {listing.priceCoins ? (
                    <span className="flex items-center gap-1 text-sm font-bold text-[#FFCB05]">
                      <Coins size={13}/> {listing.priceCoins.toLocaleString("pt-BR")} ZC
                    </span>
                  ) : null}
                  {listing.priceLigaCash ? (
                    <span className="flex items-center gap-1 text-sm font-bold text-cyan-300">
                      <Coins size={13}/> {listing.priceLigaCash.toLocaleString("pt-BR")} LC
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="text-xs text-blue-400">Somente troca</span>
              )}
              <div className="flex items-center gap-2 text-[10px] text-slate-600">
                <span className="flex items-center gap-0.5"><Heart size={9}/>{listing._count.favorites}</span>
                <span className="flex items-center gap-0.5"><MessageSquare size={9}/>{listing._count.proposals}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-600 border-t border-border/40 pt-1.5">
              <span>{listing.player.displayName}</span>
              <span className="flex items-center gap-0.5"><Clock size={8}/> {daysLeft}d</span>
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
