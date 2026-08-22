"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type State = "loading" | "ready" | "requesting" | "live" | "paused" | "ended" | "error";
type Settings = { resolution: string; fps: string; quality: string; processName: string };
type Signal = { seq: number; fromUserId: string; kind: string; payload: unknown };

const ICE: RTCIceServer[] = [{ urls: "stun:stun.cloudflare.com:3478" }];

export function WindowsTransmitterStudio() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const cursorRef = useRef(0);
  const [state, setState] = useState<State>("loading");
  const [title, setTitle] = useState("Zika TV");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [viewers, setViewers] = useState(0);
  const [audio, setAudio] = useState(true);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState({ streamId: "", token: "" });
  const { streamId, token } = credentials;

  useEffect(() => { const params = new URLSearchParams(window.location.hash.slice(1)); setCredentials({ streamId: params.get("streamId") ?? "", token: params.get("token") ?? "" }); }, []);

  const api = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const response = await fetch("/api/spec/windows-transmitter/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ streamId, token, action, ...extra }), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha na comunicação com a Liga.");
    return data;
  }, [streamId, token]);

  const closePeer = useCallback((id: string) => { peersRef.current.get(id)?.close(); peersRef.current.delete(id); setViewers(peersRef.current.size); }, []);
  const sendOffer = useCallback(async (viewerId: string) => {
    const media = mediaRef.current; if (!media) return;
    closePeer(viewerId);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    media.getTracks().forEach((track) => pc.addTrack(track, media));
    pc.onconnectionstatechange = () => { if (["failed", "closed", "disconnected"].includes(pc.connectionState)) closePeer(viewerId); };
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await new Promise<void>((resolve) => { if (pc.iceGatheringState === "complete") return resolve(); const timer = setTimeout(resolve, 3500); pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(timer); resolve(); } }); });
    peersRef.current.set(viewerId, pc); setViewers(peersRef.current.size);
    await api("signal", { toUserId: viewerId, kind: "OFFER", payload: { sdp: pc.localDescription?.sdp } });
  }, [api, closePeer]);

  useEffect(() => { if (!streamId || !token) return; void api("status").then((data) => { setTitle(data.title); setSettings(data.settings); setState(data.status === "ENDED" ? "ended" : "ready"); }).catch((e) => { setError(e.message); setState("error"); }); }, [api, streamId, token]);

  useEffect(() => {
    if (state !== "live" && state !== "paused") return;
    const poll = async () => {
      const data = await api("poll", { cursor: cursorRef.current }).catch(() => null); if (!data) return;
      cursorRef.current = data.cursor;
      for (const signal of data.signals as Signal[]) {
        if (signal.kind === "JOIN") void sendOffer(signal.fromUserId);
        else if (signal.kind === "ANSWER") { const sdp = (signal.payload as { sdp?: string } | null)?.sdp; if (sdp) await peersRef.current.get(signal.fromUserId)?.setRemoteDescription({ type: "answer", sdp }).catch(() => null); }
        else if (signal.kind === "BYE") closePeer(signal.fromUserId);
      }
    };
    const pollTimer = window.setInterval(() => void poll(), 1400);
    const heartbeat = window.setInterval(() => void api("heartbeat"), 15_000);
    void poll(); void api("heartbeat");
    return () => { clearInterval(pollTimer); clearInterval(heartbeat); };
  }, [state, api, sendOffer, closePeer]);

  const selectSource = useCallback(async (replace = false) => {
    setError(""); setState("requesting");
    try {
      const fps = Number(settings?.fps.match(/\d+/)?.[0] ?? 30); const height = Number(settings?.resolution.match(/\d+/)?.[0] ?? 720); const width = Math.round(height * 16 / 9);
      const next = await navigator.mediaDevices.getDisplayMedia({ video: { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: fps, max: fps } }, audio: true, systemAudio: "exclude", windowAudio: "window", surfaceSwitching: "include" } as DisplayMediaStreamOptions);
      const previous = mediaRef.current; mediaRef.current = next; if (videoRef.current) videoRef.current.srcObject = next;
      setAudio(next.getAudioTracks().some((track) => track.enabled));
      if (replace) for (const pc of peersRef.current.values()) for (const sender of pc.getSenders()) await sender.replaceTrack(next.getTracks().find((track) => track.kind === sender.track?.kind) ?? null);
      previous?.getTracks().forEach((track) => track.stop());
      next.getVideoTracks()[0]?.addEventListener("ended", () => void stop());
      await api("live"); setState("live");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível selecionar a fonte."); setState(mediaRef.current ? "live" : "ready"); }
  }, [api, settings]);

  const togglePause = () => { const pause = state === "live"; mediaRef.current?.getTracks().forEach((track) => { track.enabled = !pause && (track.kind !== "audio" || audio); }); setState(pause ? "paused" : "live"); };
  const toggleAudio = () => { const next = !audio; mediaRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; }); setAudio(next); };
  const stop = useCallback(async () => { mediaRef.current?.getTracks().forEach((track) => track.stop()); mediaRef.current = null; peersRef.current.forEach((pc) => pc.close()); peersRef.current.clear(); setViewers(0); await api("end").catch(() => null); setState("ended"); }, [api]);
  useEffect(() => () => { mediaRef.current?.getTracks().forEach((track) => track.stop()); peersRef.current.forEach((pc) => pc.close()); }, []);

  return <main className="min-h-screen bg-[#030718] p-5 text-white">
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-400/20 bg-[#0a1027] p-4"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-[#FFCB05]">Zika TV · Transmissor Windows</p><h1 className="text-xl font-black">{title}</h1></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-red-500/15 px-3 py-1.5 font-bold text-red-300">{state === "live" ? "● AO VIVO" : state === "paused" ? "Ⅱ PAUSADA" : state === "ended" ? "ENCERRADA" : "PRONTA"}</span><span className="rounded-full bg-cyan-500/10 px-3 py-1.5 font-bold text-cyan-200">{viewers} espectador{viewers === 1 ? "" : "es"}</span></div></header>
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]"><section className="overflow-hidden rounded-2xl border border-white/10 bg-black"><video ref={videoRef} autoPlay playsInline muted className="aspect-video h-full w-full object-contain" /></section><aside className="space-y-3 rounded-2xl border border-white/10 bg-[#0a1027] p-4"><h2 className="font-black">Controles da live</h2><p className="text-xs leading-relaxed text-slate-400">O aplicativo mantém a mídia ativa. Você pode navegar pelo site normalmente; chat, enquetes e arquibancada continuam na página da Zika TV.</p>{settings && <div className="rounded-xl bg-white/5 p-3 text-xs text-slate-300"><strong className="block text-violet-200">Configuração P2P</strong>{settings.resolution} · {settings.fps} · {settings.quality}<span className="mt-1 block truncate text-slate-500">{settings.processName}</span></div>}<div className="grid gap-2">{["ready", "error"].includes(state) && <button onClick={() => void selectSource(false)} className="rounded-xl bg-[#FFCB05] px-4 py-3 font-black text-slate-950">Selecionar tela e iniciar</button>}{["live", "paused"].includes(state) && <><button onClick={togglePause} className="rounded-xl bg-violet-500 px-4 py-3 font-bold">{state === "live" ? "Pausar transmissão" : "Continuar transmissão"}</button><button onClick={toggleAudio} className="rounded-xl border border-amber-400/30 px-4 py-3 font-bold text-amber-200">{audio ? "Cortar áudio" : "Restaurar áudio"}</button><button onClick={() => void selectSource(true)} className="rounded-xl border border-cyan-400/30 px-4 py-3 font-bold text-cyan-200">Trocar janela</button><button onClick={() => void stop()} className="rounded-xl border border-red-400/30 px-4 py-3 font-bold text-red-300">Encerrar live</button></>}{state === "ended" && <p className="rounded-xl bg-white/5 p-3 text-center text-sm text-slate-400">Esta transmissão foi encerrada. Crie uma nova live pelo site para transmitir novamente.</p>}</div>{error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}</aside></div>
    </div>
  </main>;
}
