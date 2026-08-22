"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SPEC_ICE_SERVERS, waitForIceGathering } from "@/lib/spec/webrtc-client";

type PlayerState = "connecting" | "watching" | "ended" | "error";

// Player do espectador: WebRTC receive-only. Cria a oferta, envia ao backend
// (/subscribe) que negocia com o SFU e devolve a resposta. O vídeo flui direto
// browser <-> Cloudflare; nunca pela Vercel.
export function SpecPlayer({ streamId, compact = false }: { streamId: string; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [state, setState] = useState<PlayerState>("connecting");
  const [error, setError] = useState<string | null>(null);
  // Som ligado por padrão; se o navegador bloquear o autoplay com áudio,
  // caímos para mudo e o espectador ativa o som com um clique.
  const [muted, setMuted] = useState(false);

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    cleanup();
    setState("connecting");
    setError(null);
    try {
      const pc = new RTCPeerConnection({ iceServers: SPEC_ICE_SERVERS });
      pcRef.current = pc;

      const remote = new MediaStream();
      pc.ontrack = (event) => {
        remote.addTrack(event.track);
        if (videoRef.current) {
          videoRef.current.srcObject = remote;
          // Tenta tocar com som; se o navegador bloquear, muta e tenta de novo.
          videoRef.current.play?.().catch(() => {
            setMuted(true);
            videoRef.current?.play?.().catch(() => null);
          });
        }
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") setState("watching");
        else if (s === "failed" || s === "closed" || s === "disconnected") setState((prev) => (prev === "ended" ? prev : "error"));
      };

      // 1) O backend cria a sessão do espectador e puxa as tracks: o SFU devolve
      //    uma OFERTA que respondemos.
      const subRes = await fetch(`/api/spec/streams/${streamId}/subscribe`, { method: "POST" });
      if (!subRes.ok) {
        const payload = await subRes.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Não foi possível conectar à transmissão.");
      }
      const { spectatorSessionId, offerSdp } = await subRes.json() as { spectatorSessionId: string; offerSdp: string };

      await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIceGathering(pc);

      // 2) Envia a resposta para o SFU concluir a negociação.
      const renRes = await fetch(`/api/spec/streams/${streamId}/renegotiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spectatorSessionId, answerSdp: pc.localDescription?.sdp }),
      });
      if (!renRes.ok) {
        const payload = await renRes.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Falha ao finalizar a conexão.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar.");
      setState("error");
    }
  }, [streamId, cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return (
    <div className={compact ? "h-full" : "space-y-3"}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} autoPlay playsInline muted={muted} className="aspect-video w-full bg-black" />
        {state !== "watching" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-sm text-slate-300">
            {state === "connecting" && <><span className="h-6 w-6 animate-spin rounded-full border-2 border-[#FFCB05] border-t-transparent" /> Conectando à transmissão…</>}
            {state === "error" && <><p className="text-red-300">{error ?? "Erro na transmissão."}</p><button onClick={connect} className="rounded-lg border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-1.5 text-xs font-bold text-[#FFCB05]">Reconectar</button></>}
            {state === "ended" && <p>Transmissão encerrada.</p>}
          </div>
        )}
      </div>
      {!compact && <div className="flex items-center gap-2">
        <button onClick={() => setMuted((m) => !m)} className="rounded-lg border border-border bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">
          {muted ? "🔊 Ativar som" : "🔇 Mudo"}
        </button>
        <button onClick={() => videoRef.current?.requestFullscreen?.()} className="rounded-lg border border-border bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">
          ⛶ Tela cheia
        </button>
      </div>}
    </div>
  );
}
