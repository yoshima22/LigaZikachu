"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { sendMessageAction, pollNewMessagesAction, type AttachmentData } from "../../actions";
import { ArrowLeft, Paperclip, Send, User, X } from "lucide-react";
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

interface Props {
  me: { id: string; displayName: string };
  other: { id: string; displayName: string; avatarUrl: string | null };
  initialMessages: Message[];
}

const RARITY_COLOR: Record<string, string> = {
  COMMON: "text-slate-400", UNCOMMON: "text-green-400", RARE: "text-blue-400",
  EPIC: "text-purple-400", LEGENDARY: "text-[#FFCB05]",
};

function AttachmentCard({ data, mine }: { data: AttachmentData; mine: boolean }) {
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

export function DmChat({ me, other, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [showPicker, setShowPicker] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // Realtime: postgres_changes com filtro receiver_id para entrega imediata
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { params: { eventsPerSecond: 2 } },
    });

    const channel = supabase
      .channel(`dm-inbox-${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${me.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string; content: string; sender_id: string; receiver_id: string;
            created_at: string; attachment_type: string | null; attachment_data: AttachmentData | null;
          };
          // só processa mensagens desta conversa
          if (row.sender_id !== other.id) return;
          addNewMessages([{
            id: row.id,
            content: row.content,
            senderId: row.sender_id,
            senderName: other.displayName,
            senderAvatar: other.avatarUrl,
            createdAt: row.created_at,
            attachmentType: row.attachment_type,
            attachmentData: row.attachment_data,
          }]);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [me.id, other.id, other.displayName, other.avatarUrl]);

  // Polling fallback: garante entrega mesmo se o WebSocket cair
  useEffect(() => {
    const poll = async () => {
      const cur = messagesRef.current;
      const latest = cur[cur.length - 1];
      const afterIso = latest ? latest.createdAt : new Date(0).toISOString();
      const res = await pollNewMessagesAction(other.id, afterIso);
      if (!res.ok || res.messages.length === 0) return;
      addNewMessages(res.messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.sender.displayName,
        senderAvatar: m.sender.avatarUrl ?? null,
        createdAt: m.createdAt.toISOString(),
        attachmentType: m.attachmentType,
        attachmentData: (m.attachmentData as AttachmentData) ?? null,
      })));
    };

    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [other.id]);


  const handleSend = () => {
    const val = text.trim();
    if (!val && !attachment) return;
    setText("");
    const att = attachment;
    setAttachment(null);

    start(async () => {
      const res = await sendMessageAction(other.id, val, att ?? undefined);
      if (!res.ok) return;

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col" style={{ height: "calc(100vh - 80px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <Link href="/mensagens">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
        </Link>
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
              disabled={pending}
            />
            <Button
              type="submit"
              size="icon"
              disabled={pending || (!text.trim() && !attachment)}
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
