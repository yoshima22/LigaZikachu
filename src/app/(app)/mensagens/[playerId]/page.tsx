import Link from "next/link";
import { MessageSquareWarning, RefreshCw } from "lucide-react";
import { getConversationAction, type AttachmentData } from "../actions";
import { DmChat } from "./_components/dm-chat";

interface Props { params: Promise<{ playerId: string }> }

export default async function ConversationPage({ params }: Props) {
  const { playerId } = await params;
  const result = await getConversationAction(playerId);

  if (!result.ok) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-10 text-center">
        <MessageSquareWarning className="text-amber-300" size={30} />
        <div>
          <h1 className="font-semibold text-white">Conversa temporariamente indisponível</h1>
          <p className="mt-1 text-sm text-slate-400">{result.error}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {result.retryable && (
            <Link href={`/mensagens/${encodeURIComponent(playerId)}?retry=${Date.now()}`} className="inline-flex items-center gap-2 rounded-xl bg-[#FFCB05] px-4 py-2 text-sm font-bold text-[#1A1A2E]">
              <RefreshCw size={14} /> Tentar novamente
            </Link>
          )}
          <Link href="/mensagens" className="rounded-xl border border-border px-4 py-2 text-sm text-slate-300">
            Voltar às mensagens
          </Link>
        </div>
      </div>
    );
  }

  return (
    <DmChat
      me={result.me}
      other={result.other}
      initialMessages={result.messages.map((m) => ({
        id: m.id,
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderId === result.me.id ? result.me.displayName : result.other.displayName,
        senderAvatar: m.senderId === result.me.id ? null : result.other.avatarUrl ?? null,
        createdAt: m.createdAt.toISOString(),
        attachmentType: m.attachmentType,
        attachmentData: (m.attachmentData as AttachmentData) ?? null,
      }))}
    />
  );
}
