"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  cancelArenaDraftMatchAdminAction,
  expireArenaDraftPhaseAdminAction,
} from "./actions";
export function ArenaDraftAdminControls({ matchId }: { matchId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (action: () => Promise<void>, message: string) =>
    start(async () => {
      await action();
      toast.success(message);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      <button
        disabled={pending}
        onClick={() =>
          run(
            () => expireArenaDraftPhaseAdminAction(matchId),
            "Prazo encerrado. A sala resolverá no próximo pulso.",
          )
        }
        className="rounded-lg border border-amber-300/25 px-3 py-2 text-[10px] font-bold text-amber-200"
      >
        Encerrar prazo
      </button>
      <button
        disabled={pending}
        onClick={() =>
          run(
            () => cancelArenaDraftMatchAdminAction(matchId),
            "Partida cancelada.",
          )
        }
        className="rounded-lg border border-rose-300/25 px-3 py-2 text-[10px] font-bold text-rose-200"
      >
        Cancelar partida
      </button>
    </div>
  );
}
