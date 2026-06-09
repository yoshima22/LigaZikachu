"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Star, Gift, Calendar, CheckCircle2, Lock, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PassStatus, ClaimResult } from "../actions";
import type { DayReward } from "../schedule";
import { claimPassDay } from "../actions";
import { VipCelebration } from "./vip-celebration";
import { RewardClaimModal } from "./reward-claim-modal";

interface Props {
  status: PassStatus;
  schedule: DayReward[];
}

export function PassPageClient({ status, schedule }: Props) {
  const [pending, start] = useTransition();
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebDone = useCallback(() => setShowCelebration(false), []);

  // Mostrar celebração na primeira vez que o VIP está ativo (detectado client-side)
  useEffect(() => {
    if (!status.pass) return;
    const key = `vip_celebrated_${status.pass.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      const t = setTimeout(() => setShowCelebration(true), 400);
      return () => clearTimeout(t);
    }
  }, [status.pass]);

  const claimedDays = new Set(status.claims.map(c => c.dayNumber));
  const today = status.todayDay;

  const handleClaim = (day: number) => {
    if (!status.pass) return;
    start(async () => {
      const result = await claimPassDay(status.pass!.id, day);
      if (result.ok) {
        setClaimResult(result);
        toast.success(`Dia ${day} resgatado! 🎉`);
      } else {
        toast.error(result.error ?? "Erro ao resgatar.");
      }
    });
  };

  // Sem VIP
  if (!status.pass) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400/20 to-purple-500/20 flex items-center justify-center border border-yellow-400/20">
          <Star size={36} className="text-yellow-400" />
        </div>
        <div>
          <h1 className="font-pixel text-lg text-[#FFCB05] mb-2">Passe Apoiador da Liga</h1>
          <p className="text-slate-400 text-sm max-w-md">
            O Passe Apoiador é um agradecimento especial para quem ajudou a manter o servidor da Liga Zikachu online.
            Fale com um administrador para ativar o seu.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-slate-950/40 p-6 max-w-sm w-full space-y-3 text-left">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">O que você ganha</p>
          {["30 dias de recompensas diárias", "ZikaCoins, Ovos, Itens do Shop", "Título exclusivo Pilar da Comunidade", "Efeito de entrada único no perfil", "Pacotes de figurinhas que abrem na hora"].map(b => (
            <div key={b} className="flex items-center gap-2 text-sm text-slate-300">
              <Sparkles size={12} className="text-yellow-400 shrink-0" />
              {b}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pass = status.pass;
  const isExpired = pass.isExpired;

  return (
    <div className="space-y-6 pb-12">
      {showCelebration && <VipCelebration onDone={celebDone} />}
      {claimResult && <RewardClaimModal result={claimResult} onClose={() => setClaimResult(null)} />}

      {/* Header */}
      <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-r from-yellow-950/30 via-purple-950/20 to-yellow-950/30 p-6 relative overflow-hidden">
        {/* shimmer line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="text-yellow-400" />
              <span className="text-xs uppercase tracking-widest text-yellow-400/70 font-semibold">Passe Apoiador da Liga</span>
              {!isExpired && (
                <span className="rounded-full bg-yellow-400/10 border border-yellow-400/30 px-2 py-0.5 text-xs text-yellow-300 font-semibold">
                  Ativo
                </span>
              )}
              {isExpired && (
                <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-xs text-red-400 font-semibold">
                  Expirado
                </span>
              )}
            </div>
            <h1 className="font-pixel text-base text-white mb-2">Pilar da Comunidade</h1>
            <p className="text-xs italic text-slate-400">&ldquo;Sem você, as luzes se apagariam.&rdquo;</p>
          </div>

          <div className="text-right text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 justify-end">
              <Clock size={11} />
              <span>Expira em: <span className="text-slate-200 font-medium">{pass.daysRemaining}d</span></span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <CheckCircle2 size={11} />
              <span>Dias resgatados: <span className="text-slate-200 font-medium">{claimedDays.size}/30</span></span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Progresso do ciclo</span>
            <span>{claimedDays.size} de 30 dias</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${(claimedDays.size / 30) * 100}%`,
                background: "linear-gradient(90deg, #FFCB05, #f97316, #c084fc)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={14} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-300">Calendário de 30 dias</h2>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-10 gap-2">
          {schedule.map((reward) => {
            const isClaimed = claimedDays.has(reward.day);
            const isToday = reward.day === today;
            const isFuture = today !== null && reward.day > today;
            const isPast = today !== null && reward.day < today && !isClaimed;

            return (
              <DayCard
                key={reward.day}
                reward={reward}
                isClaimed={isClaimed}
                isToday={isToday}
                isFuture={isFuture}
                isPast={isPast}
                isExpired={isExpired}
                canClaim={status.canClaimToday && isToday}
                pending={pending}
                onClaim={() => handleClaim(reward.day)}
              />
            );
          })}
        </div>
      </div>

      {/* Today's reward detail */}
      {today && !claimedDays.has(today) && !isExpired && (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-950/10 p-5">
          <p className="text-xs text-yellow-400/70 font-semibold uppercase tracking-widest mb-3">
            Recompensa de hoje — Dia {today}
          </p>
          {(() => {
            const r = schedule.find(s => s.day === today);
            if (!r) return null;
            return (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{r.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.label}</p>
                    <p className="text-xs text-slate-400">Dia {r.day} de 30</p>
                  </div>
                </div>
                <Button
                  onClick={() => handleClaim(today)}
                  disabled={pending}
                  className="gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold"
                >
                  <Gift size={14} />
                  {pending ? "Resgatando..." : "Resgatar"}
                </Button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Claimed today */}
      {today && claimedDays.has(today) && !isExpired && (
        <div className="rounded-2xl border border-green-500/20 bg-green-950/10 p-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-300">Recompensa de hoje resgatada!</p>
            <p className="text-xs text-slate-400">Volte amanhã para o Dia {today + 1}.</p>
          </div>
        </div>
      )}

      {/* Footer message */}
      <p className="text-center text-xs text-slate-600 italic">
        Obrigado por ajudar a manter o servidor da Liga Zikachu online. Seu apoio mantém a liga viva.
      </p>
    </div>
  );
}

// ── Day card ──────────────────────────────────────────────────────────────────

interface DayCardProps {
  reward: DayReward;
  isClaimed: boolean;
  isToday: boolean;
  isFuture: boolean;
  isPast: boolean;
  isExpired: boolean;
  canClaim: boolean;
  pending: boolean;
  onClaim: () => void;
}

function DayCard({ reward, isClaimed, isToday, isFuture, canClaim, pending, onClaim }: DayCardProps) {
  const bg = isClaimed
    ? "bg-green-950/30 border-green-500/20"
    : isToday
    ? "bg-yellow-950/30 border-yellow-400/50 shadow-lg shadow-yellow-900/20"
    : isFuture
    ? "bg-slate-900/30 border-border/30 opacity-50"
    : "bg-slate-900/50 border-border/40";

  return (
    <div
      className={`relative rounded-xl border p-2 flex flex-col items-center gap-1 cursor-default ${bg} ${canClaim ? "cursor-pointer hover:border-yellow-400/70 transition-colors" : ""} ${reward.isMilestone && !isClaimed ? "ring-1 ring-purple-500/30" : ""}`}
      onClick={canClaim ? onClaim : undefined}
      title={reward.label}
    >
      {/* Day number */}
      <span className={`text-[10px] font-bold leading-none ${isToday ? "text-yellow-400" : "text-slate-500"}`}>
        {reward.day}
      </span>

      {/* Emoji */}
      <span className="text-lg leading-none">{isClaimed ? "✅" : isFuture ? <Lock size={12} className="text-slate-600" /> : reward.emoji}</span>

      {/* Milestone star */}
      {reward.isMilestone && !isClaimed && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center">
          <Star size={6} className="text-white" fill="white" />
        </div>
      )}

      {/* Today pulse ring */}
      {isToday && !isClaimed && (
        <div className="absolute inset-0 rounded-xl border border-yellow-400/30 animate-ping opacity-30" />
      )}

      {/* Loading */}
      {canClaim && pending && (
        <div className="absolute inset-0 rounded-xl bg-yellow-400/10 flex items-center justify-center">
          <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
