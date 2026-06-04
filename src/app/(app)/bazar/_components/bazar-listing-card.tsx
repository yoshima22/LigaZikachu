"use client";

import Link from "next/link";
import { Coins, Heart, MessageSquare, Clock } from "lucide-react";
import { getSpriteUrl } from "@/lib/mascot-data";

const CATEGORY_LABEL: Record<string, string> = {
  MASCOT: "Mascote", ITEM: "Item", COSMETIC: "Cosmético",
};
const LISTING_TYPE_LABEL: Record<string, { label: string; color: string }> = {
  SALE:         { label: "Venda",       color: "text-green-400 border-green-500/30 bg-green-500/10" },
  TRADE:        { label: "Troca",       color: "text-blue-400  border-blue-500/30  bg-blue-500/10" },
  SALE_OR_TRADE:{ label: "Venda/Troca", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
};
const ITEM_EMOJI: Record<string, string> = {
  COMMON: "🥚", RARE: "💙", SPECIAL: "💜", EVENT: "⭐",
  EGG_GEN1:"1️⃣", EGG_GEN2:"2️⃣", EGG_GEN3:"3️⃣", EGG_GEN4:"4️⃣", EGG_GEN5:"5️⃣",
  EGG_GEN6:"6️⃣", EGG_GEN7:"7️⃣", EGG_GEN8:"8️⃣", EGG_GEN9:"9️⃣",
  FOOD:"🍖", SWEET:"🍬",
  MASCOT_BUFF_EXP:"⚡", MASCOT_BUFF_STAT:"💊", MASCOT_BUFF_HAPPY:"🍯",
  MASCOT_BUFF_LUCK:"🍀", MASCOT_BUFF_MOOD:"💧",
};

interface Listing {
  id: string;
  category: string;
  listingType: string;
  status: string;
  payload: Record<string, unknown>;
  priceCoins: number | null;
  description: string | null;
  expiresAt: Date;
  createdAt: Date;
  player: { id: string; displayName: string };
  _count: { proposals: number; favorites: number };
}

export function BazarListingCard({ listing }: { listing: Listing }) {
  const type = LISTING_TYPE_LABEL[listing.listingType] ?? LISTING_TYPE_LABEL.SALE;
  const payload = listing.payload as Record<string, unknown>;
  const daysLeft = Math.max(0, Math.ceil((new Date(listing.expiresAt).getTime() - Date.now()) / 86400000));

  return (
    <Link href={`/bazar/${listing.id}`}
      className="flex flex-col rounded-xl border border-border bg-slate-950/60 hover:border-slate-600 transition-all overflow-hidden group">

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
          </>
        ) : (
          <span className="text-5xl">
            {ITEM_EMOJI[(payload.itemType as string)] ?? "📦"}
          </span>
        )}
        {/* Type badge */}
        <div className={`absolute top-1.5 left-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold ${type.color}`}>
          {type.label}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2 flex-1">
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
      </div>
    </Link>
  );
}
