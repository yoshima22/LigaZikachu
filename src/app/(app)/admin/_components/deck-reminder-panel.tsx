"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerDeckReminder } from "../actions";

interface ReminderResult {
  weeksChecked: number;
  emailsSent: number;
  errors: number;
  details: Array<{ email: string; week: string; status: string }>;
}

export function DeckReminderPanel() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReminderResult | null>(null);

  const handleRun = () => {
    if (!confirm("Disparar agora o lembrete de deck para todos os jogadores elegíveis? Os e-mails serão enviados imediatamente.")) return;

    startTransition(async () => {
      try {
        const data = await triggerDeckReminder();
        if ("error" in data) { toast.error(data.error); return; }
        setResult(data);
        toast.success(`${data.emailsSent} e-mail(s) enviado(s).`);
      } catch {
        toast.error("Erro ao disparar o lembrete.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Mail size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Lembrete de Deck</h3>
      </div>
      <p className="text-xs text-slate-500">
        Envia um e-mail para jogadores com partidas nas próximas 24 horas que ainda não enviaram o deck.
        Roda automaticamente todos os dias às <strong className="text-slate-400">09:00 BRT (12:00 UTC)</strong> via Vercel Cron.
      </p>

      <Button
        type="button"
        disabled={pending}
        onClick={handleRun}
        className="gap-2 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"
      >
        <Send size={13} />
        {pending ? "Enviando…" : "Disparar agora (manual)"}
      </Button>

      {result && (
        <div className="rounded-xl border border-border bg-slate-900/50 p-4 space-y-3">
          <div className="flex flex-wrap gap-6 text-xs">
            <div>
              <p className="text-slate-500">Semanas verificadas</p>
              <p className="font-bold text-slate-200 text-base">{result.weeksChecked}</p>
            </div>
            <div>
              <p className="text-slate-500">E-mails enviados</p>
              <p className="font-bold text-green-400 text-base">{result.emailsSent}</p>
            </div>
            {result.errors > 0 && (
              <div>
                <p className="text-slate-500">Erros</p>
                <p className="font-bold text-red-400 text-base">{result.errors}</p>
              </div>
            )}
          </div>

          {result.details.length === 0 ? (
            <p className="text-xs text-slate-600">
              Nenhum jogador elegível encontrado (todos já enviaram deck ou não há semanas com prazo nas próximas 24h).
            </p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {result.details.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs border-b border-border/40 py-1.5">
                  <span className={`shrink-0 font-bold ${d.status === "enviado" ? "text-green-400" : "text-red-400"}`}>
                    {d.status === "enviado" ? "✓" : "✗"}
                  </span>
                  <span className="text-slate-400 truncate flex-1">{d.email}</span>
                  <span className="shrink-0 text-slate-600">{d.week}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
