"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavoriteSticker } from "../actions";

const RARITY_COLORS: Record<string, string> = {
  COMMON:    "border-slate-700",
  UNCOMMON:  "border-[#7AC74C]/50",
  RARE:      "border-[#6390F0]/50",
  EPIC:      "border-[#735797]/60",
  LEGENDARY: "border-[#FFCB05]/60"
};
const RARITY_GLOW: Record<string, string> = {
  COMMON:    "",
  UNCOMMON:  "",
  RARE:      "shadow-[0_0_12px_rgba(99,144,240,0.2)]",
  EPIC:      "shadow-[0_0_15px_rgba(115,87,151,0.3)]",
  LEGENDARY: "shadow-[0_0_20px_rgba(255,203,5,0.3)]"
};

interface Card {
  id: string;
  nationalId: number;
  displayName: string;
  imageUrl: string | null;
  rarity: string;
  generation: number;
  types: string[];
}

interface OwnedInfo {
  cardId: string;
  quantity: number;
  isFavorite: boolean;
}

interface Props {
  cards: Card[];
  ownedMap: Record<string, OwnedInfo>;
  generations: number[];
  selectedGen: number | null;
}

export function AlbumCollection({ cards, ownedMap, selectedGen }: Props) {
  const [pending, startTransition] = useTransition();
  const [favLoading, setFavLoading] = useState<string | null>(null);

  const handleFavorite = (cardId: string) => {
    setFavLoading(cardId);
    startTransition(async () => {
      try {
        const result = await toggleFavoriteSticker(cardId);
        if (result.error) toast.error(result.error);
      } catch { toast.error("Erro ao atualizar favorito."); }
      finally { setFavLoading(null); }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-200">
          {selectedGen ? `Geração ${selectedGen}` : "Todos os Pokémon"}
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({Object.keys(ownedMap).filter((id) => cards.some((c) => c.id === id)).length}/{cards.length})
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
        {cards.map((card) => {
          const owned = ownedMap[card.id];
          const isDuplicate = owned && owned.quantity > 1;

          return (
            <div
              key={card.id}
              className={`relative rounded-xl border bg-slate-950/60 overflow-hidden transition-all ${
                owned ? `${RARITY_COLORS[card.rarity]} ${RARITY_GLOW[card.rarity]}` : "border-slate-800 opacity-40 grayscale"
              }`}
            >
              <div className="aspect-square relative">
                {owned && card.imageUrl ? (
                  <Image
                    src={card.imageUrl}
                    alt={card.displayName}
                    fill
                    className="object-contain p-1"
                    sizes="120px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="font-pixel text-xs text-slate-600">#{String(card.nationalId).padStart(3, "0")}</p>
                  </div>
                )}

                {isDuplicate && (
                  <span className="absolute right-1 top-1 rounded-full bg-slate-900/80 px-1 text-[9px] font-bold text-[#FFCB05]">
                    ×{owned.quantity}
                  </span>
                )}

                {owned && (
                  <button
                    type="button"
                    disabled={pending && favLoading === card.id}
                    onClick={() => handleFavorite(card.id)}
                    className="absolute bottom-1 right-1 text-slate-600 hover:text-[#FFCB05] transition-colors"
                  >
                    <Star
                      size={12}
                      className={owned.isFavorite ? "fill-[#FFCB05] text-[#FFCB05]" : ""}
                    />
                  </button>
                )}
              </div>
              <div className="px-1 pb-1 text-center">
                <p className="truncate text-[9px] text-slate-300 leading-tight">
                  {owned ? card.displayName : `#${String(card.nationalId).padStart(3, "0")}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
