"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  adminSetMascotStateAction,
  healMascotSusAction,
  retireArenaTeamAction,
  runBotBattleAction,
  runPvpBattleAction,
} from "../actions";

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

export function BotBattleButton({ teamId }: { teamId: string }) {
  const { pending, run } = useArenaAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => runBotBattleAction(teamId), "Combate resolvido.")}
      className="rounded-xl bg-[#FFCB05] px-3 py-2 text-xs font-bold text-[#1A1A2E] disabled:opacity-50"
    >
      Combater bot
    </button>
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
