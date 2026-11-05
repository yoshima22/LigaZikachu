"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeft, Copy, Eye, EyeOff, Maximize2, Mic, MicOff, Minimize2, MonitorUp, MonitorX,
  PhoneOff, Send, Users, Volume2, VolumeX, X,
} from "lucide-react";
import { specDisplayMediaOptions } from "@/lib/spec/webrtc-client";

type Member = { id: string; name: string; mic: boolean; sharing: boolean; screenId?: string };
type ChatLine = { id: string; name: string; text: string; ts: number; mine?: boolean };
type SignalPayload = { from: string; to: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type WatchPayload = { from: string; to: string; on: boolean };
type Peer = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** Streams recebidas deste participante, por id (voz e tela chegam em streams separadas). */
  streams: Map<string, MediaStream>;
  senders: { mic: RTCRtpSender[]; screen: RTCRtpSender[] };
  /** Este participante pediu para assistir a MINHA tela (só então eu envio vídeo para ele). */
  viewing: boolean;
  relayTimer?: number;
};

const MAX_CHAT = 200;
// Em malha, quem compartilha envia um fluxo por espectador: divide um orçamento total de upload entre quem assiste.
const SCREEN_MAX_BITRATE = 1_500_000;
const SCREEN_MIN_BITRATE = 200_000;
const SCREEN_UPLOAD_BUDGET = 4_000_000;

function cleanName(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 24) || `Visitante ${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Janela de uma tela compartilhada, no estilo de player: volume, tela cheia (botão ou duplo clique) e fechar. */
function ScreenTile({ title, stream, ownPreview, version, onClose }: {
  title: string; stream: MediaStream | undefined; ownPreview?: boolean; version: number; onClose: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(!!ownPreview);
  const [full, setFull] = useState(false);
  const hasVideo = !!stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);

  useEffect(() => {
    const el = video.current;
    if (el && stream && el.srcObject !== stream) el.srcObject = stream;
    if (el) { el.volume = volume; el.muted = muted; }
  });
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    const el = wrap.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (el?.requestFullscreen) void el.requestFullscreen();
    else (video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)?.webkitEnterFullscreen?.(); // iOS
  };

  return (
    <div ref={wrap} data-v={version} className={`group relative overflow-hidden bg-black ${full ? "flex h-screen items-center" : "rounded-2xl border border-slate-700 shadow-lg shadow-black/30"}`}>
      <video
        ref={video}
        autoPlay
        playsInline
        onDoubleClick={toggleFull}
        className={`w-full bg-black object-contain ${full ? "h-full" : "aspect-video"}`}
      />
      {!hasVideo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-slate-300">
          Conectando à tela de {title}…
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 py-2 text-xs text-white">
        <span className="font-semibold">{title}</span>
        <button onClick={onClose} aria-label={`Parar de assistir ${title}`} className="rounded-full bg-black/50 p-1.5 hover:bg-black/80"><X size={14} /></button>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {!ownPreview && (
          <>
            <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Ativar som" : "Silenciar"} className="rounded-full p-1.5 text-white hover:bg-white/20">
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
              onChange={(e) => { const v = Number(e.target.value); setVolume(v); setMuted(v === 0); }}
              aria-label="Volume" className="h-1 w-24 accent-[#FFCB05]"
            />
          </>
        )}
        <button onClick={toggleFull} aria-label={full ? "Sair da tela cheia" : "Tela cheia"} className="ml-auto rounded-full p-1.5 text-white hover:bg-white/20">
          {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
}

/** Voz de um participante: toca as streams que não são a tela (a tela só toca quando está sendo assistida). */
function VoiceAudio({ streams, screenId, version }: { streams: Map<string, MediaStream>; screenId?: string; version: number }) {
  const voices = [...streams.entries()].filter(([id, s]) => id !== screenId && s.getAudioTracks().length > 0);
  return (
    <span data-v={version} hidden>
      {voices.map(([id, s]) => (
        <audio key={id} autoPlay ref={(el) => { if (el && el.srcObject !== s) el.srcObject = s; }} />
      ))}
    </span>
  );
}

export function QuickRoomClient({ code, label, hasPassword, isMember }: { code: string; label: string; hasPassword: boolean; isMember: boolean }) {
  const backHref = isMember ? "/dashboard" : "/";
  const backLabel = isMember ? "Voltar à Liga" : "Página inicial";

  const [phase, setPhase] = useState<"form" | "joining" | "in">("form");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [micOn, setMicOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [watching, setWatching] = useState<string[]>([]);
  const [needsCode, setNeedsCode] = useState(false);
  const [relayCode, setRelayCode] = useState("");
  const [relayBusy, setRelayBusy] = useState(false);
  const [relayMsg, setRelayMsg] = useState<string | null>(null);
  const [, setVersion] = useState(0); // força re-render quando faixas remotas mudam
  const version = useRef(0);

  const myId = useRef("");
  const myName = useRef("");
  const topic = useRef("");
  const iceServers = useRef<RTCIceServer[]>([]);
  const maxParticipants = useRef(13);
  const supabase = useRef<SupabaseClient | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const micStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const lastChatAt = useRef(0);
  const beat = useRef<number | null>(null);
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const memberState = useRef<{ mic: boolean; sharing: boolean; screenId?: string }>({ mic: false, sharing: false });
  const relayOn = useRef(false);
  const watchingRef = useRef<string[]>([]);
  const knownSharers = useRef(new Set<string>());
  const screenBusy = useRef(false);

  const bump = useCallback(() => { version.current += 1; setVersion(version.current); }, []);
  const updateWatching = useCallback((next: string[]) => { watchingRef.current = next; setWatching(next); }, []);

  const sendSignal = useCallback((to: string, body: { description?: RTCSessionDescriptionInit | null; candidate?: RTCIceCandidateInit }) => {
    void channel.current?.send({ type: "broadcast", event: "signal", payload: { from: myId.current, to, ...body } });
  }, []);
  const sendWatch = useCallback((to: string, on: boolean) => {
    void channel.current?.send({ type: "broadcast", event: "watch", payload: { from: myId.current, to, on } satisfies WatchPayload });
  }, []);
  const publishPresence = useCallback(() => {
    void channel.current?.track({ name: myName.current, ...memberState.current });
  }, []);

  const closePeer = useCallback((id: string) => {
    const peer = peers.current.get(id);
    if (!peer) return;
    if (peer.relayTimer) window.clearTimeout(peer.relayTimer);
    peer.pc.onnegotiationneeded = null;
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.close();
    peers.current.delete(id);
    bump();
  }, [bump]);

  /** Liga/desliga o envio da minha tela para um participante e reparte o upload entre quem assiste. */
  const applyScreenState = useCallback((peer: Peer) => {
    const viewers = [...peers.current.values()].filter((p) => p.viewing).length;
    const bitrate = Math.round(Math.min(SCREEN_MAX_BITRATE, Math.max(SCREEN_MIN_BITRATE, SCREEN_UPLOAD_BUDGET / Math.max(1, viewers))));
    for (const sender of peer.senders.screen) {
      const params = sender.getParameters();
      if (!params.encodings?.length) continue; // ainda não negociado: reaplica quando a sinalização estabilizar
      const enc = params.encodings[0];
      const isVideo = sender.track?.kind === "video";
      if (enc.active === peer.viewing && (!isVideo || enc.maxBitrate === bitrate)) continue;
      enc.active = peer.viewing;
      if (isVideo) enc.maxBitrate = bitrate;
      void sender.setParameters(params).catch(() => null);
    }
  }, []);
  const applyAllScreenState = useCallback(() => {
    for (const peer of peers.current.values()) applyScreenState(peer);
  }, [applyScreenState]);

  const addLocalTracks = useCallback((peer: Peer, kind: "mic" | "screen", stream: MediaStream) => {
    for (const track of stream.getTracks()) peer.senders[kind].push(peer.pc.addTrack(track, stream));
    if (kind === "screen") applyScreenState(peer);
  }, [applyScreenState]);

  /**
   * Conexão reforçada (relay/TURN): só quando a direta falha. O servidor decide quem pode (login, código de
   * convite da Liga ou código livre do admin). Sem permissão, o jogador é convidado a informar um código.
   */
  const requestRelay = useCallback(async (inviteCode?: string): Promise<boolean> => {
    if (relayOn.current) return true;
    try {
      const res = await fetch(`/api/salas/${code}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.current, inviteCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.needsCode) setNeedsCode(true);
        setRelayMsg(data.error ?? "Conexão reforçada indisponível.");
        return false;
      }
      relayOn.current = true;
      iceServers.current = data.iceServers;
      setNeedsCode(false);
      setRelayMsg(null);
      for (const peer of peers.current.values()) {
        peer.pc.setConfiguration({ iceServers: data.iceServers });
        if (peer.pc.connectionState !== "connected") peer.pc.restartIce();
      }
      return true;
    } catch {
      return false;
    }
  }, [code]);

  const createPeer = useCallback((id: string): Peer => {
    const existing = peers.current.get(id);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: iceServers.current });
    // Negociação perfeita: o id maior é "educado" e cede quando as duas pontas oferecem ao mesmo tempo.
    const peer: Peer = {
      pc, polite: myId.current > id, makingOffer: false, ignoreOffer: false,
      streams: new Map(), senders: { mic: [], screen: [] }, viewing: false,
    };
    peers.current.set(id, peer);

    pc.onicecandidate = (event) => { if (event.candidate) sendSignal(id, { candidate: event.candidate.toJSON() }); };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        sendSignal(id, { description: pc.localDescription });
      } catch { /* a próxima negociação tenta de novo */ } finally { peer.makingOffer = false; }
    };
    pc.onsignalingstatechange = () => { if (pc.signalingState === "stable") applyAllScreenState(); };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      peer.streams.set(stream.id, stream);
      event.track.onmute = bump;
      event.track.onunmute = bump;
      event.track.onended = () => { stream.removeTrack(event.track); bump(); };
      bump();
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") { void requestRelay(); pc.restartIce(); }
    };
    // Se em 12 s ainda não conectou, a rede provavelmente bloqueia a conexão direta: tenta o relay.
    peer.relayTimer = window.setTimeout(() => { if (pc.connectionState !== "connected") void requestRelay(); }, 12_000);

    if (micStream.current) addLocalTracks(peer, "mic", micStream.current);
    if (screenStream.current) addLocalTracks(peer, "screen", screenStream.current);
    // Quem tem o menor id inicia: o canal de dados dispara a primeira negociação mesmo sem mídia.
    if (myId.current < id) pc.createDataChannel("keepalive");
    return peer;
  }, [addLocalTracks, applyAllScreenState, bump, requestRelay, sendSignal]);

  const onSignal = useCallback(async (payload: SignalPayload) => {
    if (payload.to !== myId.current) return;
    const peer = createPeer(payload.from);
    const { pc } = peer;
    try {
      if (payload.description) {
        const collision = payload.description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription(payload.description);
        if (payload.description.type === "offer") {
          await pc.setLocalDescription();
          sendSignal(payload.from, { description: pc.localDescription });
        }
      } else if (payload.candidate) {
        try { await pc.addIceCandidate(payload.candidate); } catch (e) { if (!peer.ignoreOffer) throw e; }
      }
    } catch { /* sinal fora de ordem: a renegociação corrige */ }
  }, [createPeer, sendSignal]);

  const onWatch = useCallback((payload: WatchPayload) => {
    if (payload.to !== myId.current) return;
    createPeer(payload.from).viewing = !!payload.on;
    applyAllScreenState();
  }, [applyAllScreenState, createPeer]);

  const leave = useCallback(() => {
    if (beat.current) window.clearInterval(beat.current);
    beat.current = null;
    for (const id of [...peers.current.keys()]) closePeer(id);
    micStream.current?.getTracks().forEach((t) => t.stop());
    screenStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current = null;
    screenStream.current = null;
    if (channel.current) void supabase.current?.removeChannel(channel.current);
    channel.current = null;
    memberState.current = { mic: false, sharing: false };
    relayOn.current = false;
    knownSharers.current = new Set();
    watchingRef.current = [];
    setWatching([]);
    setNeedsCode(false);
    setRelayMsg(null);
    setMicOn(false);
    setSharing(false);
    setMembers([]);
  }, [closePeer]);

  useEffect(() => leave, [leave]);
  // Lembra o apelido usado da última vez neste aparelho.
  useEffect(() => {
    try { const saved = window.localStorage.getItem("zikachat:name"); if (saved) setName(saved); } catch { /* ignora */ }
  }, []);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end" }); }, [chat]);

  // Reenvia o pedido de "assistir" a cada 4 s: garante que o outro lado o receba mesmo se chegou antes da conexão.
  useEffect(() => {
    if (phase !== "in") return;
    const iv = window.setInterval(() => {
      for (const id of watchingRef.current) if (id !== myId.current) sendWatch(id, true);
    }, 4000);
    return () => window.clearInterval(iv);
  }, [phase, sendWatch]);

  const join = async () => {
    setError(null);
    setPhase("joining");
    try {
      const res = await fetch(`/api/salas/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não foi possível entrar na sala.");
      topic.current = data.topic;
      iceServers.current = data.iceServers ?? [];
      maxParticipants.current = data.maxParticipants ?? 13;

      const url = data.realtime?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = data.realtime?.key ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Tempo real indisponível neste ambiente (chave do Supabase não configurada).");
      myId.current = crypto.randomUUID();
      myName.current = cleanName(name);
      try { window.localStorage.setItem("zikachat:name", myName.current); } catch { /* sem armazenamento: segue sem lembrar */ }
      supabase.current ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 10 } } });
      const ch = supabase.current.channel(topic.current, { config: { broadcast: { self: false }, presence: { key: myId.current } } });
      channel.current = ch;

      ch.on("broadcast", { event: "signal" }, ({ payload }) => void onSignal(payload as SignalPayload));
      ch.on("broadcast", { event: "watch" }, ({ payload }) => onWatch(payload as WatchPayload));
      ch.on("broadcast", { event: "chat" }, ({ payload }) => {
        const line = payload as ChatLine;
        if (typeof line?.text !== "string") return;
        setChat((prev) => [...prev, { id: String(line.id), name: String(line.name).slice(0, 24), text: line.text.slice(0, 500), ts: Number(line.ts) || Date.now() }].slice(-MAX_CHAT));
      });
      let firstSync = true;
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, Array<{ name?: string; mic?: boolean; sharing?: boolean; screenId?: string }>>;
        // Cada track() novo acrescenta uma meta: vale a mais recente (a última).
        const list: Member[] = Object.entries(state).map(([id, metas]) => {
          const meta = metas[metas.length - 1];
          return { id, name: meta?.name ?? "Visitante", mic: !!meta?.mic, sharing: !!meta?.sharing, screenId: meta?.screenId };
        });
        if (firstSync) {
          firstSync = false;
          // Sala cheia: a contagem da presença vale como limite (best-effort).
          if (list.filter((m) => m.id !== myId.current).length >= maxParticipants.current) {
            leave();
            setError("Sala cheia.");
            setPhase("form");
            return;
          }
        }
        setMembers(list);
        const others = new Set(list.map((m) => m.id).filter((id) => id !== myId.current));
        for (const id of others) createPeer(id);
        for (const id of [...peers.current.keys()]) if (!others.has(id)) closePeer(id);

        // Telas: quem parou de compartilhar sai da lista de assistidas; se nada está sendo assistido,
        // a primeira tela nova abre sozinha (o jogador pode fechar ou escolher outras).
        const sharerIds = new Set(list.filter((m) => m.sharing && m.id !== myId.current).map((m) => m.id));
        let next = watchingRef.current.filter((id) => (id === myId.current ? memberState.current.sharing : sharerIds.has(id)));
        for (const id of sharerIds) {
          if (!knownSharers.current.has(id) && next.length === 0) { next = [id]; sendWatch(id, true); }
        }
        knownSharers.current = sharerIds;
        if (next.length !== watchingRef.current.length || next.some((id, i) => id !== watchingRef.current[i])) updateWatching(next);
        applyAllScreenState();
        bump();
      });

      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Tempo esgotado ao conectar.")), 10_000);
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") { window.clearTimeout(timer); resolve(); }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { window.clearTimeout(timer); reject(new Error("Falha ao conectar ao canal.")); }
        });
      });
      publishPresence();
      beat.current = window.setInterval(() => {
        void fetch(`/api/salas/${code}/heartbeat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: topic.current }) }).catch(() => null);
      }, 60_000);
      setPhase("in");
    } catch (e) {
      leave();
      setError(e instanceof Error ? e.message : "Erro ao entrar.");
      setPhase("form");
    }
  };

  const toggleMic = async () => {
    if (micStream.current) {
      micStream.current.getTracks().forEach((t) => t.stop());
      for (const peer of peers.current.values()) {
        peer.senders.mic.forEach((s) => { try { peer.pc.removeTrack(s); } catch { /* já removido */ } });
        peer.senders.mic = [];
      }
      micStream.current = null;
      setMicOn(false);
      memberState.current.mic = false;
      publishPresence();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      micStream.current = stream;
      for (const peer of peers.current.values()) addLocalTracks(peer, "mic", stream);
      setMicOn(true);
      memberState.current.mic = true;
      publishPresence();
    } catch {
      setError("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const stopScreen = useCallback(() => {
    screenStream.current?.getTracks().forEach((t) => t.stop());
    for (const peer of peers.current.values()) {
      peer.senders.screen.forEach((s) => { try { peer.pc.removeTrack(s); } catch { /* já removido */ } });
      peer.senders.screen = [];
    }
    screenStream.current = null;
    setSharing(false);
    memberState.current.sharing = false;
    memberState.current.screenId = undefined;
    if (watchingRef.current.includes(myId.current)) updateWatching(watchingRef.current.filter((id) => id !== myId.current));
    publishPresence();
  }, [publishPresence, updateWatching]);

  const toggleScreen = async () => {
    if (screenStream.current) { stopScreen(); return; }
    if (screenBusy.current) return; // evita dois seletores/compartilhamentos num duplo clique
    screenBusy.current = true;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(specDisplayMediaOptions(1280, 720, 15));
      screenStream.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", stopScreen);
      for (const peer of peers.current.values()) addLocalTracks(peer, "screen", stream);
      setSharing(true);
      memberState.current.sharing = true;
      memberState.current.screenId = stream.id;
      publishPresence();
    } catch { /* usuário cancelou o seletor */ } finally { screenBusy.current = false; }
  };

  const toggleWatch = (id: string) => {
    const on = !watchingRef.current.includes(id);
    updateWatching(on ? [...watchingRef.current, id] : watchingRef.current.filter((x) => x !== id));
    if (id !== myId.current) sendWatch(id, on);
  };

  const sendChat = () => {
    const text = draft.trim().slice(0, 500);
    if (!text || Date.now() - lastChatAt.current < 1000) return;
    lastChatAt.current = Date.now();
    const line: ChatLine = { id: crypto.randomUUID(), name: myName.current, text, ts: Date.now() };
    void channel.current?.send({ type: "broadcast", event: "chat", payload: line });
    setChat((prev) => [...prev, { ...line, mine: true }].slice(-MAX_CHAT));
    setDraft("");
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href).catch(() => null);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const backButton = (
    <Link href={backHref} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:border-[#FFCB05]/60 hover:text-[#FFCB05]">
      <ArrowLeft size={16} /> {backLabel}
    </Link>
  );

  if (phase !== "in") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6 py-8">
        <div>{backButton}</div>
        <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-widest text-[#FFCB05]">ZikaChat</p>
          <h1 className="text-xl font-bold text-white">Entrar na {label}</h1>
          <p className="text-sm text-slate-400">Sem cadastro. Escolha um apelido para entrar com voz, tela e chat.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (phase !== "joining") void join(); }} className="space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Seu apelido" aria-label="Seu apelido" autoFocus autoComplete="nickname" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB05]" />
            {hasPassword && (
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha da sala" aria-label="Senha da sala" autoComplete="off" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCB05]" />
            )}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={phase === "joining" || (hasPassword && !password)} className="w-full rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50">
              {phase === "joining" ? "Entrando..." : "Entrar"}
            </button>
          </form>
          <Link href="/salas" className="block text-center text-xs text-slate-400 hover:text-slate-200">Criar outra sala</Link>
        </div>
      </main>
    );
  }

  const others = members.filter((m) => m.id !== myId.current);
  const sharers = members.filter((m) => m.sharing);
  const watched = watching
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m);
  const gridCols = watched.length <= 1 ? "grid-cols-1" : watched.length <= 4 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-3 p-3 pb-24 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5">
        <div className="flex items-center gap-3">
          {backButton}
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Users size={16} /> <span className="font-bold text-white">{label}</span> · {members.length} na sala
          </div>
        </div>
        <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"><Copy size={14} />{copied ? "Link copiado" : "Copiar link"}</button>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p>}

      {(needsCode || relayMsg) && (
        <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          <p>{needsCode ? "Não foi possível conectar direto com alguém na sala. Para ativar a conexão reforçada, informe um código de convite da Liga." : relayMsg}</p>
          {needsCode && (
            <form onSubmit={async (e) => { e.preventDefault(); setRelayBusy(true); await requestRelay(relayCode); setRelayBusy(false); }} className="flex gap-2">
              <input value={relayCode} onChange={(e) => setRelayCode(e.target.value)} inputMode="numeric" maxLength={32} placeholder="Código de convite" aria-label="Código de convite" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <button type="submit" disabled={relayBusy || !relayCode.trim()} className="rounded-lg bg-[#FFCB05] px-3 py-2 text-sm font-bold text-slate-900 disabled:opacity-50">{relayBusy ? "..." : "Ativar"}</button>
            </form>
          )}
          {relayMsg && needsCode && <p className="text-xs text-amber-300">{relayMsg}</p>}
        </div>
      )}

      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_340px]">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Telas ao vivo</span>
            {sharers.length === 0 && <span className="text-sm text-slate-500">Ninguém está compartilhando. Use “Compartilhar tela” para começar.</span>}
            {sharers.map((m) => {
              const isMe = m.id === myId.current;
              const on = watching.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => toggleWatch(m.id)}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${on ? "border-[#FFCB05] bg-[#FFCB05]/15 text-[#FFCB05]" : "border-slate-600 text-slate-200 hover:border-slate-400"}`}
                >
                  {on ? <Eye size={14} /> : <EyeOff size={14} />}
                  {isMe ? "Sua tela" : m.name}
                  <span className="font-normal opacity-70">{on ? "assistindo" : "assistir"}</span>
                </button>
              );
            })}
          </div>

          {watched.length === 0 ? (
            <div className="flex aspect-video max-h-[60vh] w-full items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-center text-sm text-slate-500">
              {sharers.length > 0 ? "Escolha uma tela em “Telas ao vivo” para assistir." : others.length === 0 ? "Você está sozinho. Copie o link e convide alguém." : "Quando alguém compartilhar a tela, ela aparece aqui."}
            </div>
          ) : (
            <div className={`grid gap-3 ${gridCols}`}>
              {watched.map((m) => {
                const isMe = m.id === myId.current;
                return (
                  <ScreenTile
                    key={m.id}
                    title={isMe ? "Sua tela" : m.name}
                    ownPreview={isMe}
                    stream={isMe ? screenStream.current ?? undefined : peers.current.get(m.id)?.streams.get(m.screenId ?? "")}
                    version={version.current}
                    onClose={() => toggleWatch(m.id)}
                  />
                );
              })}
            </div>
          )}

          {others.map((m) => {
            const peer = peers.current.get(m.id);
            return peer ? <VoiceAudio key={m.id} streams={peer.streams} screenId={m.screenId} version={version.current} /> : null;
          })}

          <ul className="flex flex-wrap gap-2 text-xs">
            {members.map((m) => (
              <li key={m.id} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                {m.mic ? <Mic size={12} className="text-emerald-400" /> : <MicOff size={12} className="text-slate-500" />}
                {m.name}{m.id === myId.current ? " (você)" : ""}{m.sharing ? " · tela" : ""}
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex h-80 flex-col rounded-xl border border-slate-700 bg-slate-900/70 lg:h-[calc(100vh-12rem)] lg:min-h-[24rem]">
          <div role="log" aria-live="polite" aria-label="Mensagens da sala" className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {chat.length === 0 && <p className="text-xs text-slate-500">O chat some quando a sala encerra.</p>}
            {chat.map((line) => (
              <p key={line.id} className="break-words"><span className={`font-semibold ${line.mine ? "text-[#FFCB05]" : "text-cyan-300"}`}>{line.name}:</span> <span className="text-slate-200">{line.text}</span></p>
            ))}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2 border-t border-slate-700 p-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="Mensagem" aria-label="Mensagem" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <button type="submit" aria-label="Enviar" className="rounded-lg bg-[#FFCB05] px-3 text-slate-900"><Send size={16} /></button>
          </form>
        </aside>
      </div>

      <footer className="fixed inset-x-0 bottom-3 z-20 flex justify-center gap-2 px-3">
        <div className="flex gap-2 rounded-full border border-slate-700 bg-slate-950/90 p-1.5 shadow-xl shadow-black/40 backdrop-blur">
          <button onClick={toggleMic} aria-pressed={micOn} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${micOn ? "bg-emerald-500 text-slate-900" : "bg-slate-800 text-slate-200"}`}>{micOn ? <Mic size={16} /> : <MicOff size={16} />}<span className="hidden sm:inline">{micOn ? "Microfone ligado" : "Ligar microfone"}</span></button>
          <button onClick={toggleScreen} aria-pressed={sharing} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${sharing ? "bg-[#FFCB05] text-slate-900" : "bg-slate-800 text-slate-200"}`}>{sharing ? <MonitorX size={16} /> : <MonitorUp size={16} />}<span className="hidden sm:inline">{sharing ? "Parar tela" : "Compartilhar tela"}</span></button>
          <button onClick={() => { leave(); setPhase("form"); }} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white"><PhoneOff size={16} /><span className="hidden sm:inline">Sair</span></button>
        </div>
      </footer>
    </main>
  );
}
