"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeSignal } from "@/hooks/use-realtime-signal";

/**
 * Recarrega a página (router.refresh) quando o servidor sinaliza `event` em
 * `topic`. `match` restringe a sinais cujo payload tenha esses valores (um valor
 * nulo no payload vale para todos). Um pequeno atraso aleatório evita que todo
 * mundo bata no servidor no mesmo milissegundo; sinais em rajada viram 1 refresh.
 * Aba oculta: o refresh acontece quando o jogador volta.
 */
export function RealtimeRefresh({ topic, event, match, maxJitterMs = 1500, minIntervalMs = 0 }: {
  topic: string;
  event: string;
  match?: Record<string, string>;
  maxJitterMs?: number;
  /** Intervalo mínimo entre refreshes (rajadas de compras viram no máximo 1 a cada X ms). */
  minIntervalMs?: number;
}) {
  const router = useRouter();
  const timerRef = useRef<number | null>(null);
  const staleRef = useRef(false);
  const lastRunRef = useRef(0);

  useRealtimeSignal(topic, (name, payload) => {
    if (name !== event) return;
    if (match && !Object.entries(match).every(([key, value]) => payload[key] == null || payload[key] === value)) return;
    if (document.visibilityState !== "visible") {
      staleRef.current = true;
      return;
    }
    if (timerRef.current !== null) return;
    const wait = Math.max(Math.random() * maxJitterMs, lastRunRef.current + minIntervalMs - Date.now());
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      lastRunRef.current = Date.now();
      router.refresh();
    }, wait);
  });

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && staleRef.current) {
        staleRef.current = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [router]);

  return null;
}
