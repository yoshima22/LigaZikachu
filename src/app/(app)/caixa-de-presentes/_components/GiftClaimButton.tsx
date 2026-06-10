"use client";

import { useState, useTransition } from "react";
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimGift, claimAllGifts } from "../actions";

interface AutoSoldInfo {
  itemName: string;
  coins: number;
}

function AutoSoldModal({ info, onClose }: { info: AutoSoldInfo; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[#FFCB05]/30 bg-[#1A1A2E] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <span className="text-4xl">📡💰</span>
          <h2 className="text-base font-bold text-[#FFCB05]">Item único já possuído</h2>
          <p className="text-sm text-slate-300">
            Você já possui <strong className="text-white">{info.itemName}</strong>. Como é um
            item único por jogador, o exemplar extra foi automaticamente convertido em{" "}
            <strong className="text-[#FFCB05]">{info.coins.toLocaleString("pt-BR")} ZikaCoins</strong>{" "}
            (metade do preço de loja).
          </p>
          <p className="text-xs text-slate-500">
            Os ZC já foram creditados na sua carteira.
          </p>
        </div>
        <Button onClick={onClose} className="w-full bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
          Entendido
        </Button>
      </div>
    </div>
  );
}

function AutoSoldListModal({ items, onClose }: { items: AutoSoldInfo[]; onClose: () => void }) {
  const total = items.reduce((acc, i) => acc + i.coins, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[#FFCB05]/30 bg-[#1A1A2E] p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <span className="text-4xl">📡💰</span>
          <h2 className="text-base font-bold text-[#FFCB05]">Itens únicos convertidos</h2>
          <p className="text-sm text-slate-300">
            Alguns itens que você recebeu já estavam no seu inventário. Como são itens únicos,
            foram automaticamente vendidos:
          </p>
          <ul className="w-full space-y-1 text-left">
            {items.map((item, i) => (
              <li key={i} className="flex justify-between text-sm rounded-lg bg-slate-900/50 px-3 py-2">
                <span className="text-slate-200">{item.itemName}</span>
                <span className="text-[#FFCB05] font-semibold">+{item.coins.toLocaleString("pt-BR")} ZC</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Total: <strong className="text-[#FFCB05]">{total.toLocaleString("pt-BR")} ZC</strong> creditados na sua carteira.
          </p>
        </div>
        <Button onClick={onClose} className="w-full bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]">
          Entendido
        </Button>
      </div>
    </div>
  );
}

export function GiftClaimButton({ giftId }: { giftId: string }) {
  const [isPending, startTransition] = useTransition();
  const [autoSold, setAutoSold] = useState<AutoSoldInfo | null>(null);

  const handleClaim = () => {
    startTransition(async () => {
      const result = await claimGift({ giftId });
      if (result.autoSold) setAutoSold(result.autoSold);
    });
  };

  return (
    <>
      {autoSold && <AutoSoldModal info={autoSold} onClose={() => setAutoSold(null)} />}
      <Button onClick={handleClaim} disabled={isPending} className="w-full">
        {isPending ? "Resgatando..." : "Receber presente"}
      </Button>
    </>
  );
}

export function ClaimAllGiftsButton({ playerId, count }: { playerId: string; count: number }) {
  const [isPending, startTransition] = useTransition();
  const [autoSolds, setAutoSolds] = useState<AutoSoldInfo[] | null>(null);

  const handleClaimAll = () => {
    startTransition(async () => {
      const result = await claimAllGifts({ playerId });
      if (result.autoSolds && result.autoSolds.length > 0) setAutoSolds(result.autoSolds);
    });
  };

  return (
    <>
      {autoSolds && autoSolds.length > 0 && (
        <AutoSoldListModal items={autoSolds} onClose={() => setAutoSolds(null)} />
      )}
      <Button
        onClick={handleClaimAll}
        disabled={isPending}
        className="bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
      >
        <PackageOpen size={16} className="mr-2" />
        {isPending ? "Recebendo..." : `Receber todos (${count})`}
      </Button>
    </>
  );
}
