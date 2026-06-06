"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const WATCHED_TABLES = [
  "bazar_listings",
  "bazar_proposals",
  "bazar_transactions",
  "miauvadao_config",
] as const;

export function BazarLiveRefresh() {
  const router = useRouter();
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 6,
        },
      },
    });

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        router.refresh();
      }, 450);
    };

    const channel = WATCHED_TABLES.reduce(
      (currentChannel, table) =>
        currentChannel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          scheduleRefresh,
        ),
      supabase.channel("bazar-live-refresh"),
    );

    channel.subscribe();

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
