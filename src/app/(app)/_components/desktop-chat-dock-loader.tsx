"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  DESKTOP_CHAT_PREFERENCE_EVENT,
  readDesktopChatPreference,
} from "@/lib/desktop-chat-preference";

const DesktopChatDock = dynamic(
  () => import("./desktop-chat-dock").then((module) => module.DesktopChatDock),
  { ssr: false },
);

export function DesktopChatDockLoader({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    setEnabled(readDesktopChatPreference());
    const onPreference = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean }>).detail;
      const nextEnabled = detail?.enabled ?? readDesktopChatPreference();
      setEnabled(nextEnabled);
      if (!nextEnabled) setOpen(false);
    };
    window.addEventListener(DESKTOP_CHAT_PREFERENCE_EVENT, onPreference);
    return () => window.removeEventListener(DESKTOP_CHAT_PREFERENCE_EVENT, onPreference);
  }, []);

  if (!enabled) return null;
  if (open) return <DesktopChatDock onClose={() => setOpen(false)} onUnreadChange={setUnreadCount} />;

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed bottom-5 right-5 z-50 hidden items-center gap-2 rounded-full border border-[#FFCB05]/35 bg-[#1A1A2E] px-4 py-3 text-sm font-bold text-[#FFCB05] shadow-xl shadow-black/50 transition hover:-translate-y-0.5 hover:bg-[#25254a] lg:flex"
      aria-label="Abrir mensagens"
      title="Abrir mensagens"
    >
      <MessageCircle size={18} fill="currentColor" />
      <span>Mensagens</span>
      {unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
