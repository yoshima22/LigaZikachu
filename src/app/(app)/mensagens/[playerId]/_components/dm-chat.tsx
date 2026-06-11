"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { sendMessageAction } from "../../actions";
import { ArrowLeft, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Message = {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  createdAt: string;
};

interface Props {
  me: { id: string; displayName: string };
  other: { id: string; displayName: string; avatarUrl: string | null };
  initialMessages: Message[];
}

function channelName(a: string, b: string) {
  return `dm:${[a, b].sort().join("-")}`;
}

export function DmChat({ me, other, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseRef = useRef<any>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Subscribe to broadcast channel
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    supabaseRef.current = supabase;

    const channel = supabase.channel(channelName(me.id, other.id));

    channel
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as Message;
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me.id, other.id]);

  const handleSend = () => {
    const val = text.trim();
    if (!val) return;
    setText("");

    start(async () => {
      const res = await sendMessageAction(other.id, val);
      if (!res.ok) return;

      const msg: Message = {
        id: res.message.id,
        content: res.message.content,
        senderId: res.message.senderId,
        senderName: res.message.sender.displayName,
        senderAvatar: res.message.sender.avatarUrl ?? null,
        createdAt: res.message.createdAt.toISOString(),
      };

      // Add locally (optimistic)
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));

      // Broadcast to the other user
      const supabase = supabaseRef.current;
      if (!supabase) return;
      await supabase.channel(channelName(me.id, other.id)).send({
        type: "broadcast",
        event: "new_message",
        payload: msg,
      });
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
              <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                <div
                  className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    isMine
                      ? "rounded-br-sm bg-[#FFCB05] text-[#1A1A2E]"
                      : "rounded-bl-sm bg-slate-800 text-slate-100"
                  }`}
                >
                  {msg.content}
                </div>
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
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Mensagem para ${other.displayName}…`}
            maxLength={500}
            className="flex-1 rounded-xl border border-border bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-[#FFCB05]/40"
            disabled={pending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={pending || !text.trim()}
            className="h-10 w-10 shrink-0 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40"
          >
            <Send size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}
