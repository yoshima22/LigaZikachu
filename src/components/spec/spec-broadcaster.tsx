"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { endSpecStreamAction } from "@/app/(app)/spec/actions";
import { SPEC_ICE_SERVERS, waitForIceGathering, specDisplayMediaOptions, sharedDisplaySurface } from "@/lib/spec/webrtc-client";
import { specEncodeHints, type SpecQualityPriority } from "@/lib/spec/constants";
import { useSpecBroadcastLifecycle } from "./use-spec-broadcast-lifecycle";

type BroadcasterState = "idle" | "requesting" | "connecting" | "live" | "ended" | "error";

// Broadcaster: captura de tela (getDisplayMedia) + publicação WebRTC. Envia uma
// única publicação ao SFU; o fan-out para espectadores é da Cloudflare. Mostra
// só o preview local (não puxa o próprio stream do SFU, para não gastar egress).
export function SpecBroadcaster({ streamId, matchLabel, maxVideoBitrate, width, height, fps, qualityPriority = "sharpness", resolutionLabel, onLive }: {
  streamId: string; matchLabel: string; maxVideoBitrate: number; width: number; height: number; fps: number; qualityPriority?: SpecQualityPriority; resolutionLabel: string; onLive?: () => void;
}) {
  const hints = specEncodeHints(qualityPriority);
  const router = useRouter();
  const previewRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<BroadcasterState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [switchingSource, setSwitchingSource] = useState(false);
  useSpecBroadcastLifecycle(streamId, state === "live");

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
      const stream = await navigator.mediaDevices.getDisplayMedia(specDisplayMediaOptions(width, height, fps));
      streamRef.current = stream;
      setHasAudio(stream.getAudioTracks().length > 0);
      if (sharedDisplaySurface(stream) === "monitor" && stream.getAudioTracks().length > 0) {
        toast.warning("Tela inteira selecionada. Para garantir que o Discord não seja ouvido, interrompa e compartilhe somente a aba do jogo.", { duration: 9_000 });
      }

      // Dica ao encoder: conteúdo com detalhes/texto (cartas), prioriza nitidez
      // sobre fluidez — combina com o frame rate baixo e reduz bitrate.
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) { try { vTrack.contentHint = hints.contentHint; } catch { /* nem todo navegador suporta */ } }
      if (previewRef.current) previewRef.current.srcObject = stream;

      // Encerra a live se o usuário parar o compartilhamento pelo navegador.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => { if (streamRef.current?.getVideoTracks()[0] === stream.getVideoTracks()[0]) void end(true); });

      setState("connecting");
      const pc = new RTCPeerConnection({ iceServers: SPEC_ICE_SERVERS });
      pcRef.current = pc;

      // Cada track vira uma transceiver sendonly com um trackName próprio (que os
      // espectadores usam para puxar). O mid liga o track ao SDP.
      const meta: Array<{ transceiver: RTCRtpTransceiver; trackName: string; kind: "video" | "audio" }> = [];
      for (const track of stream.getTracks()) {
        const kind = track.kind === "audio" ? "audio" : "video";
        const trackName = `${kind}-${Math.random().toString(36).slice(2, 10)}`;
        const transceiver = pc.addTransceiver(track, { direction: "sendonly" });
        meta.push({ transceiver, trackName, kind });
      }

      // Limita o bitrate de vídeo (alvo/máximo). WebRTC pode adaptar para baixo.
      const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (videoSender) {
        try {
          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
          params.encodings[0].maxBitrate = maxVideoBitrate;
          params.encodings[0].maxFramerate = fps;
          (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = hints.degradationPreference;
          await videoSender.setParameters(params);
        } catch { /* alguns navegadores não suportam; segue sem o limite */ }
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const tracks = meta.map((m) => ({ mid: m.transceiver.mid ?? "", trackName: m.trackName, kind: m.kind }));
      const res = await fetch(`/api/spec/streams/${streamId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerSdp: pc.localDescription?.sdp, tracks }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Não foi possível publicar a transmissão.");
      }
      const { answerSdp } = await res.json() as { answerSdp: string };
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setState("live");
      onLive?.();
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
  }, [streamId, maxVideoBitrate, teardown, end, onLive]);

  const switchSource = useCallback(async () => {
    if (state !== "live" || switchingSource || !pcRef.current) return;
    setSwitchingSource(true);
    try {
      const next = await navigator.mediaDevices.getDisplayMedia(specDisplayMediaOptions(width, height, fps));
      const previous = streamRef.current;
      const nextVideo = next.getVideoTracks()[0] ?? null;
      const nextAudio = next.getAudioTracks()[0] ?? null;
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find((sender) => sender.track?.kind === "video");
      const audioSender = senders.find((sender) => sender.track?.kind === "audio");
      if (videoSender) await videoSender.replaceTrack(nextVideo);
      if (audioSender) await audioSender.replaceTrack(nextAudio);
      else if (nextAudio) toast.warning("A live começou sem áudio. Para adicionar áudio agora, reinicie a transmissão.");
      streamRef.current = next;
      if (previewRef.current) previewRef.current.srcObject = next;
      setHasAudio(Boolean(nextAudio));
      nextVideo?.addEventListener("ended", () => { if (streamRef.current?.getVideoTracks()[0] === nextVideo) void end(true); });
      previous?.getTracks().forEach((track) => track.stop());
      toast.success("Janela compartilhada trocada sem encerrar a live.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) toast.error("Não foi possível trocar a janela.");
    } finally { setSwitchingSource(false); }
  }, [state, switchingSource, width, height, fps, end]);

  useEffect(() => teardown, [teardown]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-slate-950/60 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#FFCB05]/70">Você está transmitindo</p>
        <p className="mt-1 text-lg font-black text-white">{matchLabel}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 font-bold ${state === "live" ? "bg-red-500/15 text-red-300" : "bg-slate-800 text-slate-400"}`}>
            {state === "live" ? "🔴 AO VIVO" : state === "connecting" ? "Conectando…" : state === "requesting" ? "Escolhendo tela…" : state === "ended" ? "Encerrada" : "Pronto"}
          </span>
          {state === "live" && <span className="text-slate-500">Qualidade alvo: {resolutionLabel}30 · vídeo {hasAudio ? "+ áudio do sistema" : "sem áudio"}</span>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={previewRef} autoPlay playsInline muted className="aspect-video w-full bg-black" />
      </div>

      <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200">
        Para não transmitir o Discord, selecione <strong>uma aba do navegador</strong> e marque apenas o áudio da aba. A Zika TV solicita ao navegador que nunca envie o áudio geral do sistema.
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
        {state === "live" && <button onClick={switchSource} disabled={switchingSource} className="rounded-xl border border-cyan-400/40 px-5 py-2.5 text-sm font-bold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50">{switchingSource ? "Escolhendo…" : "Trocar janela"}</button>}
      </div>
    </div>
  );
}
