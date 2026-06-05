"use client";

import { useState, useEffect, useRef } from "react";
import { Coins, RefreshCw } from "lucide-react";

interface VaultData {
  id: string;
  vaultCoins: number;
  vaultExp: number;
  vaultFood: number;
  vaultSweet: number;
  multiplier: number;
  memberCount: number;
  updatedAt: number;
}

interface Props {
  teamId: string;
  initialCoins: number;
  initialExp: number;
  initialFood: number;
  initialSweet: number;
  initialMultiplier: number;
  pollIntervalMs?: number; // padrão: 30s
}

function fmt(loot: { coins: number; exp: number; food: number; sweet: number }) {
  const parts = [`${loot.coins} ZC`, `${loot.exp} EXP`];
  if (loot.food > 0)  parts.push(`${loot.food} 🍖`);
  if (loot.sweet > 0) parts.push(`${loot.sweet} 🍬`);
  return parts.join(" · ");
}

function timeSince(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 5)  return "agora";
  if (diff < 60) return `${diff}s atrás`;
  return `${Math.floor(diff / 60)}min atrás`;
}

export function PvpVaultLive({
  teamId,
  initialCoins,
  initialExp,
  initialFood,
  initialSweet,
  initialMultiplier,
  pollIntervalMs = 30_000,
}: Props) {
  const [vault, setVault] = useState<VaultData>({
    id: teamId,
    vaultCoins: initialCoins,
    vaultExp: initialExp,
    vaultFood: initialFood,
    vaultSweet: initialSweet,
    multiplier: initialMultiplier,
    memberCount: 0,
    updatedAt: Date.now(),
  });
  const [changed, setChanged] = useState(false);
  const [sinceUpdate, setSinceUpdate] = useState("agora");
  const prevRef = useRef({ coins: initialCoins, exp: initialExp });

  // Polling
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/arena-z/pvp-vaults?ids=${teamId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: VaultData[] = await res.json();
        const v = data.find(d => d.id === teamId);
        if (!v) return;

        const didChange = v.vaultCoins !== prevRef.current.coins || v.vaultExp !== prevRef.current.exp;
        prevRef.current = { coins: v.vaultCoins, exp: v.vaultExp };
        setVault({ ...v, updatedAt: Date.now() });

        if (didChange) {
          setChanged(true);
          setTimeout(() => setChanged(false), 3000);
        }
      } catch { /* silencioso */ }
    };

    // Primeira atualização após 5s (deixa o servidor respirar)
    const firstTimer = setTimeout(poll, 5_000);
    const interval = setInterval(poll, pollIntervalMs);
    return () => { clearTimeout(firstTimer); clearInterval(interval); };
  }, [teamId, pollIntervalMs]);

  // Timer "atualizado há Xs"
  useEffect(() => {
    const t = setInterval(() => setSinceUpdate(timeSince(vault.updatedAt)), 5_000);
    setSinceUpdate(timeSince(vault.updatedAt));
    return () => clearInterval(t);
  }, [vault.updatedAt]);

  const multBonus = vault.multiplier > 1;
  const projectedCoins = Math.floor(vault.vaultCoins * vault.multiplier);
  const stolen30 = Math.floor(projectedCoins * 0.30);

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs transition-all duration-500 ${
      changed
        ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 shadow-[0_0_12px_rgba(255,203,5,0.2)]"
        : "border-[#FFCB05]/20 bg-[#FFCB05]/5"
    }`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[#FFCB05]">
          <Coins size={11} />
          <span className="font-semibold">Cofre atual:</span>
          <span className={`transition-all duration-500 ${changed ? "text-[#FFD700] font-bold scale-105" : ""}`}>
            {fmt({ coins: vault.vaultCoins, exp: vault.vaultExp, food: vault.vaultFood, sweet: vault.vaultSweet })}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-500">
          <RefreshCw size={8} className={changed ? "animate-spin text-[#FFCB05]" : ""} />
          {sinceUpdate}
        </div>
      </div>

      {/* Se vencer: você rouba 30% do cofre com multiplicador */}
      <div className="mt-1 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-2 py-1">
          <p className="text-green-400 font-semibold">Se vencer →</p>
          <p className="text-slate-300">
            +{stolen30} ZC{multBonus ? ` (×${vault.multiplier})` : ""}
            {vault.vaultFood > 0 || vault.vaultSweet > 0
              ? ` + itens`
              : ""}
          </p>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-1">
          <p className="text-red-400 font-semibold">Se perder →</p>
          <p className="text-slate-300">Seus mascotes ficam feridos</p>
        </div>
      </div>

      {changed && (
        <p className="mt-1 text-[10px] text-[#FFCB05] animate-pulse">
          ⚡ Cofre atualizado — o adversário teve atividade recente!
        </p>
      )}
    </div>
  );
}
