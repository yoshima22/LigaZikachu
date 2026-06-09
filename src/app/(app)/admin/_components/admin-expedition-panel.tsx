"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPin, RefreshCw, CheckCircle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPokemonName } from "@/lib/mascot-data";
import { getPlayerMascotsAdmin, startAdminExpeditionAction, completeAdminExpeditionAction, resetStuckMascotAction } from "../actions";
import type { ExpeditionDuration, ExpeditionMode } from "@/lib/mascot-data";

const DURATIONS: { value: ExpeditionDuration; label: string; hint: string }[] = [
  { value: "30min", label: "30 minutos", hint: "0.5× EXP" },
  { value: "1h",    label: "1 hora",     hint: "1× EXP" },
  { value: "3h",    label: "3 horas",    hint: "2.5× EXP" },
  { value: "6h",    label: "6 horas",    hint: "5× EXP" },
  { value: "7d",    label: "7 dias (Férias)", hint: "modo especial" },
];

const MODES: { value: ExpeditionMode; label: string; hint: string }[] = [
  { value: "STANDARD",  label: "Padrão",      hint: "EXP + chance de item" },
  { value: "TRAINING",  label: "Treinamento",  hint: "EXP muito maior, sem item" },
  { value: "ITEMS",     label: "Itens",        hint: "Focado em itens, sem EXP" },
  { value: "VACATION",  label: "Férias 🌴",   hint: "Apenas com duração de 7 dias" },
];

type Mascot = {
  id: string; pokemonId: number; nickname: string | null; level: number;
  isFavorite: boolean; isEquipped: boolean; arenaState: string;
  bazarListed: boolean; activeExpedition: boolean;
};

interface Props {
  players: { id: string; displayName: string }[];
}

export function AdminExpeditionPanel({ players }: Props) {
  const [pending, startTransition] = useTransition();

  const [playerId,   setPlayerId]   = useState("");
  const [mascots,    setMascots]    = useState<Mascot[]>([]);
  const [mascotId,   setMascotId]   = useState("");
  const [duration,   setDuration]   = useState<ExpeditionDuration>("1h");
  const [mode,       setMode]       = useState<ExpeditionMode>("STANDARD");
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null); // mascotId being completed
  const [resetting,  setResetting]  = useState<string | null>(null); // mascotId being reset
  const [resetLog,   setResetLog]   = useState<string[]>([]);

  // Carrega mascotes ao selecionar jogador
  const handlePlayerChange = (id: string) => {
    setPlayerId(id);
    setMascotId("");
    setMascots([]);
    setLastResult(null);
    if (!id) return;
    startTransition(async () => {
      const res = await getPlayerMascotsAdmin(id);
      if (res.error) { toast.error(res.error); return; }
      setMascots(res.mascots);
    });
  };

  const handleStart = () => {
    if (!playerId || !mascotId) { toast.error("Selecione jogador e mascote."); return; }
    const player  = players.find(p => p.id === playerId);
    const mascot  = mascots.find(m => m.id === mascotId);
    const durLabel = DURATIONS.find(d => d.value === duration)?.label;
    const modeLabel = MODES.find(m => m.value === mode)?.label;

    if (!confirm(`Iniciar expedição para ${mascot?.nickname ?? getPokemonName(mascot?.pokemonId ?? 0)} de ${player?.displayName}?\n\n${durLabel} · ${modeLabel}`)) return;

    startTransition(async () => {
      const res = await startAdminExpeditionAction(playerId, mascotId, duration, mode);
      if (!res.ok) {
        toast.error(res.error ?? "Erro ao iniciar expedição.");
        return;
      }
      const name = mascot?.nickname ?? getPokemonName(mascot?.pokemonId ?? 0);
      toast.success(`Expedição iniciada para ${name}!`);
      setLastResult(`✅ ${name} (${durLabel} · ${modeLabel}) — expedição iniciada com sucesso.`);
      // Recarrega mascotes para atualizar status
      const updated = await getPlayerMascotsAdmin(playerId);
      if (!updated.error) setMascots(updated.mascots);
      setMascotId("");
    });
  };

  const handleComplete = (m: Mascot) => {
    const name = m.nickname ?? getPokemonName(m.pokemonId);
    if (!confirm(`Completar expedição de ${name} agora?\nA recompensa completa será entregue normalmente.`)) return;
    setCompleting(m.id);
    startTransition(async () => {
      const res = await completeAdminExpeditionAction(playerId, m.id);
      setCompleting(null);
      if (!res.ok) { toast.error(res.error ?? "Erro ao completar."); return; }
      toast.success(`Expedição de ${name} completada!`);
      setLastResult(`✅ Expedição de ${name} completada. Recompensa: ${JSON.stringify(res.reward)}`);
      const updated = await getPlayerMascotsAdmin(playerId);
      if (!updated.error) setMascots(updated.mascots);
    });
  };

  const handleReset = (m: Mascot) => {
    const name = m.nickname ?? getPokemonName(m.pokemonId);
    if (!confirm(`Destravar ${name}?\n\nIsso vai:\n• Encerrar expedições ativas\n• Resetar arenaState para FREE\n• Limpar injuredAt / restingUntil\n• Limpar bazarListed órfão`)) return;
    setResetting(m.id);
    setResetLog([]);
    startTransition(async () => {
      const res = await resetStuckMascotAction(m.id);
      setResetting(null);
      if (!res.ok) { toast.error(res.error ?? "Erro ao resetar."); return; }
      toast.success(`${name} destravado!`);
      setResetLog(res.fixed ?? []);
      setLastResult(`🔧 ${name} destravado. Ver log abaixo.`);
      const updated = await getPlayerMascotsAdmin(playerId);
      if (!updated.error) setMascots(updated.mascots);
    });
  };

  const selectedMascot = mascots.find(m => m.id === mascotId);

  function mascotStatus(m: Mascot): string {
    if (m.activeExpedition) return "🗺 Em expedição";
    if (m.bazarListed)      return "🏪 No Bazar";
    if (m.arenaState === "ARENA")   return "⚔️ Na Arena";
    if (m.arenaState === "RESTING") return "💤 Repouso";
    if (m.arenaState === "INJURED") return "🩹 Ferido";
    return "🟢 Livre";
  }

  return (
    <div className="rounded-2xl border border-border bg-slate-950/50 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <MapPin size={16} className="text-blue-400" />
        <h3 className="font-semibold text-slate-200">Expedições Admin</h3>
        <span className="text-xs text-slate-500">— iniciar expedição em nome de um jogador</span>
      </div>

      {/* Expedições ativas do jogador — botão Completar */}
      {mascots.filter(m => m.activeExpedition).length > 0 && (
        <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="text-xs font-semibold text-blue-300">
            🗺 Expedições ativas ({mascots.filter(m => m.activeExpedition).length})
          </p>
          <div className="space-y-1.5">
            {mascots.filter(m => m.activeExpedition).map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-slate-900/60 px-3 py-2">
                <span className="text-xs text-slate-300">
                  <span className="font-semibold">{m.nickname ?? getPokemonName(m.pokemonId)}</span>
                  <span className="ml-1.5 text-slate-500">Nv.{m.level}</span>
                </span>
                <Button
                  type="button"
                  disabled={pending || completing === m.id}
                  onClick={() => handleComplete(m)}
                  className="h-7 gap-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-300 hover:bg-green-500/25 text-[11px] font-semibold px-3"
                >
                  {completing === m.id
                    ? <><RefreshCw size={11} className="animate-spin" /> Completando…</>
                    : <><CheckCircle size={11} /> Completar</>
                  }
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Jogador */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400">Jogador</label>
          <select
            value={playerId}
            onChange={e => handlePlayerChange(e.target.value)}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05]"
          >
            <option value="">Selecione o jogador</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
          </select>
        </div>

        {/* Mascote */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400">
            Mascote {mascots.length > 0 && <span className="text-slate-600 font-normal">({mascots.length} total)</span>}
          </label>
          <select
            value={mascotId}
            onChange={e => setMascotId(e.target.value)}
            disabled={mascots.length === 0}
            className="w-full rounded-xl border border-border bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-[#FFCB05] disabled:opacity-50"
          >
            <option value="">{pending ? "Carregando…" : "Selecione o mascote"}</option>
            {mascots.map(m => (
              <option key={m.id} value={m.id}>
                {m.nickname ?? getPokemonName(m.pokemonId)} — Nv.{m.level} {mascotStatus(m)}
                {m.isFavorite ? " ⭐" : ""}{m.isEquipped ? " 🎯" : ""}
              </option>
            ))}
          </select>
          {/* Lista de mascotes com botão Destravar */}
          {mascots.length > 0 && (
            <div className="mt-2 max-h-52 overflow-y-auto space-y-1 rounded-xl border border-border/40 bg-slate-900/40 p-2">
              {mascots.map(m => {
                const name = m.nickname ?? getPokemonName(m.pokemonId);
                const isOccupied = m.activeExpedition || m.arenaState !== "FREE" || m.bazarListed;
                return (
                  <div key={m.id} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${isOccupied ? "bg-orange-500/5 border border-orange-500/15" : "border border-transparent"}`}>
                    <span className="text-xs text-slate-300 truncate min-w-0">
                      <span className="font-medium">{name}</span>
                      <span className="ml-1.5 text-[10px] text-slate-500">{mascotStatus(m)}</span>
                    </span>
                    <Button
                      type="button"
                      disabled={pending || resetting === m.id}
                      onClick={() => handleReset(m)}
                      className="h-6 shrink-0 gap-1 rounded-md bg-orange-500/10 border border-orange-500/25 text-orange-300 hover:bg-orange-500/20 text-[10px] font-semibold px-2"
                    >
                      {resetting === m.id
                        ? <RefreshCw size={10} className="animate-spin" />
                        : <><Wrench size={10} /> Destravar</>
                      }
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Duração */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400">Duração</label>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDuration(d.value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  duration === d.value
                    ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
                    : "border-border text-slate-500 hover:text-slate-300 hover:border-slate-600"
                }`}
              >
                {d.label}
                <span className="ml-1 text-[10px] font-normal opacity-60">{d.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Modo */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400">Modo</label>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  mode === m.value
                    ? "border-[#FFCB05]/40 bg-[#FFCB05]/15 text-[#FFCB05]"
                    : "border-border text-slate-500 hover:text-slate-300 hover:border-slate-600"
                }`}
              >
                {m.label}
                <span className="ml-1 text-[10px] font-normal opacity-60">{m.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Preview / aviso */}
      {selectedMascot && (
        <div className={`rounded-xl border px-4 py-3 text-xs space-y-1 ${
          selectedMascot.activeExpedition || selectedMascot.arenaState !== "FREE"
            ? "border-orange-500/30 bg-orange-500/5 text-orange-300"
            : "border-blue-500/20 bg-blue-500/5 text-blue-300"
        }`}>
          <p className="font-semibold">
            {selectedMascot.nickname ?? getPokemonName(selectedMascot.pokemonId)} — Nv.{selectedMascot.level}
          </p>
          <p className="text-slate-400">
            Status: {mascotStatus(selectedMascot)}
            {(selectedMascot.activeExpedition || selectedMascot.arenaState !== "FREE") && (
              <span className="ml-2 text-orange-400">⚠️ Mascote ocupado — a expedição pode ser bloqueada.</span>
            )}
          </p>
          <p className="text-slate-500">
            Expedição: <strong className="text-slate-300">{DURATIONS.find(d => d.value === duration)?.label}</strong>
            {" · "}<strong className="text-slate-300">{MODES.find(m => m.value === mode)?.label}</strong>
          </p>
        </div>
      )}

      <Button
        type="button"
        disabled={pending || !playerId || !mascotId}
        onClick={handleStart}
        className="gap-2 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40"
      >
        <RefreshCw size={13} className={pending ? "animate-spin" : ""} />
        {pending ? "Aguarde…" : "Iniciar Expedição"}
      </Button>

      {lastResult && (
        <p className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-2.5 text-xs text-green-300">
          {lastResult}
        </p>
      )}
      {resetLog.length > 0 && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">Log do reset</p>
          {resetLog.map((line, i) => (
            <p key={i} className="text-xs text-orange-300">• {line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
