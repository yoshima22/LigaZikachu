"use client";

import { useState, useTransition } from "react";
import { ShieldX, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  assignLeagueBadgeAction,
  removeLeagueBadgeAction
} from "@/app/(app)/insignias/actions";

interface PlayerOption {
  id: string;
  displayName: string;
}

interface PlayerBadgeAdminActionsProps {
  badgeId: string;
  currentPlayerId: string;
  players: PlayerOption[];
}

export function PlayerBadgeAdminActions({
  badgeId,
  currentPlayerId,
  players
}: PlayerBadgeAdminActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [playerId, setPlayerId] = useState(currentPlayerId);

  function moveBadge() {
    if (!playerId) return;

    startTransition(async () => {
      const result = await assignLeagueBadgeAction({ badgeId, playerId });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(playerId === currentPlayerId ? "Insignia atualizada." : "Insignia movida para outro jogador.");
    });
  }

  function clearOwner() {
    if (!confirm("Remover o dono desta insignia e deixa-la sem dono?")) return;

    startTransition(async () => {
      const result = await removeLeagueBadgeAction({ badgeId, playerId: currentPlayerId });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Insignia agora esta sem dono.");
    });
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <select
        value={playerId}
        onChange={(event) => setPlayerId(event.target.value)}
        disabled={isPending}
        className="min-w-0 flex-1 rounded-lg border border-border bg-slate-900/70 px-2 py-1.5 text-xs text-slate-100"
      >
        {players.map((player) => (
          <option key={player.id} value={player.id}>{player.displayName}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={isPending || !playerId}
        onClick={moveBadge}
        className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 px-2 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
      >
        <UserPlus size={13} />
        Mover
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={clearOwner}
        className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
      >
        <ShieldX size={13} />
        Sem dono
      </button>
    </div>
  );
}
