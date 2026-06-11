"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Search, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Conversation = {
  partnerId: string; partnerName: string; partnerAvatar: string | null;
  lastContent: string; lastAttachmentType: string | null; lastAt: Date; unread: number;
};

type Player = { id: string; displayName: string; avatarUrl: string | null };

interface Props {
  conversations: Conversation[];
  allPlayers: Player[];
}

function Avatar({ url, name, size = 9 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    <img src={url} alt="" className={`h-${size} w-${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <div className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full bg-slate-800`}>
      <User size={size * 1.5} className="text-slate-500" />
    </div>
  );
}

function lastMessageLabel(content: string, attachmentType: string | null) {
  if (attachmentType === "MASCOT") return content ? `${content} · 🐾 Mascote` : "🐾 Mascote compartilhado";
  if (attachmentType === "ITEM") return content ? `${content} · 📦 Item` : "📦 Item compartilhado";
  return content || "…";
}

export function InboxWithSearch({ conversations, allPlayers }: Props) {
  const [query, setQuery] = useState("");

  const convPartnerIds = new Set(conversations.map((c) => c.partnerId));
  const filtered = query.trim().length > 0
    ? allPlayers.filter((p) =>
        p.displayName.toLowerCase().includes(query.toLowerCase()) &&
        !convPartnerIds.has(p.id)
      )
    : [];

  const filteredConversations = query.trim().length > 0
    ? conversations.filter((c) => c.partnerName.toLowerCase().includes(query.toLowerCase()))
    : conversations;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare size={22} className="text-[#FFCB05]" />
        <h1 className="font-pixel text-base text-[#FFCB05]">Mensagens</h1>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar jogador ou conversa…"
          className="w-full rounded-xl border border-border bg-slate-900 py-2.5 pl-9 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-[#FFCB05]/40"
        />
      </div>

      {/* Resultados de busca — jogadores sem conversa ainda */}
      {filtered.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Iniciar conversa</p>
          <div className="space-y-1">
            {filtered.map((p) => (
              <Link key={p.id} href={`/mensagens/${p.id}`}>
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-slate-900/30 px-4 py-3 transition-colors hover:border-[#FFCB05]/30 hover:bg-slate-900">
                  <Avatar url={p.avatarUrl} name={p.displayName} />
                  <span className="text-sm font-medium text-slate-300">{p.displayName}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Conversas existentes */}
      {filteredConversations.length === 0 && filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {query ? "Nenhum resultado." : "Nenhuma conversa ainda. Busque um jogador acima para começar."}
        </p>
      ) : (
        <>
          {filteredConversations.length > 0 && (
            <div>
              {query && <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Conversas</p>}
              <div className="space-y-1">
                {filteredConversations.map((c) => (
                  <Link key={c.partnerId} href={`/mensagens/${c.partnerId}`}>
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-slate-900/50 px-4 py-3 transition-colors hover:border-[#FFCB05]/30 hover:bg-slate-900">
                      <Avatar url={c.partnerAvatar} name={c.partnerName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-white">{c.partnerName}</span>
                          <span className="shrink-0 text-[11px] text-slate-500">
                            {formatDistanceToNow(new Date(c.lastAt), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-400">{lastMessageLabel(c.lastContent, c.lastAttachmentType)}</p>
                      </div>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FFCB05] px-1.5 text-[10px] font-bold text-[#1A1A2E]">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
