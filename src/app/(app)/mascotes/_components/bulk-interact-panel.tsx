"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Gamepad2, Hand, Loader2, Users, Utensils } from "lucide-react";
import { feedAllAction } from "../actions";
import { clearPlayed, clearPetted, markPlayed, markPetted, isPlayOnCooldown, isPetOnCooldown } from "./mascot-card";
import { formatRemaining } from "@/hooks/use-timer-expiry";

interface Props {
  scope: "ALL" | "FAVORITES";
  /** IDs dos mascotes do escopo — usados para verificar cooldowns individuais */
  mascotIds: string[];
}

function pluralMascot(count: number) {
  return `mascote${count !== 1 ? "s" : ""}`;
}

type HungerLevel = "STARVING" | "HUNGRY" | "NEUTRAL" | "SATISFIED";
type FeedType = "FOOD" | "SWEET";

const HUNGER_OPTIONS: { value: HungerLevel; label: string }[] = [
  { value: "STARVING",  label: "Faminto" },
  { value: "HUNGRY",   label: "Com fome" },
  { value: "NEUTRAL",  label: "Normal" },
  { value: "SATISFIED", label: "Satisfeito" },
];

export function BulkInteractPanel({ scope, mascotIds }: Props) {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [pendingPlay, startPlay] = useTransition();
  const [pendingPet, startPet] = useTransition();
  const [pendingFeedAll, startFeedAll] = useTransition();
  const [minHunger, setMinHunger] = useState<HungerLevel>("HUNGRY");
  const [feedType, setFeedType] = useState<FeedType>("FOOD");
  const isFavoriteTeam = scope === "FAVORITES";

  // Tick de 1s — atualiza cooldowns em tempo real
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    mountedRef.current = true;
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      mountedRef.current = false;
      clearInterval(iv);
    };
  }, []);

  // Contagem de mascotes que PODEM brincar/receber carinho agora
  const availableForPlay = mascotIds.filter(id => !isPlayOnCooldown(id, nowMs)).length;
  const availableForPet  = mascotIds.filter(id => !isPetOnCooldown(id, nowMs)).length;

  // Botão desabilitado só quando NENHUM mascote está disponível
  const playDisabled    = pendingPlay || pendingPet || pendingFeedAll || availableForPlay === 0;
  const petDisabled     = pendingPlay || pendingPet || pendingFeedAll || availableForPet  === 0;
  const feedAllDisabled = pendingPlay || pendingPet || pendingFeedAll;

  const monitorJob = async (jobId: string, type: "PLAY" | "PET", optimisticIds: string[]) => {
    // Este monitor serve apenas para feedback. O job nao depende da pagina aberta.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise(resolve => window.setTimeout(resolve, 2_000));
      if (!mountedRef.current) return;
      try {
        const response = await fetch(`/api/mascotes/interactions/bulk/${jobId}`, { cache: "no-store" });
        if (!response.ok) continue;
        const payload = await response.json() as {
          status: string;
          lastError?: string | null;
          resultJson?: { succeeded?: number; failed?: number; succeededIds?: string[] } | null;
        };
        if (payload.status === "COMPLETED") {
          const succeeded = new Set(payload.resultJson?.succeededIds ?? []);
          for (const id of optimisticIds) {
            if (!succeeded.has(id)) type === "PLAY" ? clearPlayed(id) : clearPetted(id);
          }
          setNowMs(Date.now());
          const ok = payload.resultJson?.succeeded ?? 0;
          const failed = payload.resultJson?.failed ?? 0;
          if (ok > 0) toast.success(`${type === "PLAY" ? "Brincadeira" : "Carinho"} concluido em ${ok} ${pluralMascot(ok)}.`);
          if (failed > 0) toast.info(`${failed} ${pluralMascot(failed)} estavam em cooldown, Arena, expedicao ou indisponiveis.`);
          return;
        }
        if (payload.status === "FAILED") {
          for (const id of optimisticIds) type === "PLAY" ? clearPlayed(id) : clearPetted(id);
          setNowMs(Date.now());
          toast.error(payload.lastError || "Nao foi possivel concluir a interacao em massa.");
          return;
        }
      } catch {
        // O cron ainda retomara o pedido persistido se a pagina desaparecer.
        return;
      }
    }
  };

  const enqueueBulkInteraction = async (type: "PLAY" | "PET") => {
    const optimisticIds = mascotIds.filter(id => type === "PLAY"
      ? !isPlayOnCooldown(id, Date.now())
      : !isPetOnCooldown(id, Date.now()));
    const response = await fetch("/api/mascotes/interactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactionType: type, scope, idempotencyKey: crypto.randomUUID() }),
      keepalive: true,
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; jobId?: string };
    if (!response.ok || !payload.jobId) throw new Error(payload.error || "Nao foi possivel registrar a acao.");

    for (const id of optimisticIds) type === "PLAY" ? markPlayed(id) : markPetted(id);
    setNowMs(Date.now());
    toast.success("Acao registrada. Voce ja pode sair desta pagina; o processamento continuara.");
    void monitorJob(payload.jobId, type, optimisticIds);
  };

  const handlePlayAll = () => {
    startPlay(async () => {
      try {
        await enqueueBulkInteraction("PLAY");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao registrar brincadeira.");
      }
    });
  };

  const handleFeedAll = () => {
    startFeedAll(async () => {
      try {
        const res = await feedAllAction(minHunger, feedType);
        if (res.error) { toast.error(res.error); return; }
        const feedLabel = feedType === "SWEET" ? "doces" : "comida";
        if (res.noFood) { toast.warning(`Sem ${feedLabel} no estoque para alimentar os mascotes.`); return; }
        if (res.fed === 0) {
          toast.info("Todos os mascotes já estão satisfeitos.");
        } else {
          const msg = res.skipped > 0
            ? `${res.fed} ${pluralMascot(res.fed)} alimentado${res.fed !== 1 ? "s" : ""}. ${res.skipped} já estava${res.skipped !== 1 ? "m" : ""} satisfeito${res.skipped !== 1 ? "s" : ""}.`
            : `${res.fed} ${pluralMascot(res.fed)} alimentado${res.fed !== 1 ? "s" : ""}!`;
          toast.success(msg);
          router.refresh();
        }
      } catch (err) {
        toast.error(`Erro ao alimentar: ${String(err).slice(0, 150)}`);
      }
    });
  };

  const handlePetAll = () => {
    startPet(async () => {
      try {
        await enqueueBulkInteraction("PET");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao registrar carinho.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-[#FFCB05]/20 bg-slate-950/60 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Users size={15} className="text-[#FFCB05]" />
            {isFavoriteTeam ? "Cuidar dos Favoritos" : "Cuidar dos Mascotes"}
          </h3>
          <p className="max-w-2xl text-xs text-slate-500">
            {isFavoriteTeam
              ? "Aplica em cada mascote favorito que estiver disponível. Cada um respeita seu próprio cooldown."
              : "Aplica nos mascotes disponíveis. Cada mascote respeita seu próprio cooldown."}
          </p>
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
          {isFavoriteTeam ? "Equipe Favorita" : "Todos"}
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[180px_180px_minmax(320px,1fr)]">
        {/* Brincar com todos */}
        <button
          type="button"
          disabled={playDisabled}
          onClick={handlePlayAll}
          className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl border border-[#FFCB05]/30 bg-[#FFCB05]/10 px-4 py-2.5 text-xs font-bold text-[#FFCB05] hover:bg-[#FFCB05]/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            {pendingPlay ? <Loader2 size={14} className="animate-spin" /> : <Gamepad2 size={14} />}
            {isFavoriteTeam ? "Brincar nos Favoritos" : "Brincar com todos"}
          </span>
          <span className="text-[9px] font-normal text-[#FFCB05]/60">
            {availableForPlay === 0
              ? "Todos em cooldown"
              : `${availableForPlay} ${availableForPlay === 1 ? "disponível" : "disponíveis"}`}
          </span>
        </button>

        {/* Carinho na equipe */}
        <button
          type="button"
          disabled={petDisabled}
          onClick={handlePetAll}
          className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="flex items-center gap-2">
            {pendingPet ? <Loader2 size={14} className="animate-spin" /> : <Hand size={14} />}
            {isFavoriteTeam ? "Carinho nos Favoritos" : "Carinho em todos"}
          </span>
          <span className="text-[9px] font-normal text-rose-400/60">
            {availableForPet === 0
              ? "Todos em cooldown"
              : `${availableForPet} ${availableForPet === 1 ? "disponível" : "disponíveis"}`}
          </span>
        </button>

        {/* Alimentar Todos */}
        <div className="flex min-h-[60px] flex-col justify-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Item</span>
            {([
              { value: "FOOD" as const, label: "Comida" },
              { value: "SWEET" as const, label: "Doce" },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFeedType(opt.value)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-colors ${
                  feedType === opt.value
                    ? "border-[#FFCB05]/60 bg-[#FFCB05]/20 text-[#FFCB05]"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-[#FFCB05]/30 hover:text-[#FFCB05]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-500">Alimentar quem está:</span>
            {HUNGER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMinHunger(opt.value)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-colors ${
                  minHunger === opt.value
                    ? "border-green-400/60 bg-green-400/20 text-green-300"
                    : "border-slate-700 bg-slate-800 text-slate-400 hover:border-green-400/30 hover:text-green-400"
                }`}
              >
                {opt.label} ou pior
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={feedAllDisabled}
            onClick={handleFeedAll}
            className="flex min-h-[38px] items-center justify-center gap-2 rounded-xl border border-green-400/30 bg-green-400/10 px-4 py-2.5 text-xs font-bold text-green-400 hover:bg-green-400/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pendingFeedAll ? <Loader2 size={14} className="animate-spin" /> : <Utensils size={14} />}
            Alimentar Todos com {feedType === "SWEET" ? "Doce" : "Comida"}
          </button>
        </div>
      </div>
    </div>
  );
}
