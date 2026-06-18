"use client";

import Image from "next/image";
import { Gift, Star, X } from "lucide-react";

function capitalize(str: string) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, " ");
}
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavoriteSticker, sendStickerGift } from "../actions";

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
  hasMascot?: boolean;
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
  approvedPlayers?: { id: string; displayName: string }[];
}

export function AlbumCollection({ cards, ownedMap, selectedGen, approvedPlayers = [] }: Props) {
  const [pending, startTransition] = useTransition();
  const [favLoading, setFavLoading] = useState<string | null>(null);
  const [giftCard, setGiftCard] = useState<Card | null>(null);
  const [giftTargetId, setGiftTargetId] = useState("");

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

  const handleSendGift = () => {
    if (!giftCard || !giftTargetId) { toast.error("Selecione um destinatário."); return; }
    startTransition(async () => {
      try {
        const result = await sendStickerGift(giftCard.id, giftTargetId);
        if (result.error) { toast.error(result.error); return; }
        toast.success(`${giftCard.displayName} enviada!`);
        setGiftCard(null);
        setGiftTargetId("");
      } catch { toast.error("Erro ao enviar."); }
    });
  };

  return (
    <>
    {/* Modal de enviar figurinha */}
    {giftCard && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-slate-900 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Enviar figurinha</h3>
            <button type="button" onClick={() => setGiftCard(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
          <p className="text-sm text-slate-400">
            Enviar <span className="font-semibold text-white">{giftCard.displayName}</span> para um colega via Caixa de Presentes.
          </p>
          <label className="space-y-1 text-xs text-slate-400 block">
            <span>Destinatário</span>
            <select value={giftTargetId} onChange={(e) => setGiftTargetId(e.target.value)}
              className="w-full rounded-lg border border-border bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#FFCB05]">
              <option value="">Selecione</option>
              {approvedPlayers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <button type="button" disabled={!giftTargetId || pending} onClick={handleSendGift}
              className="flex-1 rounded-lg bg-[#FFCB05] py-2 text-sm font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">
              Enviar
            </button>
            <button type="button" onClick={() => setGiftCard(null)} className="flex-1 rounded-lg border border-border py-2 text-sm text-slate-300">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}

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
          const discoveredByMascot = Boolean(card.hasMascot);
          const visible = Boolean(owned || discoveredByMascot);

          return (
            <div
              key={card.id}
              className={`relative rounded-xl border bg-slate-950/60 overflow-hidden transition-all ${
                owned
                  ? `${RARITY_COLORS[card.rarity]} ${RARITY_GLOW[card.rarity]}`
                  : discoveredByMascot
                    ? "border-cyan-400/40 bg-cyan-950/10 opacity-85"
                    : "border-slate-800 opacity-40 grayscale"
              }`}
            >
              {/* Número da Pokédex */}
              <p className="px-1 pt-1 text-center text-[9px] font-semibold text-slate-500">
                #{String(card.nationalId).padStart(3, "0")}
              </p>

              <div className="aspect-square relative">
                {visible && card.imageUrl ? (
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
                    <p className="font-pixel text-[10px] text-slate-600">?</p>
                  </div>
                )}

                {discoveredByMascot && !owned && (
                  <span className="absolute right-1 top-1 rounded-full border border-cyan-400/40 bg-cyan-400/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-cyan-200">
                    Mascote
                  </span>
                )}

                {owned && (
                  <button
                    type="button"
                    disabled={pending && favLoading === card.id}
                    onClick={() => handleFavorite(card.id)}
                    className="absolute bottom-1 left-1 text-slate-600 hover:text-[#FFCB05] transition-colors"
                  >
                    <Star size={13} className={owned.isFavorite ? "fill-[#FFCB05] text-[#FFCB05]" : ""} />
                  </button>
                )}

                {isDuplicate && (
                  <button
                    type="button"
                    title={`Enviar duplicata (×${owned.quantity})`}
                    onClick={() => { setGiftCard(card); setGiftTargetId(""); }}
                    className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full bg-[#FFCB05]/20 border border-[#FFCB05]/40 px-1.5 py-0.5 text-[9px] font-bold text-[#FFCB05] hover:bg-[#FFCB05]/40"
                  >
                    ×{owned.quantity} <Gift size={10} />
                  </button>
                )}
              </div>
              <div className="px-1 pb-1 text-center">
                <p className="truncate text-[9px] text-slate-300 leading-tight">
                  {visible ? capitalize(card.displayName) : "???"}
                </p>
                {owned && discoveredByMascot && (
                  <p className="mt-0.5 truncate text-[8px] text-cyan-300">Figurinha + mascote</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}
