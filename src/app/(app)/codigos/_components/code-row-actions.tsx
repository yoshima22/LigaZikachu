"use client";

import { useState, useTransition } from "react";
import { BoosterCodeStatus, DistributionReason, DistributionStatus } from "@prisma/client";
import { Ban, CheckCircle2, RotateCcw, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  assignSpecificCodesToPlayerAction,
  deleteBoosterCodeAction,
  invalidateBoosterCodeAction,
  markCodeRedeemedAction,
  revokeCodeDistributionAction
} from "../actions";

interface PlayerOption {
  id: string;
  displayName: string;
}

interface CodeRowActionsProps {
  codeId?: string;
  codeStatus?: BoosterCodeStatus;
  distributionId?: string;
  distributionStatus?: DistributionStatus;
  players?: PlayerOption[];
  admin?: boolean;
}

const actionButton = "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-50";

export function CodeRowActions({
  codeId,
  codeStatus,
  distributionId,
  distributionStatus,
  players = [],
  admin = false
}: CodeRowActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [showSend, setShowSend] = useState(false);
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [reasonDetail, setReasonDetail] = useState("");

  const canMarkRedeemed =
    distributionId && distributionStatus === DistributionStatus.ASSIGNED;
  const canRevoke = admin && distributionId && distributionStatus === DistributionStatus.ASSIGNED;
  const canInvalidate = admin && codeId && codeStatus === BoosterCodeStatus.AVAILABLE;
  const canSend = admin && codeId && codeStatus === BoosterCodeStatus.AVAILABLE && players.length > 0;
  const canDelete = admin && codeId;

  if (!canMarkRedeemed && !canRevoke && !canInvalidate && !canSend && !canDelete) return null;

  function runDelete() {
    if (!codeId) return;
    if (!confirm("Excluir este codigo do banco de dados? Isso tambem remove presentes vinculados a ele.")) return;

    startTransition(async () => {
      const result = await deleteBoosterCodeAction({ id: codeId });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Codigo excluido.");
    });
  }

  function runSend() {
    if (!codeId || !playerId) return;

    startTransition(async () => {
      const result = await assignSpecificCodesToPlayerAction({
        boosterCodeIds: [codeId],
        playerId,
        reason: DistributionReason.MANUAL_ADJUSTMENT,
        reasonDetail: reasonDetail || null
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Codigo enviado para a caixa de presentes.");
      setShowSend(false);
      setReasonDetail("");
    });
  }

  return (
    <div className="space-y-2">
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
            className={actionButton + " border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"}
          >
            <CheckCircle2 size={13} />
            Resgatado
          </button>
        )}

        {canSend && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowSend((value) => !value)}
            className={actionButton + " border-blue-500/30 text-blue-400 hover:bg-blue-500/10"}
          >
            {showSend ? <X size={13} /> : <Send size={13} />}
            Enviar
          </button>
        )}

        {canRevoke && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Revogar esta distribuicao e devolver o codigo ao estoque? O presente vinculado tambem sera removido.")) return;

              startTransition(async () => {
                const result = await revokeCodeDistributionAction({ id: distributionId });
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Distribuicao revogada e presente removido.");
              });
            }}
            className={actionButton + " border-orange-500/30 text-orange-400 hover:bg-orange-500/10"}
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
            className={actionButton + " border-red-500/30 text-red-400 hover:bg-red-500/10"}
          >
            <Ban size={13} />
            Invalidar
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            disabled={isPending}
            onClick={runDelete}
            className={actionButton + " border-red-500/30 text-red-300 hover:bg-red-500/10"}
          >
            <Trash2 size={13} />
            Excluir
          </button>
        )}
      </div>

      {showSend && canSend && (
        <div className="min-w-64 space-y-2 rounded-xl border border-border bg-slate-950/80 p-3">
          <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Jogador
          </label>
          <select
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
            className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>{player.displayName}</option>
            ))}
          </select>
          <input
            value={reasonDetail}
            onChange={(event) => setReasonDetail(event.target.value)}
            placeholder="Detalhe opcional do presente"
            className="w-full rounded-lg border border-border bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
          />
          <button
            type="button"
            disabled={isPending || !playerId}
            onClick={runSend}
            className="w-full rounded-lg bg-[#FFCB05] px-2 py-1.5 text-xs font-semibold text-[#1A1A2E] disabled:opacity-50"
          >
            Enviar este codigo
          </button>
        </div>
      )}
    </div>
  );
}
