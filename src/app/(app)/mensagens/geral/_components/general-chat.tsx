"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Paperclip, Send, Users, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AttachmentPicker } from "../../[playerId]/_components/attachment-picker";
import { AttachmentCard } from "../../[playerId]/_components/dm-chat";
import { pollGeneralMessagesAction, sendGeneralMessageAction, type AttachmentData } from "../../actions";

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

const GENERAL_POLL_MS = 30000;

interface Props {
  me: { id: string; displayName: string };
  initialMessages: Message[];
}

export function GeneralChat({ me, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<AttachmentData | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>(initialMessages);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const addNewMessages = (raw: Message[]) => {
    if (raw.length === 0) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const deduped = raw.filter((m) => !ids.has(m.id));
      return deduped.length > 0 ? [...prev, ...deduped] : prev;
    });
  };

  const fetchNewMessages = async () => {
    const cur = messagesRef.current;
    const latest = cur[cur.length - 1];
    const afterIso = latest ? latest.createdAt : new Date(0).toISOString();
    const res = await pollGeneralMessagesAction(afterIso);
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

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { params: { eventsPerSecond: 2 } },
    });

    const channel = supabase
      .channel("general-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "general_chat_messages" },
        (payload) => {
          const row = payload.new as { sender_id: string };
          if (row.sender_id === me.id) return;
          void fetchNewMessages();
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [me.id]);

  useEffect(() => {
    let disposed = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      if (disposed) return;
      await fetchNewMessages();
    };

    const onVisible = () => { void poll(); };
    const id = setInterval(poll, GENERAL_POLL_MS);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      clearInterval(id);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const handleSend = () => {
    const val = text.trim();
    if (!val && !attachment) return;
    setText("");
    const att = attachment;
    setAttachment(null);

    start(async () => {
      const res = await sendGeneralMessageAction(val, att ?? undefined);
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col" style={{ height: "calc(100vh - 80px)" }}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <Link href="/mensagens">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFCB05]/10">
          <Users size={16} className="text-[#FFCB05]" />
        </div>
        <div>
          <p className="font-semibold text-white">Chat Geral da Liga</p>
          <p className="text-[11px] text-slate-500">Conversa aberta para jogadores ativos.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.senderId === me.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
              {!isMine && (
                msg.senderAvatar ? (
                  <img src={msg.senderAvatar} alt="" className="mt-1 h-7 w-7 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] text-slate-500">
                    {msg.senderName[0] ?? "?"}
                  </div>
                )
              )}
              <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
                {!isMine && <span className="text-[10px] font-semibold text-slate-500">{msg.senderName}</span>}
                {msg.content && (
                  <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    isMine ? "rounded-br-sm bg-[#FFCB05] text-[#1A1A2E]" : "rounded-bl-sm bg-slate-800 text-slate-100"
                  }`}>
                    {msg.content}
                  </div>
                )}
                {msg.attachmentData && <AttachmentCard data={msg.attachmentData} mine={isMine} />}
                <span className="text-[10px] text-slate-600">
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border px-4 py-3 shrink-0">
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/5 px-3 py-2">
            <span className="text-xs text-slate-300">
              Anexo: {attachment.type === "MASCOT" ? (attachment.nickname || attachment.displayName) : attachment.name}
            </span>
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
              placeholder={attachment ? "Adicione uma mensagem (opcional)..." : "Mensagem para o chat geral..."}
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
