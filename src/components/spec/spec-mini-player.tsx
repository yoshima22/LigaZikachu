"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SpecPlayer } from "./spec-player";
import { SpecPlayerP2P } from "./spec-player-p2p";
import { SpecYoutubePlayer } from "./spec-youtube-player";
import { SPEC_BROADCAST_CONTROL_EVENT, SPEC_BROADCAST_CONTROL_KEY } from "./spec-broadcast-control";

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
  const [ownBroadcastActive, setOwnBroadcastActive] = useState(false);
  const [youtubeControls, setYoutubeControls] = useState(false);
  const [size, setSize] = useState({ width: 352, height: 240 });
  const dragRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

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

  useEffect(() => {
    const update = () => setOwnBroadcastActive(Boolean(localStorage.getItem(SPEC_BROADCAST_CONTROL_KEY)));
    const storage = (event: StorageEvent) => { if (event.key === SPEC_BROADCAST_CONTROL_KEY) update(); };
    update();
    window.addEventListener(SPEC_BROADCAST_CONTROL_EVENT, update);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(SPEC_BROADCAST_CONTROL_EVENT, update);
      window.removeEventListener("storage", storage);
    };
  }, []);

  useEffect(() => {
    const ended = (event: Event) => {
      if ((event as CustomEvent<{ streamId: string }>).detail?.streamId === stream?.streamId) close();
    };
    window.addEventListener("zika-tv-stream-ended", ended);
    return () => window.removeEventListener("zika-tv-stream-ended", ended);
  }, [stream?.streamId]);

  if (ownBroadcastActive || !stream || pathname === `/spec/${stream.streamId}` || pathname.startsWith(`/spec/${stream.streamId}/`)) return null;

  const close = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setStream(null);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragRef.current = { x: event.clientX, y: event.clientY, width: size.width, height: size.height };
    const move = (pointer: PointerEvent) => {
      const start = dragRef.current;
      if (!start) return;
      setSize({
        width: Math.max(280, Math.min(window.innerWidth * 0.9, start.width + start.x - pointer.clientX)),
        height: Math.max(190, Math.min(window.innerHeight * 0.8, start.height + start.y - pointer.clientY)),
      });
    };
    const stop = () => { dragRef.current = null; window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <aside style={{ width: size.width, height: size.height }} className="fixed bottom-4 right-3 z-[70] flex max-h-[80vh] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-[#FFCB05]/40 bg-slate-950 shadow-2xl shadow-black/60">
      <button onPointerDown={startResize} aria-label="Redimensionar miniplayer" title="Arraste para redimensionar" className="absolute left-0 top-0 z-20 flex h-8 w-8 cursor-nwse-resize items-start justify-start rounded-br-xl bg-[#FFCB05]/20 p-1 text-[11px] font-black text-[#FFCB05]">↖</button>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="ml-5 h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <Link href={`/spec/${stream.streamId}`} className="min-w-0 flex-1 truncate text-xs font-black text-white" title="Voltar para a transmissão">
          {stream.title}
        </Link>
        {stream.youtubeVideoId && <button onClick={() => setYoutubeControls((value) => !value)} className="rounded-md px-2 py-1 text-[9px] font-bold text-slate-400 hover:bg-white/10 hover:text-white">{youtubeControls ? "Ocultar controles" : "Controles"}</button>}
        <button onClick={close} aria-label="Fechar miniplayer" className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white">×</button>
      </div>
      <div className="min-h-0 flex-1 bg-black">
        {stream.youtubeVideoId ? (
          <SpecYoutubePlayer streamId={stream.streamId} videoId={stream.youtubeVideoId} interactive={youtubeControls} />
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
