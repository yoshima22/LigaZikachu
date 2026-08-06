"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink, Loader2, MessageCircle, Minus, Search, User, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getConversationAction,
  getGeneralChatAction,
  getInboxAction,
  searchMessageRecipientsAction,
  type AttachmentData,
} from "../mensagens/actions";
import { DmChat } from "../mensagens/[playerId]/_components/dm-chat";
import { GeneralChat } from "../mensagens/geral/_components/general-chat";

type Conversation = {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  lastContent: string;
  lastAttachmentType: string | null;
  lastAt: Date;
  unread: number;
};

type Player = { id: string; displayName: string; avatarUrl: string | null };

type DirectData = {
  me: { id: string; displayName: string };
  other: Player;
  initialMessages: Array<{
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    createdAt: string;
    attachmentType: string | null;
    attachmentData: AttachmentData | null;
  }>;
};

type GeneralData = {
  me: { id: string; displayName: string };
  initialMessages: Array<{
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    createdAt: string;
    attachmentType: string | null;
    attachmentData: AttachmentData | null;
  }>;
};

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400">
      <User size={16} />
      <span className="sr-only">{name}</span>
    </div>
  );
}

function previewLabel(conversation: Conversation) {
  if (conversation.lastAttachmentType === "MASCOT") return conversation.lastContent || "Mascote compartilhado";
  if (conversation.lastAttachmentType === "ITEM") return conversation.lastContent || "Item compartilhado";
  return conversation.lastContent || "Nova conversa";
}

export function DesktopChatDock({
  onClose,
  onUnreadChange,
}: {
  onClose: () => void;
  onUnreadChange: (count: number) => void;
}) {
  const [view, setView] = useState<"INBOX" | "DIRECT" | "GENERAL">("INBOX");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [directData, setDirectData] = useState<DirectData | null>(null);
  const [generalData, setGeneralData] = useState<GeneralData | null>(null);
  const loadedRef = useRef(false);

  const loadInbox = async () => {
    setLoading(true);
    try {
      const result = await getInboxAction();
      if (!result.ok) return;
      setConversations(result.conversations);
      onUnreadChange(result.totalUnread);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as mensagens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadInbox();
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (!normalized) {
      setPlayers([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await searchMessageRecipientsAction(normalized);
        if (!cancelled) setPlayers(result.ok ? result.players : []);
      } catch {
        if (!cancelled) setPlayers([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const openDirect = async (playerId: string) => {
    const unread = conversations.find((item) => item.partnerId === playerId)?.unread ?? 0;
    setLoading(true);
    try {
      const result = await getConversationAction(playerId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirectData({
        me: result.me,
        other: result.other,
        initialMessages: result.messages.map((message) => ({
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          senderName: message.senderId === result.me.id ? result.me.displayName : result.other.displayName,
          senderAvatar: message.senderId === result.me.id ? null : result.other.avatarUrl,
          createdAt: message.createdAt.toISOString(),
          attachmentType: message.attachmentType,
          attachmentData: (message.attachmentData as AttachmentData) ?? null,
        })),
      });
      setConversations((current) => current.map((item) => item.partnerId === playerId ? { ...item, unread: 0 } : item));
      if (unread > 0) onUnreadChange(Math.max(0, conversations.reduce((sum, item) => sum + item.unread, 0) - unread));
      setView("DIRECT");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir a conversa.");
    } finally {
      setLoading(false);
    }
  };

  const openGeneral = async () => {
    setLoading(true);
    try {
      const result = await getGeneralChatAction();
      setGeneralData({
        me: result.me,
        initialMessages: result.messages.map((message) => ({
          id: message.id,
          content: message.content,
          senderId: message.senderId,
          senderName: message.sender.displayName,
          senderAvatar: message.sender.avatarUrl,
          createdAt: message.createdAt.toISOString(),
          attachmentType: message.attachmentType,
          attachmentData: (message.attachmentData as AttachmentData) ?? null,
        })),
      });
      setView("GENERAL");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir o Chat Geral.");
    } finally {
      setLoading(false);
    }
  };

  const backToInbox = () => {
    setView("INBOX");
    setDirectData(null);
    setGeneralData(null);
    void loadInbox();
  };

  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const conversationIds = useMemo(() => new Set(conversations.map((item) => item.partnerId)), [conversations]);
  const visibleConversations = normalizedQuery
    ? conversations.filter((item) => item.partnerName.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
    : conversations;
  const newPlayers = normalizedQuery
    ? players.filter((player) => !conversationIds.has(player.id) && player.displayName.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
    : [];

  return (
    <aside className="fixed bottom-4 right-4 z-50 hidden h-[min(680px,calc(100vh-105px))] w-[390px] overflow-hidden rounded-2xl border border-[#FFCB05]/25 bg-[#090b18] shadow-2xl shadow-black/60 lg:flex lg:flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-gradient-to-r from-[#1A1A2E] to-[#11162a] px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFCB05] text-[#1A1A2E]">
          <MessageCircle size={17} fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Mensagens</p>
          <p className="text-[10px] text-slate-500">Chat da Liga durante a navegação</p>
        </div>
        <Link href="/mensagens" title="Abrir página de mensagens" className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-[#FFCB05]">
          <ExternalLink size={15} />
        </Link>
        <button type="button" onClick={onClose} title="Recolher chat" className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white">
          <Minus size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {loading && view === "INBOX" ? (
          <div className="flex h-full items-center justify-center text-slate-500"><Loader2 size={22} className="animate-spin" /></div>
        ) : view === "DIRECT" && directData ? (
          <DmChat key={directData.other.id} {...directData} compact onBack={backToInbox} />
        ) : view === "GENERAL" && generalData ? (
          <GeneralChat key="general-dock" {...generalData} compact onBack={backToInbox} />
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 space-y-3 border-b border-slate-800 p-3">
              <button type="button" onClick={() => void openGeneral()} className="flex w-full items-center gap-3 rounded-xl border border-[#FFCB05]/25 bg-[#FFCB05]/10 p-3 text-left hover:bg-[#FFCB05]/15">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFCB05] text-[#1A1A2E]"><Users size={17} /></div>
                <div><p className="text-sm font-bold text-[#FFCB05]">Chat Geral da Liga</p><p className="text-[11px] text-slate-400">Converse com todos os jogadores</p></div>
              </button>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jogador ou conversa..." className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#FFCB05]/40" />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {visibleConversations.length === 0 && newPlayers.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-slate-500">{normalizedQuery ? "Nenhum jogador encontrado." : "Nenhuma conversa ainda. Busque um jogador para começar."}</p>
              ) : (
                <div className="space-y-1">
                  {visibleConversations.map((conversation) => (
                    <button key={conversation.partnerId} type="button" onClick={() => void openDirect(conversation.partnerId)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-900">
                      <Avatar url={conversation.partnerAvatar} name={conversation.partnerName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${conversation.unread ? "font-bold text-white" : "font-medium text-slate-200"}`}>{conversation.partnerName}</p>
                          <span className="shrink-0 text-[9px] text-slate-600">{formatDistanceToNow(new Date(conversation.lastAt), { addSuffix: true, locale: ptBR })}</span>
                        </div>
                        <p className={`truncate text-[11px] ${conversation.unread ? "text-slate-200" : "text-slate-500"}`}>{previewLabel(conversation)}</p>
                      </div>
                      {conversation.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FFCB05] px-1 text-[9px] font-black text-[#1A1A2E]">{conversation.unread}</span>}
                    </button>
                  ))}
                  {newPlayers.length > 0 && <p className="px-3 pb-1 pt-3 text-[9px] font-bold uppercase tracking-widest text-slate-600">Iniciar conversa</p>}
                  {newPlayers.map((player) => (
                    <button key={player.id} type="button" onClick={() => void openDirect(player.id)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-900">
                      <Avatar url={player.avatarUrl} name={player.displayName} />
                      <div><p className="text-sm font-medium text-slate-200">{player.displayName}</p><p className="text-[10px] text-slate-600">Iniciar conversa</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {loading && view !== "INBOX" && <div className="absolute inset-14 bottom-0 flex items-center justify-center bg-[#090b18]/80"><Loader2 size={22} className="animate-spin text-[#FFCB05]" /></div>}
    </aside>
  );
}
