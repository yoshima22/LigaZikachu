"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { Copy, Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Send, Users } from "lucide-react";
import { specDisplayMediaOptions } from "@/lib/spec/webrtc-client";

type Member = { id: string; name: string; mic: boolean; sharing: boolean };
type ChatLine = { id: string; name: string; text: string; ts: number; mine?: boolean };
type SignalPayload = { from: string; to: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
type Peer = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  stream: MediaStream;
  senders: { mic: RTCRtpSender[]; screen: RTCRtpSender[] };
  relayTimer?: number;
};

const MAX_CHAT = 200;
// Em malha, quem compartilha a tela envia um fluxo para cada pessoa: divide um orçamento total de upload.
const SCREEN_MAX_BITRATE = 1_500_000;
const SCREEN_MIN_BITRATE = 200_000;
const SCREEN_UPLOAD_BUDGET = 4_000_000;

function cleanName(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 24) || `Visitante ${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Mídia remota de um participante: o <video> sempre toca o áudio e só fica visível quando há tela ao vivo. */
function RemoteMedia({ member, stream, version }: { member: Member; stream: MediaStream | undefined; version: number }) {
  const hasVideo = !!stream?.getVideoTracks().some((t) => t.readyState === "live" && !t.muted);
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-700 bg-slate-950 ${hasVideo ? "" : "hidden"}`} data-v={version}>
      <video
        autoPlay
        playsInline
        ref={(el) => { if (el && stream && el.srcObject !== stream) el.srcObject = stream; }}
        className="aspect-video w-full bg-black object-contain"
      />
      <p className="px-2 py-1 text-xs text-slate-300">Tela de {member.name}</p>
    </div>
  );
}

export function QuickRoomClient({ code, label, hasPassword }: { code: string; label: string; hasPassword: boolean }) {
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
  const memberState = useRef({ mic: false, sharing: false });
  const relayOn = useRef(false);

  const bump = useCallback(() => { version.current += 1; setVersion(version.current); }, []);

  const sendSignal = useCallback((to: string, body: { description?: RTCSessionDescriptionInit | null; candidate?: RTCIceCandidateInit }) => {
    void channel.current?.send({ type: "broadcast", event: "signal", payload: { from: myId.current, to, ...body } });
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

  /** Reparte o orçamento de upload da tela entre os espectadores (com 12 pessoas, ~330 kbps cada). */
  const applyScreenBitrate = useCallback(() => {
    const viewers = Math.max(1, peers.current.size);
    const bitrate = Math.round(Math.min(SCREEN_MAX_BITRATE, Math.max(SCREEN_MIN_BITRATE, SCREEN_UPLOAD_BUDGET / viewers)));
    for (const peer of peers.current.values()) {
      for (const sender of peer.senders.screen) {
        if (sender.track?.kind !== "video") continue;
        const params = sender.getParameters();
        if (!params.encodings?.length) params.encodings = [{}];
        if (params.encodings[0].maxBitrate === bitrate) continue;
        params.encodings[0].maxBitrate = bitrate;
        void sender.setParameters(params).catch(() => null);
      }
    }
  }, []);

  const addLocalTracks = useCallback((peer: Peer, kind: "mic" | "screen", stream: MediaStream) => {
    for (const track of stream.getTracks()) {
      const sender = peer.pc.addTrack(track, stream);
      peer.senders[kind].push(sender);
    }
    applyScreenBitrate();
  }, [applyScreenBitrate]);

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
    const peer: Peer = { pc, polite: myId.current > id, makingOffer: false, ignoreOffer: false, stream: new MediaStream(), senders: { mic: [], screen: [] } };
    peers.current.set(id, peer);

    pc.onicecandidate = (event) => { if (event.candidate) sendSignal(id, { candidate: event.candidate.toJSON() }); };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        sendSignal(id, { description: pc.localDescription });
      } catch { /* a próxima negociação tenta de novo */ } finally { peer.makingOffer = false; }
    };
    pc.ontrack = (event) => {
      if (!peer.stream.getTracks().includes(event.track)) peer.stream.addTrack(event.track);
      event.track.onmute = bump;
      event.track.onunmute = bump;
      event.track.onended = () => { peer.stream.removeTrack(event.track); bump(); };
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
  }, [addLocalTracks, bump, requestRelay, sendSignal]);

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
    setNeedsCode(false);
    setRelayMsg(null);
    setMicOn(false);
    setSharing(false);
    setMembers([]);
  }, [closePeer]);

  useEffect(() => leave, [leave]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "end" }); }, [chat]);

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
      supabase.current ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 10 } } });
      const ch = supabase.current.channel(topic.current, { config: { broadcast: { self: false }, presence: { key: myId.current } } });
      channel.current = ch;

      ch.on("broadcast", { event: "signal" }, ({ payload }) => void onSignal(payload as SignalPayload));
      ch.on("broadcast", { event: "chat" }, ({ payload }) => {
        const line = payload as ChatLine;
        if (typeof line?.text !== "string") return;
        setChat((prev) => [...prev, { id: String(line.id), name: String(line.name).slice(0, 24), text: line.text.slice(0, 500), ts: Number(line.ts) || Date.now() }].slice(-MAX_CHAT));
      });
      let firstSync = true;
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, Array<{ name?: string; mic?: boolean; sharing?: boolean }>>;
        // Cada track() novo acrescenta uma meta: vale a mais recente (a última).
        const list: Member[] = Object.entries(state).map(([id, metas]) => {
          const meta = metas[metas.length - 1];
          return { id, name: meta?.name ?? "Visitante", mic: !!meta?.mic, sharing: !!meta?.sharing };
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
        applyScreenBitrate();
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
    publishPresence();
  }, [publishPresence]);

  const toggleScreen = async () => {
    if (screenStream.current) { stopScreen(); return; }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(specDisplayMediaOptions(1280, 720, 15));
      screenStream.current = stream;
      stream.getVideoTracks()[0]?.addEventListener("ended", stopScreen);
      for (const peer of peers.current.values()) addLocalTracks(peer, "screen", stream);
      setSharing(true);
      memberState.current.sharing = true;
      publishPresence();
    } catch { /* usuário cancelou o seletor */ }
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

  if (phase !== "in") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-6 py-12">
        <div className="w-full space-y-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-widest text-[#FFCB05]">Sala rápida</p>
          <h1 className="text-xl font-bold text-white">Entrar na {label}</h1>
          <p className="text-sm text-slate-400">Sem cadastro. Escolha um apelido para entrar com voz, tela e chat.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Seu apelido" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          {hasPassword && (
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha da sala" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          )}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button onClick={join} disabled={phase === "joining" || (hasPassword && !password)} className="w-full rounded-lg bg-[#FFCB05] px-4 py-2 text-sm font-bold text-slate-900 disabled:opacity-50">
            {phase === "joining" ? "Entrando..." : "Entrar"}
          </button>
          <div className="flex justify-between text-xs text-slate-500">
            <Link href="/" className="hover:text-slate-300">← Liga Zikachu</Link>
            <Link href="/salas" className="hover:text-slate-300">Criar outra sala</Link>
          </div>
        </div>
      </main>
    );
  }

  const others = members.filter((m) => m.id !== myId.current);
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-3 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Users size={16} /> <span className="font-bold text-white">{label}</span> · {members.length} na sala
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"><Copy size={14} />{copied ? "Link copiado" : "Copiar link"}</button>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p>}

      {(needsCode || relayMsg) && (
        <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          <p>{needsCode ? "Não foi possível conectar direto com alguém na sala. Para ativar a conexão reforçada, informe um código de convite da Liga." : relayMsg}</p>
          {needsCode && (
            <form
              onSubmit={async (e) => { e.preventDefault(); setRelayBusy(true); await requestRelay(relayCode); setRelayBusy(false); }}
              className="flex gap-2"
            >
              <input value={relayCode} onChange={(e) => setRelayCode(e.target.value)} inputMode="numeric" maxLength={32} placeholder="Código de convite" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <button type="submit" disabled={relayBusy || !relayCode.trim()} className="rounded-lg bg-[#FFCB05] px-3 py-2 text-sm font-bold text-slate-900 disabled:opacity-50">{relayBusy ? "..." : "Ativar"}</button>
            </form>
          )}
          {relayMsg && needsCode && <p className="text-xs text-amber-300">{relayMsg}</p>}
        </div>
      )}

      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {sharing && screenStream.current && (
              <div className="overflow-hidden rounded-xl border border-[#FFCB05]/40 bg-slate-950">
                <video autoPlay muted playsInline ref={(el) => { if (el && screenStream.current && el.srcObject !== screenStream.current) el.srcObject = screenStream.current; }} className="aspect-video w-full bg-black object-contain" />
                <p className="px-2 py-1 text-xs text-slate-300">Sua tela</p>
              </div>
            )}
            {others.map((m) => <RemoteMedia key={m.id} member={m} stream={peers.current.get(m.id)?.stream} version={version.current} />)}
          </div>
          {others.length === 0 && !sharing && <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Você está sozinho. Copie o link e convide alguém.</p>}
          <ul className="flex flex-wrap gap-2 text-xs">
            {members.map((m) => (
              <li key={m.id} className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                {m.mic ? <Mic size={12} className="text-emerald-400" /> : <MicOff size={12} className="text-slate-500" />}
                {m.name}{m.id === myId.current ? " (você)" : ""}{m.sharing ? " · tela" : ""}
              </li>
            ))}
          </ul>
        </section>

        <aside className="flex h-[60vh] flex-col rounded-xl border border-slate-700 bg-slate-900/70 lg:h-auto">
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {chat.length === 0 && <p className="text-xs text-slate-500">O chat some quando a sala encerra.</p>}
            {chat.map((line) => (
              <p key={line.id} className="break-words"><span className={`font-semibold ${line.mine ? "text-[#FFCB05]" : "text-cyan-300"}`}>{line.name}:</span> <span className="text-slate-200">{line.text}</span></p>
            ))}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="flex gap-2 border-t border-slate-700 p-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} placeholder="Mensagem" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <button type="submit" aria-label="Enviar" className="rounded-lg bg-[#FFCB05] px-3 text-slate-900"><Send size={16} /></button>
          </form>
        </aside>
      </div>

      <footer className="sticky bottom-3 flex justify-center gap-2">
        <button onClick={toggleMic} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${micOn ? "bg-emerald-500 text-slate-900" : "bg-slate-800 text-slate-200"}`}>{micOn ? <Mic size={16} /> : <MicOff size={16} />}{micOn ? "Microfone ligado" : "Ligar microfone"}</button>
        <button onClick={toggleScreen} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${sharing ? "bg-[#FFCB05] text-slate-900" : "bg-slate-800 text-slate-200"}`}>{sharing ? <MonitorX size={16} /> : <MonitorUp size={16} />}{sharing ? "Parar tela" : "Compartilhar tela"}</button>
        <button onClick={() => { leave(); setPhase("form"); }} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white"><PhoneOff size={16} />Sair</button>
      </footer>
    </main>
  );
}
