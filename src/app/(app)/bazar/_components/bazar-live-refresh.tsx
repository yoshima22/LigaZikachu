"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function BazarLiveRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let lastRefresh = Date.now();

    const refresh = () => {
      if (cancelled || document.hidden) return;
      lastRefresh = Date.now();
      router.refresh();
    };

    const interval = window.setInterval(refresh, intervalMs);
    const onVisibility = () => {
      if (!document.hidden && Date.now() - lastRefresh > 3000) refresh();
    };

    window.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
