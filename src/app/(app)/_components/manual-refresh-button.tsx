"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, useState, useEffect, useRef } from "react";

const COOLDOWN_MS = 5000;

export function ManualRefreshButton({ label = "Atualizar multiplayer" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cooldownMs, setCooldownMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setCooldownMs(COOLDOWN_MS);
    intervalRef.current = setInterval(() => {
      setCooldownMs(prev => {
        if (prev <= 100) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 100;
      });
    }, 100);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const disabled = pending || cooldownMs > 0;
  const secondsLeft = Math.ceil(cooldownMs / 1000);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        startTransition(() => router.refresh());
        startCooldown();
      }}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-2 text-xs font-bold text-[#FFCB05] shadow-[0_0_18px_rgba(255,203,5,0.12)] transition hover:bg-[#FFCB05]/20 disabled:opacity-50 disabled:cursor-not-allowed"
      title={cooldownMs > 0 ? `Aguarde ${secondsLeft}s` : "Busca o estado mais recente."}
    >
      <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
      {pending ? "Atualizando..." : cooldownMs > 0 ? `Aguarde ${secondsLeft}s` : label}
    </button>
  );
}
