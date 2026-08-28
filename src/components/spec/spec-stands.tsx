"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  heartbeatSpecPresenceAction, leaveSpecPresenceAction, getSpecStandsAction,
  createSpecPollAction, voteSpecPollAction, closeSpecPollAction,
  sendSpecChatMessageAction,
} from "@/app/(app)/spec/stands-actions";
import type { StandsState } from "@/app/(app)/spec/stands-actions";

type Stands = StandsState;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Arquibancada (lista de espectadores) + enquetes. `sendPresence` = o usuário
// entra na arquibancada (watch); no painel do transmissor fica false (ele não é
// espectador, mas vê a lista e gerencia enquetes).
export function SpecStands({ streamId, sendPresence }: { streamId: string; sendPresence: boolean }) {
  const [stands, setStands] = useState<Stands | null>(null);
  const revisionRef = useRef<string | undefined>(undefined);
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const response = await getSpecStandsAction(streamId, revisionRef.current).catch(() => null);
      if (!response) return;
      revisionRef.current = response.revision;
      if (!response.unchanged) {
        const { unchanged: _unchanged, revision: _revision, ...snapshot } = response;
        setStands(snapshot);
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [streamId]);

  // Heartbeat abaixo da janela de presença, mas sem escrever no banco a cada 15s.
  useEffect(() => {
    if (!sendPresence) return;
    void heartbeatSpecPresenceAction(streamId);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void heartbeatSpecPresenceAction(streamId);
    }, 25_000);
    const onHide = () => { void leaveSpecPresenceAction(streamId); };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", onHide);
      void leaveSpecPresenceAction(streamId);
    };
  }, [streamId, sendPresence]);

  // Atualiza arquibancada, enquete e chat em um único snapshot. Abas ocultas não
  // consomem egress; ao voltar, sincronizam imediatamente.
  useEffect(() => {
    void refresh();
    const tick = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(tick, 8_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  if (!stands) return null;

  return (
    <div className="space-y-4">
      <PollSection stands={stands} streamId={streamId} onChange={refresh} />
      <ChatSection stands={stands} streamId={streamId} onChange={refresh} />

      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-slate-900/80 to-slate-950/60">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-slate-950/40 px-4 py-2.5">
          <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#FFCB05]/80">
            🪑 Arquibancada
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            {stands.count} online
          </span>
        </div>
        {stands.spectators.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-slate-500">A arquibancada está vazia. Chame a galera pra assistir! 🎟️</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            {stands.spectators.map((s) => (
              <div key={s.userId} className="flex items-center gap-2 rounded-xl border border-border/60 bg-slate-900/60 px-2.5 py-2">
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFCB05]/30 to-purple-500/30 text-xs font-black text-white">
                  {initials(s.name)}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-400" />
                </span>
                <span className="min-w-0 truncate text-xs font-semibold text-slate-200">{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatSection({ stands, streamId, onChange }: { stands: Stands; streamId: string; onChange: () => void }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojis = ["😀", "😂", "😍", "🔥", "👏", "🎉", "⚡", "❤️", "👍", "👀", "🤔", "😱", "🏆", "🎮", "✨", "💜"];
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [stands.chat.length]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown]);
  const send = async () => {
    if (!message.trim() || sending || cooldown > 0) return;
    setSending(true);
    try {
      const res = await sendSpecChatMessageAction(streamId, message);
      if (!res.ok) {
        if (res.retryAfter) setCooldown(res.retryAfter);
        toast.error(res.error ?? "Falha ao enviar.");
        return;
      }
      setMessage(""); setCooldown(10); setShowEmoji(false); onChange();
    } catch {
      toast.error("A conexão falhou. O botão foi liberado para tentar novamente.");
    } finally {
      setSending(false);
    }
  };
  return <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950/60">
    <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5"><span className="text-[10px] font-black uppercase tracking-widest text-cyan-300">💬 Chat da transmissão</span><span className="text-[9px] font-bold text-slate-500">Modo lento · 10 segundos</span></header>
    <div className="h-56 space-y-2 overflow-y-scroll p-3 [scrollbar-gutter:stable]">
      {stands.chat.length === 0 && <p className="py-4 text-center text-xs text-slate-500">Seja o primeiro a falar na arquibancada.</p>}
      {stands.chat.map((item) => <div key={item.id} className="text-xs"><span className="font-black text-[#FFCB05]">{item.userName}: </span><span className="break-words text-slate-200">{item.message}</span></div>)}
      <div ref={bottomRef} />
    </div>
    {showEmoji && <div className="flex flex-wrap gap-1 border-t border-border bg-slate-900/70 px-3 py-2">{emojis.map((emoji) => <button key={emoji} type="button" onClick={() => setMessage((value) => `${value}${emoji}`.slice(0, 300))} className="rounded-md p-1.5 text-base hover:bg-white/10">{emoji}</button>)}</div>}
    <div className="flex gap-2 border-t border-border p-3">
      <button type="button" onClick={() => setShowEmoji((value) => !value)} aria-label="Escolher emoji" className={`rounded-lg border px-2.5 text-base ${showEmoji ? "border-cyan-400 bg-cyan-400/10" : "border-border bg-slate-900"}`}>😊</button>
      <input value={message} maxLength={300} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} placeholder="Escreva para a arquibancada…" className="min-w-0 flex-1 rounded-lg border border-border bg-slate-900 px-3 py-2 text-xs text-white" />
      <button onClick={send} disabled={sending || cooldown > 0 || !message.trim()} className="min-w-[4.5rem] rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40">{sending ? "Enviando…" : cooldown > 0 ? `${cooldown}s` : "Enviar"}</button>
    </div>
  </section>;
}

function PollSection({ stands, streamId, onChange }: { stands: Stands; streamId: string; onChange: () => void }) {
  const poll = stands.poll;
  const [voting, setVoting] = useState(false);

  const vote = async (index: number) => {
    if (!poll || voting) return;
    setVoting(true);
    const res = await voteSpecPollAction(poll.id, index);
    setVoting(false);
    if (!res.ok) { toast.error(res.error ?? "Falha ao votar."); return; }
    onChange();
  };

  const close = async () => {
    if (!poll) return;
    const res = await closeSpecPollAction(poll.id);
    if (!res.ok) { toast.error(res.error ?? "Falha ao encerrar."); return; }
    toast.success("Enquete encerrada.");
    onChange();
  };

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-purple-950/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-purple-200">🗳️ Enquete da arquibancada</p>
        {stands.canManage && poll && (
          <button onClick={close} className="text-[10px] font-bold text-slate-400 underline hover:text-slate-200">Encerrar</button>
        )}
      </div>

      {poll ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-bold text-white">{poll.question}</p>
          {poll.options.map((opt, i) => {
            const count = poll.counts[i] ?? 0;
            const pct = poll.totalVotes > 0 ? Math.round((count / poll.totalVotes) * 100) : 0;
            const mine = poll.myVote === i;
            return (
              <button
                key={i}
                onClick={() => vote(i)}
                disabled={voting}
                className={`relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:opacity-60 ${mine ? "border-[#FFCB05] text-white" : "border-border text-slate-300 hover:border-slate-500"}`}
              >
                <span className="absolute inset-y-0 left-0 bg-[#FFCB05]/15" style={{ width: `${pct}%` }} />
                <span className="relative flex items-center justify-between gap-2">
                  <span>{mine ? "✓ " : ""}{opt}</span>
                  <span className="text-slate-400">{pct}% · {count}</span>
                </span>
              </button>
            );
          })}
          <p className="text-[10px] text-slate-500">{poll.totalVotes} voto{poll.totalVotes === 1 ? "" : "s"} · toque para votar (pode trocar)</p>
        </div>
      ) : stands.canManage ? (
        <NewPollForm streamId={streamId} onCreated={onChange} />
      ) : (
        <p className="mt-2 text-xs text-slate-500">Nenhuma enquete ativa no momento.</p>
      )}
    </div>
  );
}

function NewPollForm({ streamId, onCreated }: { streamId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setSaving(true);
    const res = await createSpecPollAction(streamId, question, options);
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Falha ao criar."); return; }
    toast.success("Enquete no ar!");
    setQuestion(""); setOptions(["", ""]); setOpen(false);
    onCreated();
  };

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setTimeout(() => firstRef.current?.focus(), 0); }} className="mt-2 rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-500/20">
        + Criar enquete
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <input
        ref={firstRef}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Pergunta (ex.: Quem vence essa partida?)"
        className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500"
      />
      {options.map((opt, i) => (
        <input
          key={i}
          value={opt}
          onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
          placeholder={`Opção ${i + 1}`}
          className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500"
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {options.length < 6 && (
          <button onClick={() => setOptions((prev) => [...prev, ""])} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white">+ Opção</button>
        )}
        <button onClick={submit} disabled={saving} className="rounded-lg bg-[#FFCB05] px-3 py-1 text-[11px] font-black text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-50">Publicar</button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-200">Cancelar</button>
      </div>
    </div>
  );
}
