"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sendSpecSignalAction, pollSpecSignalsAction, getSpecSignalCursorAction } from "@/app/(app)/spec/signal-actions";
import { SPEC_ICE_SERVERS, waitForIceGathering } from "@/lib/spec/webrtc-client";
import { useZikaTvVolume, ZikaTvVolumeControl } from "./use-zika-tv-volume";

type PlayerState = "connecting" | "watching" | "ended" | "error";

// Player P2P mesh: conecta direto com o broadcaster. Envia JOIN, recebe a OFERTA
// por sinalização, responde com ANSWER; a mídia flui browser <-> browser.
export function SpecPlayerP2P({ streamId, broadcasterUserId, compact = false }: { streamId: string; broadcasterUserId: string; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const cursorRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredRef = useRef(false);
  const [state, setState] = useState<PlayerState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const { volume, setVolume } = useZikaTvVolume();

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = volume === 0 || muted;
  }, [volume, muted]);

  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    pcRef.current?.close();
    pcRef.current = null;
    answeredRef.current = false;
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
          videoRef.current.play?.().catch(() => { setMuted(true); videoRef.current?.play?.().catch(() => null); });
        }
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") setState("watching");
        else if (s === "failed" || s === "closed" || s === "disconnected") setState((prev) => (prev === "ended" ? prev : "error"));
      };

      // Ignora ofertas de montagens anteriores (ex.: player grande -> mini).
      cursorRef.current = await getSpecSignalCursorAction(streamId);
      // 1) Anuncia que quer assistir. O broadcaster responde com uma nova OFERTA.
      await sendSpecSignalAction(streamId, broadcasterUserId, "JOIN", {});

      // 2) Aguarda a OFERTA por polling e responde com a ANSWER.
      const tick = async () => {
        const res = await pollSpecSignalsAction(streamId, cursorRef.current).catch(() => null);
        if (!res) return;
        cursorRef.current = res.cursor;
        for (const sig of res.signals) {
          if (sig.kind === "OFFER" && !answeredRef.current) {
            const sdp = (sig.payload as { sdp?: string } | null)?.sdp;
            if (!sdp) continue;
            answeredRef.current = true;
            await pc.setRemoteDescription({ type: "offer", sdp });
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await waitForIceGathering(pc);
            await sendSpecSignalAction(streamId, broadcasterUserId, "ANSWER", { sdp: pc.localDescription?.sdp });
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        }
      };
      pollRef.current = setInterval(() => { void tick(); }, 1500);
      void tick();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao conectar.");
      setState("error");
    }
  }, [streamId, broadcasterUserId, cleanup]);

  useEffect(() => {
    connect();
    // Não envia BYE durante o handoff para o miniplayer. O fechamento do próprio
    // PeerConnection sinaliza a queda, e o JOIN seguinte substitui a conexão.
    return cleanup;
  }, [connect, cleanup, streamId, broadcasterUserId]);

  return (
    <div className={compact ? "h-full" : "space-y-3"}>
      <div className={`relative overflow-hidden border border-border bg-black ${compact ? "h-full" : "rounded-2xl"}`}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} autoPlay playsInline muted={muted} className={compact ? "h-full w-full bg-black object-contain" : "aspect-video w-full bg-black"} />
        {state !== "watching" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-sm text-slate-300">
            {state === "connecting" && <><span className="h-6 w-6 animate-spin rounded-full border-2 border-[#FFCB05] border-t-transparent" /> Conectando à transmissão…</>}
            {state === "error" && <><p className="text-red-300">{error ?? "Erro na transmissão."}</p><button onClick={connect} className="rounded-lg border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-1.5 text-xs font-bold text-[#FFCB05]">Reconectar</button></>}
            {state === "ended" && <p>Transmissão encerrada.</p>}
          </div>
        )}
        {compact && state === "watching" && <div className="absolute bottom-2 right-2 z-10"><ZikaTvVolumeControl compact volume={volume} onChange={(value) => { setMuted(false); setVolume(value); }} /></div>}
      </div>
      {!compact && <div className="flex items-center gap-2">
        <ZikaTvVolumeControl volume={volume} onChange={(value) => { setMuted(false); setVolume(value); }} />
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
