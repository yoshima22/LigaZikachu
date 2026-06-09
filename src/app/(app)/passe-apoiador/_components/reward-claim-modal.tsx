"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Star, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClaimResult } from "../actions";

interface Props {
  result: ClaimResult;
  onClose: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#94a3b8",
  UNCOMMON: "#4ade80",
  RARE: "#60a5fa",
  EPIC: "#c084fc",
  LEGENDARY: "#FFCB05",
};

export function RewardClaimModal({ result, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !result.ok || !result.reward) return null;

  const r = result.reward;
  const stickers = result.stickerResult;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl border border-border bg-slate-900 p-6 max-w-md w-full space-y-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="text-center space-y-1">
          <span className="text-4xl">{r.emoji}</span>
          <p className="text-xs text-yellow-400/70 uppercase tracking-widest font-semibold mt-2">Dia {r.day} resgatado!</p>
          <h2 className="text-base font-bold text-white">{r.label}</h2>
        </div>

        {/* Sticker pack results */}
        {stickers && stickers.cards.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">Figurinhas recebidas</p>
            <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {stickers.cards.map((card, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: RARITY_COLORS[card.rarity] + "44", background: RARITY_COLORS[card.rarity] + "11" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {card.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.imageUrl} alt={card.displayName} className="w-7 h-7 rounded object-contain" />
                    )}
                    <div className="min-w-0">
                      <p className="text-slate-200 font-medium truncate">{card.displayName}</p>
                      <p className="text-xs" style={{ color: RARITY_COLORS[card.rarity] }}>{card.rarity}</p>
                    </div>
                  </div>
                  {card.isDuplicate && (
                    <div className="flex items-center gap-1 text-xs text-yellow-400 shrink-0">
                      <Coins size={10} />
                      +{card.coinsEarned}
                    </div>
                  )}
                  {!card.isDuplicate && (
                    <span className="text-xs text-green-400 shrink-0">Nova!</span>
                  )}
                </div>
              ))}
            </div>
            {stickers.totalCoinsEarned > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-950/20 border border-yellow-400/20 px-3 py-2 text-sm">
                <Star size={12} className="text-yellow-400" />
                <span className="text-yellow-300">{stickers.totalCoinsEarned} ZikaCoins por duplicatas</span>
              </div>
            )}
          </div>
        )}

        <Button onClick={onClose} className="w-full">
          Fechar
        </Button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
