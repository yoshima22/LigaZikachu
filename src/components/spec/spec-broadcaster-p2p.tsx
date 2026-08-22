"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { endSpecStreamAction, markSpecStreamLiveAction } from "@/app/(app)/spec/actions";
import { sendSpecSignalAction, pollSpecSignalsAction } from "@/app/(app)/spec/signal-actions";
import { SPEC_ICE_SERVERS, waitForIceGathering, specDisplayMediaOptions, sharedDisplaySurface } from "@/lib/spec/webrtc-client";
import { specEncodeHints, type SpecQualityPriority } from "@/lib/spec/constants";
import { useSpecBroadcastLifecycle } from "./use-spec-broadcast-lifecycle";

type BroadcasterState = "idle" | "requesting" | "connecting" | "live" | "ended" | "error";

// Broadcaster P2P mesh: conecta DIRETO com cada espectador (uma PeerConnection
// por pessoa). Sem SFU: egress zero para o servidor, mas o upload/CPU do
// transmissor cresce com o número de espectadores. Sinalização (SDP) via banco.
export function SpecBroadcasterP2P({ streamId, matchLabel, maxVideoBitrate, width, height, fps, qualityPriority = "sharpness", resolutionLabel, onLive }: {
  streamId: string; matchLabel: string; maxVideoBitrate: number; width: number; height: number; fps: number; qualityPriority?: SpecQualityPriority; resolutionLabel: string; onLive?: () => void;
}) {
  const hints = specEncodeHints(qualityPriority);
  const router = useRouter();
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const cursorRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [state, setState] = useState<BroadcasterState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [switchingSource, setSwitchingSource] = useState(false);
  useSpecBroadcastLifecycle(streamId, state === "live");

  const teardown = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    setViewerCount(0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const end = useCallback(async (redirect = true) => {
    teardown();
    setState("ended");
    await endSpecStreamAction(streamId).catch(() => null);
    if (redirect) router.push("/spec");
  }, [streamId, teardown, router]);

  // Cria a conexão para um espectador que enviou JOIN e devolve a OFERTA.
  const offerToViewer = useCallback(async (viewerId: string) => {
    const stream = streamRef.current;
    if (!stream) return;
    // Reconexão: descarta a conexão antiga desse espectador, se houver.
    peersRef.current.get(viewerId)?.close();

    const pc = new RTCPeerConnection({ iceServers: SPEC_ICE_SERVERS });
    for (const track of stream.getTracks()) {
      const transceiver = pc.addTransceiver(track, { direction: "sendonly" });
      // Preferir VP8: bem mais barato de codificar que VP9/AV1 (padrão do Chrome
      // para screen share). Crucial para aguentar vários espectadores no mesh.
      if (track.kind === "video") {
        try {
          const caps = RTCRtpSender.getCapabilities("video");
          if (caps) {
            const vp8 = caps.codecs.filter((c) => c.mimeType.toLowerCase() === "video/vp8");
            const rest = caps.codecs.filter((c) => c.mimeType.toLowerCase() !== "video/vp8");
            if (vp8.length) transceiver.setCodecPreferences([...vp8, ...rest]);
          }
        } catch { /* nem todo navegador suporta */ }
      }
    }

    const videoSender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (videoSender) {
      try {
        const params = videoSender.getParameters();
        if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
        params.encodings[0].maxBitrate = maxVideoBitrate;
        params.encodings[0].maxFramerate = fps;
        (params as RTCRtpSendParameters & { degradationPreference?: string }).degradationPreference = hints.degradationPreference;
        await videoSender.setParameters(params);
      } catch { /* segue sem o limite */ }
    }

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "closed" || s === "disconnected") {
        pc.close();
        if (peersRef.current.get(viewerId) === pc) peersRef.current.delete(viewerId);
        setViewerCount(peersRef.current.size);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);
    peersRef.current.set(viewerId, pc);
    setViewerCount(peersRef.current.size);
    await sendSpecSignalAction(streamId, viewerId, "OFFER", { sdp: pc.localDescription?.sdp });
  }, [streamId, maxVideoBitrate, fps]);

  // Loop de sinalização: aceita JOINs (novos espectadores) e ANSWERs.
  const startSignalingLoop = useCallback(() => {
    if (pollRef.current) return;
    const tick = async () => {
      const res = await pollSpecSignalsAction(streamId, cursorRef.current).catch(() => null);
      if (!res) return;
      cursorRef.current = res.cursor;
      for (const sig of res.signals) {
        if (sig.kind === "JOIN") {
          void offerToViewer(sig.fromUserId);
        } else if (sig.kind === "ANSWER") {
          const pc = peersRef.current.get(sig.fromUserId);
          const sdp = (sig.payload as { sdp?: string } | null)?.sdp;
          if (pc && sdp) await pc.setRemoteDescription({ type: "answer", sdp }).catch(() => null);
        } else if (sig.kind === "BYE") {
          peersRef.current.get(sig.fromUserId)?.close();
          peersRef.current.delete(sig.fromUserId);
          setViewerCount(peersRef.current.size);
        }
      }
    };
    pollRef.current = setInterval(() => { void tick(); }, 1500);
    void tick();
  }, [streamId, offerToViewer]);

  const start = useCallback(async () => {
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(specDisplayMediaOptions(width, height, fps));
      streamRef.current = stream;
      setHasAudio(stream.getAudioTracks().length > 0);
      setAudioEnabled(stream.getAudioTracks().some((track) => track.enabled));
      if (sharedDisplaySurface(stream) === "monitor" && stream.getAudioTracks().length > 0) {
        toast.warning("Tela inteira selecionada: o áudio pode incluir Discord e outros programas. Prefira compartilhar a janela do jogo ou corte o áudio da live.", { duration: 9_000 });
      }
      if (previewRef.current) previewRef.current.srcObject = stream;
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) { try { vTrack.contentHint = hints.contentHint; } catch { /* ok */ } }
      vTrack?.addEventListener("ended", () => { if (streamRef.current?.getVideoTracks()[0] === vTrack) void end(true); });

      setState("connecting");
      const res = await markSpecStreamLiveAction(streamId);
      if ("error" in res) throw new Error(res.error);
      startSignalingLoop();
      setState("live");
      onLive?.();
      toast.success("Transmissão P2P ao vivo!");
    } catch (e) {
      teardown();
      const message = e instanceof DOMException && e.name === "NotAllowedError"
        ? "Compartilhamento cancelado."
        : e instanceof Error ? e.message : "Falha ao iniciar a transmissão.";
      setError(message);
      setState("error");
      await endSpecStreamAction(streamId).catch(() => null);
    }
  }, [streamId, fps, width, height, teardown, end, startSignalingLoop, onLive]);

  const switchSource = useCallback(async () => {
    if (state !== "live" || switchingSource) return;
    setSwitchingSource(true);
    try {
      const next = await navigator.mediaDevices.getDisplayMedia(specDisplayMediaOptions(width, height, fps));
      const previous = streamRef.current;
      const nextVideo = next.getVideoTracks()[0] ?? null;
      const nextAudio = next.getAudioTracks()[0] ?? null;
      streamRef.current = next;
      let missingAudioSender = false;
      for (const pc of peersRef.current.values()) {
        const videoSender = pc.getSenders().find((sender) => sender.track?.kind === "video");
        const audioSender = pc.getSenders().find((sender) => sender.track?.kind === "audio");
        if (videoSender) await videoSender.replaceTrack(nextVideo);
        if (audioSender) await audioSender.replaceTrack(nextAudio);
        else if (nextAudio) missingAudioSender = true;
      }
      if (missingAudioSender) toast.warning("A nova janela possui áudio, mas algumas conexões começaram sem áudio. Esses espectadores devem reconectar para recebê-lo.");
      if (previewRef.current) previewRef.current.srcObject = next;
      setHasAudio(Boolean(nextAudio));
      setAudioEnabled(Boolean(nextAudio?.enabled));
      nextVideo?.addEventListener("ended", () => { if (streamRef.current?.getVideoTracks()[0] === nextVideo) void end(true); });
      previous?.getTracks().forEach((track) => track.stop());
      toast.success("Janela compartilhada trocada sem encerrar a live.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotAllowedError")) toast.error("Não foi possível trocar a janela.");
    } finally { setSwitchingSource(false); }
  }, [state, switchingSource, width, height, fps, end]);

  const toggleOutgoingAudio = useCallback(() => {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    if (tracks.length === 0) {
      toast.info("Esta fonte foi compartilhada sem áudio.");
      return;
    }
    const next = !audioEnabled;
    tracks.forEach((track) => { track.enabled = next; });
    setAudioEnabled(next);
    toast.success(next ? "Áudio da transmissão ativado." : "Áudio da transmissão cortado. O Discord não será ouvido.");
  }, [audioEnabled]);

  useEffect(() => teardown, [teardown]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-slate-950/60 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Você está transmitindo · Modo P2P econômico</p>
        <p className="mt-1 text-lg font-black text-white">{matchLabel}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 font-bold ${state === "live" ? "bg-red-500/15 text-red-300" : "bg-slate-800 text-slate-400"}`}>
            {state === "live" ? "🔴 AO VIVO" : state === "connecting" ? "Conectando…" : state === "requesting" ? "Escolhendo tela…" : state === "ended" ? "Encerrada" : "Pronto"}
          </span>
          {state === "live" && <span className="rounded-full bg-emerald-500/15 px-2 py-1 font-bold text-emerald-300">👥 {viewerCount} conectado{viewerCount === 1 ? "" : "s"}</span>}
          {state === "live" && <span className="text-slate-500">Qualidade: {resolutionLabel}{fps} · {hasAudio ? (audioEnabled ? "+ áudio compartilhado" : "+ áudio cortado") : "sem áudio"}</span>}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={previewRef} autoPlay playsInline muted className="aspect-video w-full bg-black" />
      </div>

      <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
        Para jogos externos, escolha <strong>Janela</strong> e, se disponível, <strong>áudio desta janela</strong>. Se o Windows entregar Discord e jogo já misturados, o navegador não consegue separá-los: use “Cortar áudio” abaixo ou envie o Discord para outro dispositivo de saída.
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
        {state === "live" && hasAudio && <button onClick={toggleOutgoingAudio} className="rounded-xl border border-amber-400/40 px-5 py-2.5 text-sm font-bold text-amber-200 hover:bg-amber-500/10">{audioEnabled ? "Cortar áudio" : "Restaurar áudio"}</button>}
      </div>
    </div>
  );
}
