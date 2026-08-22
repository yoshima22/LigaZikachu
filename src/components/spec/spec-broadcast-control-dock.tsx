"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Pause, Play, Radio, Square, ExternalLink } from "lucide-react";
import {
  sendSpecBroadcastCommand,
  SPEC_BROADCAST_CHANNEL,
  SPEC_BROADCAST_CONTROL_EVENT,
  SPEC_BROADCAST_CONTROL_KEY,
  type SpecBroadcastControlState,
} from "./spec-broadcast-control";

export function SpecBroadcastControlDock() {
  const pathname = usePathname();
  const [broadcast, setBroadcast] = useState<SpecBroadcastControlState | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(SPEC_BROADCAST_CONTROL_KEY);
        setBroadcast(raw ? JSON.parse(raw) as SpecBroadcastControlState : null);
      } catch { setBroadcast(null); }
    };
    const local = (event: Event) => {
      const next = (event as CustomEvent<SpecBroadcastControlState>).detail;
      setBroadcast(next?.state === "ended" ? null : next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === SPEC_BROADCAST_CONTROL_KEY) read();
    };
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(SPEC_BROADCAST_CHANNEL);
      channel.onmessage = (event) => {
        if (event.data?.type === "state") {
          const next = event.data.state as SpecBroadcastControlState;
          setBroadcast(next.state === "ended" ? null : next);
        }
      };
    } catch { /* fallback por storage */ }
    read();
    window.addEventListener(SPEC_BROADCAST_CONTROL_EVENT, local);
    window.addEventListener("storage", storage);
    return () => {
      channel?.close();
      window.removeEventListener(SPEC_BROADCAST_CONTROL_EVENT, local);
      window.removeEventListener("storage", storage);
    };
  }, []);

  if (!broadcast || pathname.startsWith(`/spec/${broadcast.streamId}/transmitir`)) return null;
  const paused = broadcast.state === "paused";
  const focusTransmitter = () => {
    sendSpecBroadcastCommand("focus");
    try { window.open("", `zika-tv-broadcast-${broadcast.streamId}`)?.focus(); } catch { /* comando já enviado */ }
  };

  return (
    <aside className="fixed bottom-4 right-3 z-[75] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-red-400/40 bg-slate-950/95 p-3 shadow-2xl shadow-black/70 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-300"><Radio size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-red-300">Sua transmissão {paused ? "está pausada" : "está ao vivo"}</p>
          <p className="truncate text-xs font-bold text-white">{broadcast.title}</p>
        </div>
        <span className={`h-2.5 w-2.5 rounded-full ${paused ? "bg-amber-400" : "animate-pulse bg-red-500"}`} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button onClick={() => sendSpecBroadcastCommand(paused ? "play" : "pause")} className="flex items-center justify-center gap-1 rounded-lg border border-amber-400/30 px-2 py-2 text-[10px] font-bold text-amber-200 hover:bg-amber-500/10">
          {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? "Retomar" : "Pausar"}
        </button>
        <button onClick={focusTransmitter} className="flex items-center justify-center gap-1 rounded-lg border border-cyan-400/30 px-2 py-2 text-[10px] font-bold text-cyan-200 hover:bg-cyan-500/10">
          <ExternalLink size={13} /> Painel
        </button>
        <button onClick={() => sendSpecBroadcastCommand("stop")} className="flex items-center justify-center gap-1 rounded-lg border border-red-400/30 px-2 py-2 text-[10px] font-bold text-red-200 hover:bg-red-500/10">
          <Square size={12} /> Encerrar
        </button>
      </div>
    </aside>
  );
}
