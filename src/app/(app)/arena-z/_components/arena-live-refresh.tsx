"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { RefreshCw } from "lucide-react";

// IMPORTANTE: "mascots" foi removido intencionalmente.
// postgres_changes sem filtro envia a row completa de CADA update de mascote
// para todos os assinantes do canal — com batalhas PvE frequentes e 20+ usuários
// isso gera centenas de MB de egress Realtime por dia.
const WATCHED_TABLES = [
  "arena_teams",
  "arena_team_members",
  "arena_battles",
  "arena_ground_spoils",
] as const;

/**
 * Substitui o router.refresh() automático por um badge manual.
 * Antes: qualquer evento nas 5 tabelas disparava router.refresh() após 650ms,
 * recarregando toda a página (incluindo ~6 findMany pesados) para TODOS os usuários ativos.
 * Agora: mostra badge "Novidades" — o usuário clica para atualizar quando quiser.
 */
export function ArenaLiveRefresh() {
  const router = useRouter();
  const [hasUpdates, setHasUpdates] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { params: { eventsPerSecond: 1 } },
    });

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = () => {
      if (channel) return;
      const scheduleFlag = () => {
        if (document.visibilityState !== "visible") return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => setHasUpdates(true), 1500);
      };
      channel = WATCHED_TABLES.reduce(
        (ch, table) => ch.on("postgres_changes", { event: "*", schema: "public", table }, scheduleFlag),
        supabase.channel("arena-z-live-badge"),
      );
      channel.subscribe();
    };

    const unsubscribe = () => {
      if (!channel) return;
      void supabase.removeChannel(channel);
      channel = null;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") subscribe();
      else unsubscribe();
    };

    if (document.visibilityState === "visible") subscribe();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      unsubscribe();
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setHasUpdates(false);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1500);
  };

  if (!hasUpdates) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-slate-900/95 px-4 py-2.5 text-sm font-semibold text-blue-300 shadow-xl backdrop-blur-sm hover:bg-slate-800 transition-colors disabled:opacity-60"
      >
        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
        {refreshing ? "Atualizando…" : "⚔️ Há novidades na Arena"}
      </button>
    </div>
  );
}
