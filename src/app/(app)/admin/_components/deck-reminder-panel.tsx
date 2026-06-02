"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Send, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerDeckReminder } from "../actions";

interface ReminderResult {
  weeksChecked: number;
  emailsSent: number;
  simulated: number;
  errors: number;
  details: Array<{ email: string; week: string; status: string }>;
  dryRun: boolean;
}

const STATUS_STYLE: Record<string, string> = {
  enviado:  "text-green-400",
  simulado: "text-blue-400",
};
const STATUS_ICON: Record<string, string> = {
  enviado:  "✓",
  simulado: "👁",
};

export function DeckReminderPanel() {
  const [pending, startTransition] = useTransition();
  const [result, setResult]   = useState<ReminderResult | null>(null);
  const [dryRun, setDryRun]   = useState(false);

  const run = (dry: boolean) => {
    const label = dry ? "simular (nenhum e-mail será enviado)" : "enviar os e-mails de verdade";
    if (!confirm(`Deseja ${label}?`)) return;

    startTransition(async () => {
      try {
        const data = await triggerDeckReminder(dry);
        if ("error" in data) { toast.error(data.error); return; }
        setResult(data as ReminderResult);
        if (dry) {
          toast.info(`Simulação: ${data.simulated ?? 0} jogador(es) receberiam o lembrete.`);
        } else {
          toast.success(`${data.emailsSent} e-mail(s) enviado(s).`);
        }
      } catch {
        toast.error("Erro ao executar.");
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

      {/* Toggle dry run */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
        <div
          onClick={() => setDryRun(!dryRun)}
          className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${dryRun ? "bg-blue-500" : "bg-slate-700"}`}
        >
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${dryRun ? "translate-x-4" : "translate-x-0.5"}`} />
        </div>
        <span className="text-xs text-slate-400">
          Simular (dry run) — <span className={dryRun ? "text-blue-400 font-semibold" : "text-slate-600"}>
            {dryRun ? "nenhum e-mail será enviado" : "e-mails serão enviados de verdade"}
          </span>
        </span>
      </label>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(dryRun)}
          className={`gap-2 ${dryRun ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700]"}`}
        >
          {dryRun ? <Eye size={13} /> : <Send size={13} />}
          {pending
            ? (dryRun ? "Simulando…" : "Enviando…")
            : (dryRun ? "Simular agora" : "Disparar agora")}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-border bg-slate-900/50 p-4 space-y-3">

          {/* Summary header */}
          <div className="flex flex-wrap gap-5 text-xs pb-2 border-b border-border/40">
            <div>
              <p className="text-slate-500">Semanas verificadas</p>
              <p className="font-bold text-slate-200 text-base mt-0.5">{result.weeksChecked}</p>
            </div>
            {result.dryRun ? (
              <div>
                <p className="text-slate-500">Receberiam o e-mail</p>
                <p className="font-bold text-blue-400 text-base mt-0.5">{result.simulated}</p>
              </div>
            ) : (
              <div>
                <p className="text-slate-500">E-mails enviados</p>
                <p className="font-bold text-green-400 text-base mt-0.5">{result.emailsSent}</p>
              </div>
            )}
            {result.errors > 0 && (
              <div>
                <p className="text-slate-500">Erros</p>
                <p className="font-bold text-red-400 text-base mt-0.5">{result.errors}</p>
              </div>
            )}
            {result.dryRun && (
              <div className="self-end">
                <span className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-1 text-[10px] text-blue-400 font-semibold">
                  👁 SIMULAÇÃO — nenhum e-mail foi enviado
                </span>
              </div>
            )}
          </div>

          {/* Detail list */}
          {result.details.length === 0 ? (
            <p className="text-xs text-slate-600">
              Nenhum jogador elegível encontrado (todos já enviaram deck ou não há semanas com prazo nas próximas 24h).
            </p>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {result.details.map((d, i) => {
                const isError = d.status.startsWith("erro");
                const icon    = isError ? "✗" : (STATUS_ICON[d.status] ?? "·");
                const cls     = isError ? "text-red-400" : (STATUS_STYLE[d.status] ?? "text-slate-400");
                return (
                  <div key={i} className="flex items-center gap-2 text-xs border-b border-border/30 py-1.5">
                    <span className={`shrink-0 font-bold w-4 text-center ${cls}`}>{icon}</span>
                    <span className="text-slate-300 truncate flex-1">{d.email}</span>
                    <span className="shrink-0 text-slate-600 text-[10px]">{d.week}</span>
                    {isError && (
                      <span className="shrink-0 text-red-400 text-[10px]">{d.status}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
