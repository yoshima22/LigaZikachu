"use client";

import { useTransition } from "react";
import { BoosterCodeStatus, DistributionStatus } from "@prisma/client";
import { Ban, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  invalidateBoosterCodeAction,
  markCodeRedeemedAction,
  revokeCodeDistributionAction
} from "../actions";

interface CodeRowActionsProps {
  codeId?: string;
  codeStatus?: BoosterCodeStatus;
  distributionId?: string;
  distributionStatus?: DistributionStatus;
  admin?: boolean;
}

export function CodeRowActions({
  codeId,
  codeStatus,
  distributionId,
  distributionStatus,
  admin = false
}: CodeRowActionsProps) {
  const [isPending, startTransition] = useTransition();

  const canMarkRedeemed =
    distributionId && distributionStatus === DistributionStatus.ASSIGNED;
  const canRevoke = admin && distributionId && distributionStatus === DistributionStatus.ASSIGNED;
  const canInvalidate = admin && codeId && codeStatus === BoosterCodeStatus.AVAILABLE;

  if (!canMarkRedeemed && !canRevoke && !canInvalidate) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canMarkRedeemed && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const result = await markCodeRedeemedAction({ id: distributionId });
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Codigo marcado como resgatado.");
            })
          }
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 px-2 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
        >
          <CheckCircle2 size={13} />
          Resgatado
        </button>
      )}

      {canRevoke && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Revogar esta distribuicao e devolver o codigo ao estoque?")) return;

            startTransition(async () => {
              const result = await revokeCodeDistributionAction({ id: distributionId });
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Distribuicao revogada.");
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 px-2 py-1 text-xs font-semibold text-orange-400 hover:bg-orange-500/10 disabled:opacity-50"
        >
          <RotateCcw size={13} />
          Revogar
        </button>
      )}

      {canInvalidate && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Invalidar este codigo disponivel?")) return;

            startTransition(async () => {
              const result = await invalidateBoosterCodeAction({ id: codeId });
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Codigo invalidado.");
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
        >
          <Ban size={13} />
          Invalidar
        </button>
      )}
    </div>
  );
}
