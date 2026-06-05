"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Timer, Zap, Shield, Skull } from "lucide-react";
import { getSpriteUrl } from "@/lib/mascot-data";
import {
  adminSetMascotStateAction,
  deleteArenaTeamAction,
  healMascotSusAction,
  lockBotAction,
  purgeAdminArenaDataAction,
  retireArenaTeamAction,
  runBotBattleAction,
  runOpportunisticAttackAction,
  runPvpBattleAction,
} from "../actions";
import type { ArenaDifficulty } from "@/lib/arena-z";

// ── Cooldown counter ──────────────────────────────────────────────────────────
function CooldownBadge({ ms }: { ms: number }) {
  const [rem, setRem] = useState(ms);
  useEffect(() => {
    setRem(ms);
    if (ms <= 0) return;
    const iv = setInterval(() => setRem(r => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(iv);
  }, [ms]);
  if (rem <= 0) return null;
  const s = Math.ceil(rem / 1000);
  return (
    <span className="flex items-center gap-1 rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
      <Timer size={9} /> {s}s
    </span>
  );
}

type BotBattleResult = NonNullable<Awaited<ReturnType<typeof runBotBattleAction>>["result"]>;

function useArenaAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, success: string) => {
    startTransition(async () => {
      const result = await fn();
      if (result.error) toast.error(result.error);
      else {
        toast.success(success);
        router.refresh();
      }
    });
  };
  return { pending, run };
}

function formatLoot(reward: BotBattleResult["reward"]) {
  const parts = [`${reward.coins} ZC`, `${reward.exp} EXP`];
  if (reward.food > 0) parts.push(`${reward.food} comida`);
  if (reward.sweet > 0) parts.push(`${reward.sweet} doce`);
  return parts.join(" / ");
}

const DIFFICULTY_STYLES: Record<ArenaDifficulty, { border: string; bg: string; text: string; badge: string }> = {
  easy:   { border: "border-green-500/40",  bg: "bg-green-500/10",  text: "text-green-300",  badge: "bg-green-500/20 text-green-200" },
  normal: { border: "border-yellow-500/40", bg: "bg-yellow-500/10", text: "text-yellow-300", badge: "bg-yellow-500/20 text-yellow-200" },
  hard:   { border: "border-red-500/40",    bg: "bg-red-500/10",    text: "text-red-300",    badge: "bg-red-500/20 text-red-200" },
};
const DIFFICULTY_LABELS: Record<ArenaDifficulty, string> = { easy: "🟢 Fácil", normal: "🟡 Normal", hard: "🔴 Difícil" };

export function BotBattleButton({ teamId, cooldownMs = 0 }: { teamId: string; cooldownMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BotBattleResult | null>(null);
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>("normal");
  const [localCooldown, setLocalCooldown] = useState(cooldownMs);

  const styles = DIFFICULTY_STYLES[difficulty];
  const onCooldown = localCooldown > 0;

  return (
    <>
      {/* Difficulty selector + battle button */}
      <div className="flex flex-col gap-2 items-end">
        <div className="flex gap-1">
          {(["easy", "normal", "hard"] as ArenaDifficulty[]).map(d => (
            <button key={d} type="button" onClick={() => setDifficulty(d)}
              className={`rounded-lg px-2 py-1 text-[10px] font-semibold border transition-all ${
                difficulty === d ? DIFFICULTY_STYLES[d].border + " " + DIFFICULTY_STYLES[d].bg + " " + DIFFICULTY_STYLES[d].text
                : "border-border text-slate-500 hover:text-slate-300"
              }`}>
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onCooldown && <CooldownBadge ms={localCooldown} />}
          <button
            type="button"
            disabled={pending || onCooldown}
            onClick={() => {
              startTransition(async () => {
                const response = await runBotBattleAction(teamId, difficulty);
                if (response.error) {
                  toast.error(response.error);
                  return;
                }
                if (response.result) {
                  setResult(response.result);
                  setLocalCooldown(3 * 60 * 1000); // 3min cooldown
                  toast.success(response.result.won ? "Vitoria na Arena Z!" : "Derrota na Arena Z.");
                }
                router.refresh();
              });
            }}
            className={`rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 transition-all ${
              onCooldown ? "border border-border bg-slate-900 text-slate-500" : "bg-[#FFCB05] text-[#1A1A2E]"
            }`}
          >
            {pending ? "Combatendo…" : "⚔️ Combater"}
          </button>
        </div>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setResult(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#FFCB05]/30 bg-slate-950 p-5 shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-[#FFCB05]">Resultado da Arena Z</p>
                <h3 className={`mt-1 text-lg font-bold ${result.won ? "text-green-300" : "text-red-300"}`}>
                  {result.won ? "Vitoria contra bot" : "Derrota contra bot"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Treinador: <span className="font-semibold text-slate-200">{result.botName}</span>
                  {" "}| {result.rounds} turno(s)
                  {result.difficultyLabel && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      result.difficulty === "easy" ? "bg-green-500/20 text-green-300" :
                      result.difficulty === "hard" ? "bg-red-500/20 text-red-300" :
                      "bg-yellow-500/20 text-yellow-300"
                    }`}>
                      {result.difficultyLabel}
                    </span>
                  )}
                </p>
              </div>
              <button type="button" onClick={() => setResult(null)} className="rounded-lg border border-border p-2 text-slate-400 hover:text-white">
                <X size={14} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
              <p className="text-xs font-bold text-[#FFCB05]">Cofre</p>
              <p className="mt-1 text-sm text-slate-200">
                {result.won ? `Loot adicionado: ${formatLoot(result.reward)}` : "Nenhum loot foi adicionado nesta luta."}
              </p>
            </div>

            {result.injuredMascots.length > 0 && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-xs font-bold text-red-200">Mascotes feridos</p>
                <p className="mt-1 text-sm text-red-100">{result.injuredMascots.join(", ")}</p>
                <p className="mt-1 text-[11px] text-red-200/70">Use Atendimento SUS para liberar o mascote depois.</p>
              </div>
            )}

            {result.teamDefeated && (
              <div className="mt-3 rounded-xl border border-red-400/40 bg-red-500/10 p-3">
                <p className="text-xs font-bold text-red-100">Equipe encerrada</p>
                <p className="mt-1 text-sm text-red-100/80">
                  Sua equipe foi derrotada e saiu da Arena. O cofre restante fica disponivel para coleta; cure os mascotes feridos antes de montar uma nova equipe.
                </p>
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs font-bold text-slate-300">Equipe do bot</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {result.botMascots.map((m, index) => (
                  <div key={`${m.pokemonId}-${index}`} className="flex items-center gap-2 rounded-xl border border-border bg-slate-900/50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getSpriteUrl(m.pokemonId, true)} alt="" className="h-11 w-11 object-contain" style={{ imageRendering: "pixelated" }} />
                    <span>
                      <span className="block text-xs font-semibold text-slate-100">{m.name}</span>
                      <span className="text-[10px] text-slate-500">Nv.{m.level} | {m.type}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {result.highlights.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-slate-300">Destaques</p>
                <div className="mt-2 space-y-1 text-xs text-slate-400">
                  {result.highlights.map(turn => (
                    <p key={turn.turn}>
                      Turno {turn.turn}: {turn.actorName} causou {turn.damage} dano em {turn.targetName}{turn.advantageApplied ? " com vantagem de tipo" : ""}.
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function RetireTeamButton({ teamId, defeated = false }: { teamId: string; defeated?: boolean }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(defeated ? "Coletar o cofre restante desta equipe derrotada?" : "Retirar equipe da Arena e coletar o cofre agora?")) return;
        run(() => retireArenaTeamAction(teamId), defeated ? "Cofre restante coletado." : "Equipe retirada e cofre coletado.");
      }}
      className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300 disabled:opacity-50"
    >
      {defeated ? "Coletar cofre restante" : "Retirar e coletar"}
    </button>
  );
}

type PvpResult = Awaited<ReturnType<typeof runPvpBattleAction>>["result"];

export function PvpBattleButton({ attackTeamId, defenseTeamId }: { attackTeamId: string; defenseTeamId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PvpResult | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Atacar esta equipe? Você pode ganhar ou perder loot do cofre.")) return;
          startTransition(async () => {
            const r = await runPvpBattleAction(attackTeamId, defenseTeamId);
            if (r.error) { toast.error(r.error); return; }
            if (r.result) {
              setResult(r.result);
              const won = r.result.winnerName !== null;
              toast.success(won ? "Vitória no PvP! 🏆" : "Derrota no PvP.");
            }
            router.refresh();
          });
        }}
        className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 hover:border-red-300 disabled:opacity-50"
      >
        {pending ? "Combatendo…" : "⚔️ Atacar"}
      </button>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setResult(null)}>
          <div className="max-w-sm rounded-2xl border border-red-500/30 bg-slate-950 p-5 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-red-400">Arena PvP</p>
                <h3 className="mt-1 text-lg font-bold text-white">
                  {result.winnerName ? `🏆 ${result.winnerName} venceu!` : "Empate"}
                </h3>
                {result.loserName && (
                  <p className="text-sm text-slate-400">Perdedor: {result.loserName}</p>
                )}
              </div>
              <button onClick={() => setResult(null)} className="rounded-lg border border-border p-2 text-slate-400 hover:text-white">
                <X size={14}/>
              </button>
            </div>
            {(result.stolen.coins > 0 || result.stolen.exp > 0) && (
              <div className="rounded-xl border border-[#FFCB05]/20 bg-[#FFCB05]/5 p-3">
                <p className="text-xs font-bold text-[#FFCB05]">Loot roubado</p>
                <p className="text-sm text-slate-200">
                  {[
                    result.stolen.coins > 0 ? `${result.stolen.coins} ZC` : null,
                    result.stolen.exp > 0 ? `${result.stolen.exp} EXP` : null,
                    result.stolen.food > 0 ? `${result.stolen.food} comida` : null,
                    result.stolen.sweet > 0 ? `${result.stolen.sweet} doce` : null,
                  ].filter(Boolean).join(" / ")}
                </p>
              </div>
            )}
            <button onClick={() => setResult(null)} className="w-full rounded-xl bg-slate-800 py-2 text-xs text-slate-300">Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}

export function SusButton({ mascotId }: { mascotId: string }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => healMascotSusAction(mascotId), "Atendimento SUS concluido.")}
      className="rounded-lg bg-[#FFCB05] px-2 py-1 text-[10px] font-bold text-[#1A1A2E] disabled:opacity-50"
    >
      Atendimento SUS
    </button>
  );
}

export function DeleteTeamButton({ teamId, isAdmin = false }: { teamId: string; isAdmin?: boolean }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remover equipe permanentemente? Os mascotes voltam ao banco.")) return;
        run(() => deleteArenaTeamAction(teamId), "Equipe removida.");
      }}
      className="rounded-xl border border-slate-600/40 bg-slate-800/40 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
    >
      🗑 Remover
    </button>
  );
}

export function PurgeAdminArenaButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remover TODOS os registros de arena de contas admin? (Batalhas, equipes, loot). Irreversível.")) return;
        startTransition(async () => {
          const r = await purgeAdminArenaDataAction();
          if (r.error) toast.error(r.error);
          else {
            toast.success(`Limpo: ${r.teams} equipes e ${r.battles} batalhas de admin removidas.`);
            router.refresh();
          }
        });
      }}
      className="w-full rounded-xl border border-red-600/40 bg-red-600/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-600/20 disabled:opacity-50"
    >
      {pending ? "Limpando…" : "🧹 Limpar dados de admin da Arena"}
    </button>
  );
}

export function AdminMascotStateButton({ mascotId, state, label }: { mascotId: string; state: "FREE" | "INJURED" | "RESTING"; label: string }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => adminSetMascotStateAction(mascotId, state), "Estado atualizado.")}
      className="rounded-lg border border-border bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:text-[#FFCB05] disabled:opacity-50"
    >
      {label}
    </button>
  );
}

// ── Travar bot antes da batalha (determinístico) ──────────────────────────────

export function LockBotButton({ teamId, difficulty }: { teamId: string; difficulty: ArenaDifficulty }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await lockBotAction(teamId, difficulty);
          if (r.error) toast.error(r.error);
          else { toast.success("Adversário travado! Clique em Combater para confirmar."); router.refresh(); }
        });
      }}
      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-semibold text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
    >
      {pending ? "Gerando…" : "🔒 Travar bot"}
    </button>
  );
}

// ── Ataque oportunista contra rival ferido ────────────────────────────────────

export function OpportunisticAttackButton({ mascotId, mascotName, ownerName }: { mascotId: string; mascotName: string; ownerName: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ stolenExp: number; stolenFood: number; extraRestMinutes: number } | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Atacar ${mascotName} de ${ownerName} enquanto está ferido? Você vai roubar EXP e aumentar o tempo de repouso.`)) return;
          startTransition(async () => {
            const r = await runOpportunisticAttackAction(mascotId);
            if (r.error) { toast.error(r.error); return; }
            if (r.result) {
              setResult(r.result);
              toast.success(`Ataque oportunista bem-sucedido! +${r.result.stolenExp} EXP roubados.`);
            }
          });
        }}
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
      >
        😈 Atacar enquanto ferido
      </button>
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setResult(null)}>
          <div className="max-w-sm rounded-2xl border border-red-500/30 bg-slate-950 p-5 space-y-3 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-red-200">😈 Ataque Oportunista!</p>
            <p className="text-xs text-slate-300">Você roubou <strong className="text-[#FFCB05]">{result.stolenExp} EXP</strong>{result.stolenFood > 0 ? " e 1 petisco" : ""}.</p>
            <p className="text-xs text-slate-400">Repouso de {mascotName} aumentado em {result.extraRestMinutes} min.</p>
            <button type="button" onClick={() => setResult(null)} className="w-full rounded-lg bg-slate-800 py-2 text-xs text-slate-300">Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}
