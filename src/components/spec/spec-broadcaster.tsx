"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { endSpecStreamAction } from "@/app/(app)/spec/actions";

type BroadcasterState = "idle" | "requesting" | "connecting" | "live" | "ended" | "error";

// Broadcaster: captura de tela (getDisplayMedia) + publicação WebRTC. Envia uma
// única publicação ao SFU; o fan-out para espectadores é da Cloudflare. Mostra
// só o preview local (não puxa o próprio stream do SFU, para não gastar egress).
export function SpecBroadcaster({ streamId, matchLabel, maxVideoBitrate }: { streamId: string; matchLabel: string; maxVideoBitrate: number }) {
  const router = useRouter();
  const previewRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<BroadcasterState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);

  const teardown = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const end = useCallback(async (redirect = true) => {
    teardown();
    setState("ended");
    await endSpecStreamAction(streamId).catch(() => null);
    if (redirect) router.push("/spec");
  }, [streamId, teardown, router]);

  const start = useCallback(async () => {
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: true,
      });
      streamRef.current = stream;
      setHasAudio(stream.getAudioTracks().length > 0);
      if (previewRef.current) previewRef.current.srcObject = stream;

      // Encerra a live se o usuário parar o compartilhamento pelo navegador.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => { void end(true); });

      setState("connecting");
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      for (const track of stream.getTracks()) pc.addTrack(track, stream);

      // Limita o bitrate de vídeo (alvo/máximo). WebRTC pode adaptar para baixo.
      const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender) {
        try {
          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
          params.encodings[0].maxBitrate = maxVideoBitrate;
          await videoSender.setParameters(params);
        } catch { /* alguns navegadores não suportam; segue sem o limite */ }
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const res = await fetch(`/api/spec/streams/${streamId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerSdp: offer.sdp }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Não foi possível publicar a transmissão.");
      }
      const { answerSdp } = await res.json() as { answerSdp: string };
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setState("live");
      toast.success("Transmissão ao vivo!");
    } catch (e) {
      teardown();
      const message = e instanceof DOMException && e.name === "NotAllowedError"
        ? "Compartilhamento cancelado."
        : e instanceof Error ? e.message : "Falha ao iniciar a transmissão.";
      setError(message);
      setState("error");
      // Se a captura foi cancelada, a live nem chegou a ir ao ar: limpa o registro.
      await endSpecStreamAction(streamId).catch(() => null);
    }
  }, [streamId, maxVideoBitrate, teardown, end]);

  useEffect(() => {
    const onHide = () => { void endSpecStreamAction(streamId); };
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); teardown(); };
  }, [streamId, teardown]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-slate-950/60 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FFCB05]/70">Você está transmitindo</p>
        <p className="mt-1 text-lg font-black text-white">{matchLabel}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 font-bold ${state === "live" ? "bg-red-500/15 text-red-300" : "bg-slate-800 text-slate-400"}`}>
            {state === "live" ? "🔴 AO VIVO" : state === "connecting" ? "Conectando…" : state === "requesting" ? "Escolhendo tela…" : state === "ended" ? "Encerrada" : "Pronto"}
          </span>
          {state === "live" && <span className="text-slate-500">Qualidade alvo: 1080p30 · vídeo {hasAudio ? "+ áudio" : "sem áudio"}</span>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={previewRef} autoPlay playsInline muted className="aspect-video w-full bg-black" />
      </div>

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
        Escolha a janela/aba onde a partida está acontecendo. Evite compartilhar esta própria página (efeito espelho). Marque "Compartilhar áudio" no seletor quando aparecer.
      </p>

      {error && <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {(state === "idle" || state === "error" || state === "ended") && (
          <button onClick={start} className="rounded-xl bg-[#FFCB05] px-5 py-2.5 text-sm font-black text-[#1A1A2E] hover:bg-[#FFD700]">
            {state === "error" ? "Tentar novamente" : "Compartilhar tela"}
          </button>
        )}
        {(state === "live" || state === "connecting" || state === "requesting") && (
          <button onClick={() => end(true)} className="rounded-xl border border-red-400/40 px-5 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/10">
            Encerrar transmissão
          </button>
        )}
      </div>
    </div>
  );
}
