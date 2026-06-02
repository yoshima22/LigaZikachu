"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Mail, Send, Eye, FlaskConical, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { triggerDeckReminder, sendTestDeckReminder } from "../actions";

interface Player { id: string; displayName: string; email: string | null; }

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

export function DeckReminderPanel({ players }: { players: Player[] }) {
  const [pending, startTransition]   = useTransition();
  const [testPending, startTest]     = useTransition();
  const [result, setResult]          = useState<ReminderResult | null>(null);
  const [dryRun, setDryRun]          = useState(false);

  // Test target
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showDropdown, setShowDropdown]    = useState(false);

  const filteredPlayers = players.filter((p) =>
    p.displayName.toLowerCase().includes(playerSearch.toLowerCase()) ||
    (p.email ?? "").toLowerCase().includes(playerSearch.toLowerCase())
  ).slice(0, 8);

  const run = (dry: boolean) => {
    const label = dry ? "simular (nenhum e-mail será enviado)" : "enviar os e-mails de verdade";
    if (!confirm(`Deseja ${label}?`)) return;
    startTransition(async () => {
      try {
        const data = await triggerDeckReminder(dry);
        if ("error" in data) { toast.error(data.error); return; }
        setResult(data as ReminderResult);
        if (dry) toast.info(`Simulação: ${data.simulated ?? 0} jogador(es) receberiam o lembrete.`);
        else     toast.success(`${data.emailsSent} e-mail(s) enviado(s).`);
      } catch { toast.error("Erro ao executar."); }
    });
  };

  const runTest = () => {
    if (!selectedPlayer) { toast.error("Selecione um jogador primeiro."); return; }
    if (!selectedPlayer.email) { toast.error(`${selectedPlayer.displayName} não tem e-mail cadastrado.`); return; }
    if (!confirm(`Enviar e-mail de teste para ${selectedPlayer.displayName} (${selectedPlayer.email})?`)) return;

    startTest(async () => {
      try {
        const res = await sendTestDeckReminder(selectedPlayer.id);
        if (!res.ok) { toast.error(res.error ?? "Erro desconhecido."); return; }
        toast.success(
          res.usedRealMatch
            ? `✓ Enviado para ${res.to} com dados reais da partida.`
            : `✓ Enviado para ${res.to} com dados de exemplo (sem partida real encontrada).`
        );
      } catch { toast.error("Erro ao enviar teste."); }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Mail size={16} className="text-[#FFCB05]" />
        <h3 className="font-semibold text-slate-200">Lembrete de Deck</h3>
      </div>
      <p className="text-xs text-slate-500">
        Envia e-mail para jogadores com partidas nas próximas 24 horas sem deck enviado.
        Automático diariamente às <strong className="text-slate-400">09:00 BRT</strong>.
      </p>

      {/* ── Seção de teste individual ── */}
      <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-[#FFCB05]" />
          <p className="text-xs font-semibold text-[#FFCB05]">Enviar teste para jogador específico</p>
        </div>
        <p className="text-[11px] text-slate-500">
          Envia o e-mail de verdade para um único jogador. Usa dados reais de partida se existir — caso contrário, usa dados de exemplo para testar o template.
        </p>

        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={playerSearch}
            onChange={(e) => { setPlayerSearch(e.target.value); setShowDropdown(true); setSelectedPlayer(null); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Buscar jogador por nome ou e-mail…"
            className="w-full rounded-lg border border-border bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-[#FFCB05] placeholder:text-slate-600"
          />

          {/* Dropdown */}
          {showDropdown && playerSearch.length > 0 && filteredPlayers.length > 0 && !selectedPlayer && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-slate-900 shadow-xl overflow-hidden">
              {filteredPlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-800 transition-colors"
                  onClick={() => { setSelectedPlayer(p); setPlayerSearch(p.displayName); setShowDropdown(false); }}
                >
                  <span className="text-xs font-medium text-slate-200 truncate">{p.displayName}</span>
                  <span className="text-[10px] text-slate-500 shrink-0 truncate max-w-[140px]">
                    {p.email ?? "sem e-mail"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected player chip */}
        {selectedPlayer && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#FFCB05]/30 bg-[#FFCB05]/8 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#FFCB05] truncate">{selectedPlayer.displayName}</p>
              <p className="text-[10px] text-slate-500 truncate">{selectedPlayer.email ?? "sem e-mail"}</p>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedPlayer(null); setPlayerSearch(""); }}
              className="shrink-0 text-slate-500 hover:text-slate-300 text-xs px-1"
            >✕</button>
          </div>
        )}

        <Button
          type="button"
          disabled={testPending || !selectedPlayer}
          onClick={runTest}
          size="sm"
          className="gap-1.5 bg-[#FFCB05] text-[#1A1A2E] hover:bg-[#FFD700] disabled:opacity-40"
        >
          <Send size={12} />
          {testPending ? "Enviando…" : "Enviar e-mail de teste"}
        </Button>
      </div>

      {/* ── Disparo em massa ── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-400">Disparo em massa</p>

        {/* Toggle dry run */}
        <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
          <div onClick={() => setDryRun(!dryRun)}
            className={`relative h-5 w-9 rounded-full transition-colors duration-200 ${dryRun ? "bg-blue-500" : "bg-slate-700"}`}>
            <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${dryRun ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          <span className="text-xs text-slate-400">
            Simular (dry run) —{" "}
            <span className={dryRun ? "text-blue-400 font-semibold" : "text-slate-600"}>
              {dryRun ? "nenhum e-mail será enviado" : "e-mails reais serão enviados"}
            </span>
          </span>
        </label>

        <Button
          type="button"
          disabled={pending}
          onClick={() => run(dryRun)}
          className={`gap-2 ${dryRun ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"}`}
        >
          {dryRun ? <Eye size={13} /> : <Send size={13} />}
          {pending ? (dryRun ? "Simulando…" : "Enviando…") : (dryRun ? "Simular agora" : "Disparar para todos")}
        </Button>
      </div>

      {/* Resultado */}
      {result && (
        <div className="rounded-xl border border-border bg-slate-900/50 p-4 space-y-3">
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

          {result.details.length === 0 ? (
            <p className="text-xs text-slate-600">
              Nenhum jogador elegível encontrado.
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
                    {isError && <span className="shrink-0 text-red-400 text-[10px]">{d.status}</span>}
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
