"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TickerEvent = {
  id: string;
  type: string;
  message: string;
  href: string | null;
  priority: number;
  createdAt: string;
};

export function LeagueTicker({ initialEvents }: { initialEvents: TickerEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (events.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % events.length), 14_000);
    return () => window.clearInterval(timer);
  }, [events.length]);

  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const response = await fetch("/api/league-ticker", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const payload = await response.json().catch(() => null) as { events?: TickerEvent[] } | null;
      if (!payload?.events) return;
      setEvents(payload.events);
      setIndex((current) => payload.events!.length ? current % payload.events!.length : 0);
    };
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (events.length === 0) return null;
  const current = events[index % events.length];
  const text = (
    <span key={current.id} className="professor-ticker-text inline-block whitespace-nowrap font-semibold text-amber-50">
      <span className="mr-2 text-[#FFCB05]">Professor Enguiça informa:</span>
      {current.message}
    </span>
  );

  return (
    <div className="border-t border-cyan-400/20 bg-gradient-to-r from-[#0b1220] via-[#10253a] to-[#0b1220]">
      <div className="mx-auto flex h-12 max-w-7xl items-center overflow-hidden px-3 sm:px-6">
        <div className="relative z-10 mr-3 h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 border-[#FFCB05]/70 bg-slate-800 shadow-[0_0_16px_rgba(255,203,5,0.25)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/professor-enguica-notification.webp" alt="Professor Enguiça" className="h-full w-full object-cover" />
        </div>
        <div className="relative min-w-0 flex-1 overflow-hidden text-xs sm:text-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#10253a] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#10253a] to-transparent" />
          {current.href ? <Link href={current.href}>{text}</Link> : text}
        </div>
        <span className="ml-2 shrink-0 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-200">
          ao vivo
        </span>
      </div>
      <style jsx global>{`
        .professor-ticker-text {
          padding-left: 100%;
          animation: professor-ticker-scroll 13s linear both;
        }
        @keyframes professor-ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .professor-ticker-text {
            padding-left: 0;
            animation: none;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
