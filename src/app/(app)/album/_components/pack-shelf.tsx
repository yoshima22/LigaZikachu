"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Coins, Package, Sparkles, Star } from "lucide-react";
import { openStickerPack, type PackOpenResult } from "../actions";

const RARITY_COLORS: Record<string, string> = {
  COMMON:    "border-slate-600 bg-slate-800/50 text-slate-400",
  UNCOMMON:  "border-[#7AC74C]/50 bg-[#7AC74C]/10 text-[#7AC74C]",
  RARE:      "border-[#6390F0]/50 bg-[#6390F0]/10 text-[#6390F0]",
  EPIC:      "border-[#735797]/60 bg-[#735797]/15 text-[#735797]",
  LEGENDARY: "border-[#FFCB05]/60 bg-[#FFCB05]/15 text-[#FFCB05]"
};
const RARITY_LABELS: Record<string, string> = {
  COMMON: "Comum", UNCOMMON: "Incomum", RARE: "Rara", EPIC: "Épica", LEGENDARY: "Lendária"
};

interface Pack {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cardCount: number;
  generation: number | null;
  rarityBoost: boolean;
}

interface Props {
  packs: Pack[];
  balance: number;
  isLoggedIn: boolean;
}

export function PackShelf({ packs, balance, isLoggedIn }: Props) {
  const [pending, startTransition] = useTransition();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [result, setResult] = useState<PackOpenResult | null>(null);

  const handleOpen = (packId: string, packName: string, price: number) => {
    if (!isLoggedIn) { toast.error("Faça login para abrir pacotes."); return; }
    if (balance < price) { toast.error(`Saldo insuficiente. Você tem ${balance} ZC.`); return; }
    if (!confirm(`Abrir "${packName}" por ${price} ZikaCoins?`)) return;

    setOpeningId(packId);
    startTransition(async () => {
      try {
        const res = await openStickerPack(packId);
        if (res.error) { toast.error(res.error); return; }
        setResult(res);
      } catch { toast.error("Erro ao abrir pacote."); }
      finally { setOpeningId(null); }
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-slate-200 flex items-center gap-2">
        <Package size={16} className="text-[#FFCB05]" />
        Pacotes Disponíveis
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {packs.map((pack) => {
          const canAfford = balance >= pack.price;
          const isOpening = openingId === pack.id && pending;

          return (
            <div key={pack.id} className={`rounded-xl border bg-slate-950/60 p-4 space-y-3 ${
              pack.rarityBoost ? "border-[#FFCB05]/30 bg-gradient-to-b from-[#FFCB05]/5 to-transparent" : "border-border"
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{pack.name}</p>
                  {pack.description && <p className="text-xs text-slate-400 mt-0.5">{pack.description}</p>}
                </div>
                {pack.rarityBoost && <Sparkles size={16} className="shrink-0 text-[#FFCB05]" />}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span>{pack.cardCount} figurinhas</span>
                {pack.generation && <span>· Geração {pack.generation}</span>}
                {pack.rarityBoost && <span className="text-[#FFCB05]">· Boost de raridade</span>}
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-bold text-[#FFCB05]">
                  <Coins size={14} /> {pack.price.toLocaleString("pt-BR")} ZC
                </span>
                <button
                  type="button"
                  disabled={isOpening || !canAfford || !isLoggedIn}
                  onClick={() => handleOpen(pack.id, pack.name, pack.price)}
                  className="rounded-lg bg-[#FFCB05] px-3 py-1.5 text-xs font-semibold text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50"
                >
                  {isOpening ? "Abrindo…" : canAfford ? "Abrir" : "Sem saldo"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de resultado */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#FFCB05]/30 bg-[#0f0f1a] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-pixel text-sm text-[#FFCB05]">Pacote Aberto!</h3>
              <button type="button" onClick={() => setResult(null)} className="text-slate-400 hover:text-white text-xs">
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {result.cards.map((card, idx) => (
                <div key={idx} className={`rounded-xl border p-2 text-center space-y-1 ${RARITY_COLORS[card.rarity]}`}>
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.imageUrl} alt={card.displayName} className="w-full aspect-square object-contain" />
                  ) : (
                    <div className="aspect-square flex items-center justify-center text-xs text-slate-500">?</div>
                  )}
                  <p className="text-[9px] font-semibold truncate">{card.displayName}</p>
                  <p className="text-[9px]">{RARITY_LABELS[card.rarity]}</p>
                  {card.isDuplicate && (
                    <p className="text-[9px] text-[#FFCB05]">
                      Duplicata +{card.coinsEarned}ZC
                    </p>
                  )}
                </div>
              ))}
            </div>

            {result.totalCoinsEarned > 0 && (
              <p className="text-center text-sm text-[#FFCB05]">
                <Coins size={14} className="inline mr-1" />
                +{result.totalCoinsEarned} ZikaCoins por duplicatas!
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-border py-2 text-sm text-slate-300 hover:bg-white/5"
                onClick={() => setResult(null)}
              >
                Ver coleção
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
