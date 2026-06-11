import Link from "next/link";
import { getInboxAction } from "./actions";
import { MessageSquare, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function MensagensPage() {
  const result = await getInboxAction();
  if (!result.ok) return null;

  const { conversations } = result;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare size={22} className="text-[#FFCB05]" />
        <h1 className="font-pixel text-base text-[#FFCB05]">Mensagens</h1>
      </div>

      {conversations.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">Nenhuma conversa ainda. Visite o perfil de um jogador para iniciar uma.</p>
        </Card>
      ) : (
        <div className="space-y-1">
          {conversations.map((c) => (
            <Link key={c.partnerId} href={`/mensagens/${c.partnerId}`}>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-slate-900/50 px-4 py-3 transition-colors hover:border-[#FFCB05]/30 hover:bg-slate-900">
                {c.partnerAvatar ? (
                  <img src={c.partnerAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800">
                    <User size={16} className="text-slate-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-sm text-white truncate">{c.partnerName}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {formatDistanceToNow(new Date(c.lastAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{c.lastContent}</p>
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
      )}
    </div>
  );
}
