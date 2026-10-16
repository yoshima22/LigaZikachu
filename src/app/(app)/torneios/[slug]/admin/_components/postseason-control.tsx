"use client";

import { useState, useTransition } from "react";
import { Crown, Heart, RotateCcw, Settings2, Shield, Swords } from "lucide-react";
import { toast } from "sonner";
import {
  adjustPostseasonLives,
  advancePostseason,
  distributePostseasonRewards,
  initializePostseason,
  resetPostseason,
  setPostseasonMatchState,
  setPostseasonEnabled,
} from "../postseason-actions";

type Entry = {
  id: string;
  playerName: string;
  stage: "TITLE_SURVIVAL" | "CUP_JOHTO";
  seed: number;
  initialLives: number;
  lives: number;
  status: string;
  resultLabel: string | null;
};

type FinalMatch = {
  id: string;
  stage: "TITLE_SURVIVAL" | "CUP_JOHTO";
  round: number;
  label: string;
  playerA: string;
  playerB: string;
  status: string;
  processed: boolean;
};

export function PostseasonControl({ tournamentId, enabled, entries, matches }: {
  tournamentId: string;
  enabled: boolean;
  entries: Entry[];
  matches: FinalMatch[];
}) {
  const [pending, startTransition] = useTransition();
  const [localEnabled, setLocalEnabled] = useState(enabled);

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
      }
    });
  }

  const titleEntries = entries.filter((entry) => entry.stage === "TITLE_SURVIVAL");
  const cupEntries = entries.filter((entry) => entry.stage === "CUP_JOHTO");
  const initialized = entries.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4">
        <div>
          <p className="flex items-center gap-2 font-semibold text-white"><Settings2 size={16} className="text-[#FFCB05]" /> Fase final pós-temporada</p>
          <p className="mt-1 max-w-2xl text-xs text-slate-400">Este controle é individual por torneio. Desligado, nenhuma chave, vida ou recompensa final é criada.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-200">
          <span>{localEnabled ? "Ligada" : "Desligada"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={localEnabled}
            disabled={pending}
            onClick={() => {
              const next = !localEnabled;
              setLocalEnabled(next);
              run(() => setPostseasonEnabled(tournamentId, next), next ? "Fase final ativada." : "Fase final desativada.");
            }}
            className={`relative h-7 w-12 rounded-full transition ${localEnabled ? "bg-emerald-500" : "bg-slate-700"}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${localEnabled ? "left-6" : "left-1"}`} />
          </button>
        </label>
      </div>

      {localEnabled && !initialized && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-200">Aguardando encerramento da fase regular</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Após as semanas 1–8 estarem fechadas, o botão usa a classificação bloqueada para montar o Top 4 com vidas 3/2/1/1 e a Copa Johto do 5º ao 11º.</p>
          <button type="button" disabled={pending} onClick={() => run(() => initializePostseason(tournamentId), "Chaves finais montadas.")} className="mt-3 rounded-lg bg-[#FFCB05] px-4 py-2 text-xs font-bold text-[#1A1A2E] disabled:opacity-50">Montar chaves pela classificação</button>
        </div>
      )}

      {initialized && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <StagePanel icon={<Crown size={17} />} title="Chave de Sobrevivência Z" entries={titleEntries} matches={matches.filter((match) => match.stage === "TITLE_SURVIVAL")} showLives onAdvance={() => run(() => advancePostseason(tournamentId, "TITLE_SURVIVAL"), "Rodada da Chave Z processada.")} onLives={(id, lives) => run(() => adjustPostseasonLives(id, lives), "Vidas ajustadas.")} onMatchState={(id, state) => run(() => setPostseasonMatchState(id, state), "Estado da partida atualizado.")} pending={pending} />
            <StagePanel icon={<Shield size={17} />} title="Copa Johto de Recompensas" entries={cupEntries} matches={matches.filter((match) => match.stage === "CUP_JOHTO")} onAdvance={() => run(() => advancePostseason(tournamentId, "CUP_JOHTO"), "Rodada da Copa processada.")} onLives={() => undefined} onMatchState={(id, state) => run(() => setPostseasonMatchState(id, state), "Estado da partida atualizado.")} pending={pending} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-500/5 p-3">
            <p className="text-xs text-red-200">Reiniciar remove apenas a Semana 9, suas partidas e os estados de vidas. A fase regular não é alterada.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => run(() => distributePostseasonRewards(tournamentId), "Premiação final enviada para a Caixa de Presentes.")} className="rounded-lg border border-[#FFCB05]/40 bg-[#FFCB05]/10 px-3 py-2 text-xs font-semibold text-[#FFCB05]">Distribuir premiação final</button>
              <button type="button" disabled={pending} onClick={() => { if (window.confirm("Reiniciar toda a fase final?")) run(() => resetPostseason(tournamentId), "Fase final reiniciada."); }} className="flex items-center gap-2 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300"><RotateCcw size={13} /> Reiniciar fase final</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StagePanel({ icon, title, entries, matches, showLives = false, onAdvance, onLives, onMatchState, pending }: {
  icon: React.ReactNode;
  title: string;
  entries: Entry[];
  matches: FinalMatch[];
  showLives?: boolean;
  onAdvance: () => void;
  onLives: (id: string, lives: number) => void;
  onMatchState: (id: string, state: "DRAFT" | "PENDING_CONFIRMATION" | "DISPUTED" | "CANCELED") => void;
  pending: boolean;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold text-white">{icon}{title}</h3><button type="button" disabled={pending || matches.length === 0} onClick={onAdvance} className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 disabled:opacity-40">Processar rodada confirmada</button></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.id} className={`rounded-lg border p-2.5 ${entry.status === "CHAMPION" ? "border-[#FFCB05]/50 bg-[#FFCB05]/10" : entry.status === "ELIMINATED" ? "border-red-400/20 bg-red-500/5 opacity-70" : "border-slate-800 bg-slate-900"}`}>
            <div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-white">{entry.seed}º · {entry.playerName}</p><span className="text-[9px] uppercase text-slate-500">{entry.resultLabel?.replaceAll("_", " ") ?? entry.status}</span></div>
            {showLives && <div className="mt-2 flex items-center gap-2"><Heart size={12} className="text-red-400" /><input type="number" min={0} max={9} defaultValue={entry.lives} onBlur={(event) => { const lives = Number(event.target.value); if (lives !== entry.lives) onLives(entry.id, lives); }} className="w-14 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-center text-xs text-white" /><span className="text-[10px] text-slate-500">início: {entry.initialLives}</span></div>}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {matches.map((match) => <div key={match.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px]"><Swords size={12} className="text-cyan-300" /><span className="min-w-[180px] flex-1 text-slate-200">R{match.round} · {match.playerA} × {match.playerB}</span>{match.processed ? <span className="text-emerald-300">PROCESSADA</span> : match.status === "CONFIRMED" ? <span className="text-emerald-300">CONFIRMADA</span> : <select value={match.status} disabled={pending} onChange={(event) => onMatchState(match.id, event.target.value as "DRAFT" | "PENDING_CONFIRMATION" | "DISPUTED" | "CANCELED")} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200"><option value="DRAFT">Rascunho</option><option value="PENDING_CONFIRMATION">Aguardando resultado</option><option value="DISPUTED">Em disputa</option><option value="CANCELED">Cancelada</option></select>}</div>)}
      </div>
    </section>
  );
}
