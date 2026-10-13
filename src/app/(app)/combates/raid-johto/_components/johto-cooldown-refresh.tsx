"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function JohtoCooldownRefresh({ until }: { until: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!until) return;
    const left = new Date(until).getTime() - Date.now();
    if (left <= 0) { router.refresh(); return; }
    const timer = window.setTimeout(() => router.refresh(), left + 50);
    return () => window.clearTimeout(timer);
  }, [router, until]);
  return null;
}
