"use client";

import { useEffect, useState } from "react";
import { Coins, RefreshCw } from "lucide-react";

interface Props {
  teamId: string;
  initialCoins: number;
  initialExp: number;
  initialFood: number;
  initialSweet: number;
  initialMultiplier: number;
}

function fmt(loot: { coins: number; exp: number; food: number; sweet: number }) {
  const parts = [`${loot.coins} ZC`, `${loot.exp} EXP`];
  if (loot.food > 0) parts.push(`${loot.food} comida`);
  if (loot.sweet > 0) parts.push(`${loot.sweet} doce`);
  return parts.join(" · ");
}

function timeSince(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 5) return "agora";
  if (diff < 60) return `${diff}s atras`;
  return `${Math.floor(diff / 60)}min atras`;
}

export function PvpVaultLive({
  teamId,
  initialCoins,
  initialExp,
  initialFood,
  initialSweet,
  initialMultiplier,
}: Props) {
  const [updatedAt] = useState(Date.now());
  const [sinceUpdate, setSinceUpdate] = useState("agora");
  const projectedCoins = Math.floor(initialCoins * initialMultiplier);
  const stolen30 = Math.floor(projectedCoins * 0.30);
  const multBonus = initialMultiplier > 1;

  useEffect(() => {
    const timer = setInterval(() => setSinceUpdate(timeSince(updatedAt)), 5_000);
    setSinceUpdate(timeSince(updatedAt));
    return () => clearInterval(timer);
  }, [updatedAt]);

  return (
    <div data-team-id={teamId} className="mt-3 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[#FFCB05]">
          <Coins size={11} />
          <span className="font-semibold">Cofre atual:</span>
          <span>{fmt({ coins: initialCoins, exp: initialExp, food: initialFood, sweet: initialSweet })}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <RefreshCw size={8} />
          snapshot {sinceUpdate}
        </div>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-2 py-1">
          <p className="font-semibold text-green-400">Se vencer</p>
          <p className="text-slate-300">
            +{stolen30} ZC{multBonus ? ` (x${initialMultiplier})` : ""}
            {initialFood > 0 || initialSweet > 0 ? " + itens" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1">
          <p className="font-semibold text-red-400">Se perder</p>
          <p className="text-slate-300">Seus mascotes ficam feridos</p>
        </div>
      </div>
    </div>
  );
}
