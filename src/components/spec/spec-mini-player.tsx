"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { youtubeEmbedUrl } from "@/lib/spec/constants";
import { SpecPlayer } from "./spec-player";
import { SpecPlayerP2P } from "./spec-player-p2p";

export type SpecMiniPlayerData = {
  streamId: string;
  title: string;
  provider: string;
  broadcasterUserId: string;
  youtubeVideoId?: string | null;
};

const STORAGE_KEY = "zika-tv-current-stream";
const EVENT_NAME = "zika-tv-player-change";

export function rememberSpecStream(data: SpecMiniPlayerData) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: data }));
}

export function SpecMiniPlayer() {
  const pathname = usePathname();
  const [stream, setStream] = useState<SpecMiniPlayerData | null>(null);
  const [youtubeControls, setYoutubeControls] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        setStream(raw ? JSON.parse(raw) as SpecMiniPlayerData : null);
      } catch { setStream(null); }
    };
    const changed = (event: Event) => setStream((event as CustomEvent<SpecMiniPlayerData>).detail);
    load();
    window.addEventListener(EVENT_NAME, changed);
    return () => window.removeEventListener(EVENT_NAME, changed);
  }, []);

  if (!stream || pathname === `/spec/${stream.streamId}` || pathname.startsWith(`/spec/${stream.streamId}/`)) return null;

  const close = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setStream(null);
  };

  return (
    <aside className="fixed bottom-4 right-3 z-[70] flex h-[15rem] w-[min(22rem,calc(100vw-1.5rem))] min-h-[12rem] min-w-[18rem] max-h-[80vh] max-w-[90vw] resize flex-col overflow-auto rounded-2xl border border-[#FFCB05]/40 bg-slate-950 shadow-2xl shadow-black/60">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <Link href={`/spec/${stream.streamId}`} className="min-w-0 flex-1 truncate text-xs font-black text-white" title="Voltar para a transmissão">
          {stream.title}
        </Link>
        <span className="text-[9px] text-slate-600" title="Arraste o canto inferior direito para redimensionar">↘</span>
        {stream.youtubeVideoId && <button onClick={() => setYoutubeControls((value) => !value)} className="rounded-md px-2 py-1 text-[9px] font-bold text-slate-400 hover:bg-white/10 hover:text-white">{youtubeControls ? "Ocultar controles" : "Controles"}</button>}
        <button onClick={close} aria-label="Fechar miniplayer" className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white">×</button>
      </div>
      <div className="min-h-0 flex-1 bg-black">
        {stream.youtubeVideoId ? (
          <iframe src={youtubeEmbedUrl(stream.youtubeVideoId)} title="Zika TV em miniplayer" className={`${youtubeControls ? "" : "pointer-events-none"} h-full w-full`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
        ) : stream.provider === "p2p-mesh" ? (
          <SpecPlayerP2P streamId={stream.streamId} broadcasterUserId={stream.broadcasterUserId} compact />
        ) : (
          <SpecPlayer streamId={stream.streamId} compact />
        )}
      </div>
    </aside>
  );
}

export function SpecMiniPlayerActivator({ data }: { data: SpecMiniPlayerData }) {
  useEffect(() => { rememberSpecStream(data); }, [data]);
  return null;
}
