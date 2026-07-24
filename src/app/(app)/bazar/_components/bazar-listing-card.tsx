"use client";

import Link from "next/link";
import { Coins, Heart, MessageSquare, Clock, Gavel } from "lucide-react";
import { getMascotRarity, getSpriteUrl, RARITY_COLOR, RARITY_LABEL } from "@/lib/mascot-data";
import { getShopItemEmoji } from "@/lib/shop-config";

const CATEGORY_LABEL: Record<string, string> = {
  MASCOT: "Mascote", ITEM: "Item", COSMETIC: "Cosmético",
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

interface Listing {
  id: string;
  category: string;
  listingType: string;
  status: string;
  payload: Record<string, unknown>;
  priceCoins: number | null;
  description: string | null;
  loanEnabled?: boolean;
  loanAmountCoins?: number | null;
  loanInterestPct?: number | null;
  expiresAt: Date;
  createdAt: Date;
  player: { id: string; displayName: string };
  _count: { proposals: number; favorites: number };
  // Auction fields
  minBidCoins?: number | null;
  currentBidCoins?: number | null;
  auctionEndsAt?: Date | null;
}

export function BazarListingCard({ listing }: { listing: Listing }) {
  const isAuction = listing.listingType === "AUCTION";
  const type = LISTING_TYPE_LABEL[listing.listingType] ?? LISTING_TYPE_LABEL.SALE;
  const payload = listing.payload as Record<string, unknown>;
  const daysLeft = Math.max(0, Math.ceil((new Date(listing.expiresAt).getTime() - Date.now()) / 86400000));
  const auctionEnd = listing.auctionEndsAt ? new Date(listing.auctionEndsAt) : null;
  const mascotRarity = listing.category === "MASCOT" ? getMascotRarity(Number(payload.pokemonId)) : null;
  const mascotRarityLabel = mascotRarity ? (RARITY_LABEL[mascotRarity] || "Comum") : null;

  return (
    <Link href={`/bazar/${listing.id}`}
      className={`flex flex-col rounded-xl border bg-slate-950/60 hover:border-slate-600 transition-all overflow-hidden group ${isAuction ? "border-amber-500/30 hover:border-amber-400/50" : "border-border"}`}>

      {/* Preview */}
      <div className="flex items-center justify-center bg-slate-900/80 h-32 relative">
        {listing.category === "MASCOT" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getSpriteUrl(payload.pokemonId as number, true)}
              alt={(payload.nickname as string) ?? (payload.pokemonName as string)}
              className="h-24 object-contain group-hover:scale-110 transition-transform"
              style={{ imageRendering: "pixelated" }}
              onError={e => { (e.target as HTMLImageElement).src = getSpriteUrl(payload.pokemonId as number); }}
            />
            <div className="absolute bottom-1 right-1 rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold text-[#FFCB05]">
              Nv.{payload.level as number}
            </div>
            {mascotRarity && mascotRarityLabel && (
              <div className={`absolute top-1.5 right-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${RARITY_COLOR[mascotRarity] || "border-slate-500/40 bg-slate-800/80 text-slate-300"}`}>
                {mascotRarityLabel}
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
        {listing.loanEnabled && listing.loanAmountCoins && (
          <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-1.5 text-[10px] text-cyan-100">
            Empréstimo: {listing.loanAmountCoins.toLocaleString("pt-BR")} ZC · {listing.loanInterestPct ?? 0}% juros
          </div>
        )}
        <div>
          <p className="font-semibold text-white text-sm truncate">
            {listing.category === "MASCOT"
              ? (payload.nickname as string) ?? (payload.pokemonName as string)
              : payload.displayName as string}
          </p>
          <p className="text-[10px] text-slate-500">
            {CATEGORY_LABEL[listing.category]}
            {listing.category === "MASCOT" && ` · ${payload.pokemonName as string}`}
          </p>
        </div>

        {listing.description && (
          <p className="text-[11px] text-slate-400 line-clamp-2">{listing.description}</p>
        )}

        {isAuction ? (
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
              {listing.priceCoins ? (
                <span className="flex items-center gap-1 text-sm font-bold text-[#FFCB05]">
                  <Coins size={13}/> {listing.priceCoins.toLocaleString("pt-BR")} ZC
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
