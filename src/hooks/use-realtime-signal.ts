"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

type Listener = (event: string, payload: Record<string, unknown>) => void;
type Entry = { channel: RealtimeChannel; listeners: Set<Listener>; statusListeners: Set<(ok: boolean) => void>; ok: boolean; removeTimer?: number };

// Um único WebSocket por aba. O supabase-js reaproveita o canal de mesmo tópico,
// então o registro conta quantos componentes usam cada tópico antes de removê-lo.
let client: SupabaseClient | null = null;
const entries = new Map<string, Entry>();

function getClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return client;
}

function subscribe(topic: string, listener: Listener, onStatus: (ok: boolean) => void) {
  const supabase = getClient();
  if (!supabase) return () => {};
  let entry = entries.get(topic);
  if (!entry) {
    const created: Entry = { channel: supabase.channel(topic), listeners: new Set(), statusListeners: new Set(), ok: false };
    created.channel
      .on("broadcast", { event: "*" }, (msg) => {
        for (const fn of created.listeners) fn(msg.event, (msg.payload ?? {}) as Record<string, unknown>);
      })
      .subscribe((status) => {
        created.ok = status === "SUBSCRIBED";
        for (const fn of created.statusListeners) fn(created.ok);
      });
    entries.set(topic, created);
    entry = created;
  }
  // Troca de página/remontagem: reaproveita o canal em vez de fechar e reabrir.
  if (entry.removeTimer !== undefined) {
    window.clearTimeout(entry.removeTimer);
    entry.removeTimer = undefined;
  }
  entry.listeners.add(listener);
  entry.statusListeners.add(onStatus);
  onStatus(entry.ok);
  const current = entry;
  return () => {
    current.listeners.delete(listener);
    current.statusListeners.delete(onStatus);
    if (current.listeners.size === 0) {
      current.removeTimer = window.setTimeout(() => {
        if (current.listeners.size > 0 || entries.get(topic) !== current) return;
        entries.delete(topic);
        void supabase.removeChannel(current.channel);
      }, 5_000);
    }
  };
}

/**
 * Escuta sinais enviados por signalRealtime() no servidor. Retorna true enquanto
 * o canal está conectado — quem tem polling de reserva pode desacelerá-lo, mas
 * nunca desligá-lo (o WebSocket pode cair sem avisar).
 */
export function useRealtimeSignal(topic: string | null | undefined, onSignal: Listener) {
  const handlerRef = useRef(onSignal);
  handlerRef.current = onSignal;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!topic) return;
    const unsubscribe = subscribe(topic, (event, payload) => handlerRef.current(event, payload), setConnected);
    return () => {
      unsubscribe();
      setConnected(false);
    };
  }, [topic]);
  return connected;
}
