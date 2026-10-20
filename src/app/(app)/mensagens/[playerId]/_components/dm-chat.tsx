"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRealtimeSignal } from "@/hooks/use-realtime-signal";
import { sendMessageAction, pollNewMessagesAction, setDirectMessageMuteAction, type AttachmentData } from "../../actions";
import { ArrowLeft, Paperclip, Send, User, VolumeX, Volume2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AttachmentPicker } from "./attachment-picker";

type Message = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
  attachmentType: string | null;
  attachmentData: AttachmentData | null;
};

const DM_POLL_MS = 30000;

interface Props {
  me: { id: string; displayName: string };
  other: { id: string; displayName: string; avatarUrl: string | null };
  initialMessages: Message[];
  compact?: boolean;
  onBack?: () => void;
  muted?: boolean;
}

const RARITY_COLOR: Record<string, string> = {
  COMMON: "text-slate-400", UNCOMMON: "text-green-400", RARE: "text-blue-400",
  EPIC: "text-purple-400", LEGENDARY: "text-[#FFCB05]",
};

export function AttachmentCard({ data, mine }: { data: AttachmentData; mine: boolean }) {
  const base = mine
    ? "border-[#e6b800]/40 bg-[#e6b800]/10"
    : "border-slate-600 bg-slate-700/50";

  if (data.type === "MASCOT") {
    return (
      <div className={`mt-1.5 rounded-xl border ${base} px-3 py-2`}>
        <div className="flex items-center gap-2">
          <img src={data.spriteUrl} alt="" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-xs font-bold text-white">{data.nickname || data.displayName}</p>
            <p className="text-[10px] text-slate-400">{data.displayName} · Lv.{data.level}</p>
            {data.isShiny && <p className="text-[10px] text-yellow-400">✨ Shiny</p>}
            <p className="text-[10px] text-slate-500 italic">{data.personality}</p>
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-5 gap-1 text-center">
          {([
            ["Força", data.statForce],
            ["Agil.", data.statAgility],
            ["Car.", data.statCharisma],
            ["Inst.", data.statInstinct],
            ["Vit.", data.statVitality],
          ] as [string, number][]).map(([label, val]) => (
            <div key={label} className="flex flex-col rounded-lg bg-slate-800/60 px-1 py-0.5">
              <span className="text-[8px] text-slate-500">{label}</span>
              <span className="text-[10px] font-bold text-slate-200">{val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === "ITEM") {
    return (
      <div className={`mt-1.5 flex items-center gap-2 rounded-xl border ${base} px-3 py-2`}>
        {data.imageUrl ? (
          <img src={data.imageUrl} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-600 text-xl">📦</div>
        )}
        <div>
          <p className="text-xs font-bold text-white">{data.name}</p>
          <p className={`text-[10px] font-semibold ${RARITY_COLOR[data.rarity] ?? "text-slate-400"}`}>
            {data.rarity}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export function DmChat({ me, other, initialMessages, compact = false, onBack, muted = false }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentData | null>(null);
  const [isMuted, setIsMuted] = useState(muted);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("nav-alert-viewed", {
      detail: { category: "MESSAGE", entityId: other.id },
    }));
  }, [other.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const messagesRef = useRef<Message[]>(initialMessages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const addNewMessages = (raw: { id: string; content: string; senderId: string; senderName: string; senderAvatar: string | null; createdAt: string; attachmentType: string | null; attachmentData: AttachmentData | null }[]) => {
    if (raw.length === 0) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const deduped = raw.filter((m) => !ids.has(m.id));
      return deduped.length > 0 ? [...prev, ...deduped] : prev;
    });
  };

  // Entrega imediata: o servidor sinaliza "dm" no tópico do destinatário e esta
  // conversa busca as mensagens novas pela action autenticada.
  const pollRef = useRef<() => Promise<void>>(async () => {});
  useRealtimeSignal(`player:${me.id}`, (event, payload) => {
    if (event !== "dm" || payload.from !== other.id) return;
    if (document.visibilityState === "visible") void pollRef.current();
  });

  // Polling de segurança: garante entrega mesmo se o WebSocket cair, mas sem
  // martelar o banco quando a aba está em segundo plano.
  useEffect(() => {
    let disposed = false;

    const poll = pollRef.current = async () => {
      if (document.visibilityState !== "visible") return;
      const cur = messagesRef.current;
      const latest = cur[cur.length - 1];
      const afterIso = latest ? latest.createdAt : new Date(0).toISOString();
      const res = await pollNewMessagesAction(other.id, afterIso);
      if (disposed) return;
      if (!res.ok || res.messages.length === 0) return;
      addNewMessages(res.messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderId === me.id ? me.displayName : other.displayName,
        senderAvatar: m.senderId === me.id ? null : other.avatarUrl,
        createdAt: m.createdAt.toISOString(),
        attachmentType: m.attachmentType,
        attachmentData: (m.attachmentData as AttachmentData) ?? null,
      })));
    };

    const onVisible = () => { void poll(); };
    const id = setInterval(() => { void poll(); }, DM_POLL_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      disposed = true;
      clearInterval(id);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [other.id]);


  const handleSend = () => {
    if (isMuted) return;
    const val = text.trim();
    if (!val && !attachment) return;
    setText("");
    const att = attachment;
    setAttachment(null);

    start(async () => {
      const res = await sendMessageAction(other.id, val, att ?? undefined);
      if (!res.ok) { toast.error(res.error); return; }

      const msg: Message = {
        id: res.message.id,
        content: res.message.content,
        senderId: res.message.senderId,
        senderName: res.message.sender.displayName,
        senderAvatar: res.message.sender.avatarUrl ?? null,
        createdAt: res.message.createdAt.toISOString(),
        attachmentType: res.message.attachmentType,
        attachmentData: (res.message.attachmentData as AttachmentData) ?? null,
      };

      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
    });
  };

  const toggleMute = () => start(async () => {
    const next = !isMuted;
    const res = await setDirectMessageMuteAction(other.id, next);
    if (!res.ok) { toast.error(res.error); return; }
    setIsMuted(next);
    toast.success(next ? "Jogador silenciado: não poderá enviar mensagens nem anexos." : "Silenciamento removido.");
  });

  return (
    <div
      className={compact ? "flex h-full min-h-0 flex-col" : "mx-auto flex max-w-2xl flex-col"}
      style={compact ? undefined : { height: "calc(100vh - 80px)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        {onBack ? (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} aria-label="Voltar para conversas">
            <ArrowLeft size={16} />
          </Button>
        ) : (
        <Link href="/mensagens">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        )}
        {other.avatarUrl ? (
          <img src={other.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800">
            <User size={14} className="text-slate-500" />
          </div>
        )}
        <Link href={`/jogadores/${other.id}`} className="font-medium text-white hover:text-[#FFCB05] transition-colors">
          {other.displayName}
        </Link>
        <button type="button" disabled={pending} onClick={toggleMute} title={isMuted ? "Permitir mensagens deste jogador" : "Silenciar jogador"} className={`ml-auto rounded-lg border p-2 ${isMuted ? "border-red-400/40 text-red-300" : "border-slate-700 text-slate-400 hover:text-white"}`}>
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-slate-500 py-8">
            Início da conversa com {other.displayName}
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === me.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
              {!isMine && (
                msg.senderAvatar ? (
                  <img src={msg.senderAvatar} alt="" className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800">
                    <User size={12} className="text-slate-500" />
                  </div>
                )
              )}
              <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
                {msg.content && (
                  <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    isMine ? "rounded-br-sm bg-[#FFCB05] text-[#1A1A2E]" : "rounded-bl-sm bg-slate-800 text-slate-100"
                  }`}>
                    {msg.content}
                  </div>
                )}
                {msg.attachmentData && (
                  <AttachmentCard data={msg.attachmentData} mine={isMine} />
                )}
                <span className="text-[10px] text-slate-600">
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        {isMuted && <p className="mb-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">Você silenciou este jogador. Ele não pode enviar mensagens ou anexos até você reverter isso.</p>}
        {/* Preview do anexo selecionado */}
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-3 py-2">
            {attachment.type === "MASCOT" && (
              <>
                <img src={attachment.spriteUrl} alt="" className="h-8 w-8 object-contain" />
                <span className="text-xs text-slate-300">{attachment.nickname || attachment.displayName} · Lv.{attachment.level}</span>
              </>
            )}
            {attachment.type === "ITEM" && (
              <>
                {attachment.imageUrl
                  ? <img src={attachment.imageUrl} alt="" className="h-8 w-8 object-contain" />
                  : <span className="text-xl">📦</span>
                }
                <span className="text-xs text-slate-300">{attachment.name}</span>
              </>
            )}
            <button onClick={() => setAttachment(null)} className="ml-auto text-slate-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="relative">
          {showPicker && (
            <AttachmentPicker
              onSelect={(a) => { setAttachment(a); setShowPicker(false); }}
              onClose={() => setShowPicker(false)}
            />
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              disabled={isMuted}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                showPicker || attachment
                  ? "border-[#FFCB05]/60 bg-[#FFCB05]/10 text-[#FFCB05]"
                  : "border-border bg-slate-900 text-slate-500 hover:text-slate-300"
              }`}
            >
              <Paperclip size={16} />
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={attachment ? "Adicione uma mensagem (opcional)…" : `Mensagem para ${other.displayName}…`}
              maxLength={500}
              className="flex-1 rounded-xl border border-border bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[#FFCB05]/40"
              disabled={pending || isMuted}
            />
            <Button
              type="submit"
              size="icon"
              disabled={pending || isMuted || (!text.trim() && !attachment)}
              className="h-10 w-10 shrink-0 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40"
            >
              <Send size={16} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
