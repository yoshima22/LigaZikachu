"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STALE_MS = 30_000;

/** Ao voltar para a aba depois de um tempo, recarrega o estado (feridos, disponíveis, cooldown). */
export function JohtoFocusRefresh() {
  const router = useRouter();
  useEffect(() => {
    let lastRun = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRun < STALE_MS) return;
      lastRun = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);
  return null;
}
