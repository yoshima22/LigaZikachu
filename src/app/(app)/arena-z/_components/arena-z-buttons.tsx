"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { getSpriteUrl } from "@/lib/mascot-data";
import {
  adminSetMascotStateAction,
  healMascotSusAction,
  retireArenaTeamAction,
  runBotBattleAction,
  runPvpBattleAction,
} from "../actions";

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

export function BotBattleButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<BotBattleResult | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const response = await runBotBattleAction(teamId);
            if (response.error) {
              toast.error(response.error);
              return;
            }
            if (response.result) {
              setResult(response.result);
              toast.success(response.result.won ? "Vitoria na Arena Z!" : "Derrota na Arena Z.");
            }
            router.refresh();
          });
        }}
        className="rounded-xl bg-[#FFCB05] px-3 py-2 text-xs font-bold text-[#1A1A2E] disabled:opacity-50"
      >
        Combater bot
      </button>

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
                  Treinador: <span className="font-semibold text-slate-200">{result.botName}</span> | {result.rounds} turno(s)
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

export function RetireTeamButton({ teamId }: { teamId: string }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Retirar equipe da Arena e coletar o cofre agora?")) return;
        run(() => retireArenaTeamAction(teamId), "Equipe retirada e cofre coletado.");
      }}
      className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300 disabled:opacity-50"
    >
      Retirar e coletar
    </button>
  );
}

export function PvpBattleButton({ attackTeamId, defenseTeamId }: { attackTeamId: string; defenseTeamId: string }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Resolver combate PvP automatico contra esta equipe?")) return;
        run(() => runPvpBattleAction(attackTeamId, defenseTeamId), "Combate PvP resolvido.");
      }}
      className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 hover:border-red-300 disabled:opacity-50"
    >
      Desafiar PvP
    </button>
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
