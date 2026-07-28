"use server";

import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import {
  canAccessLivePvp,
  getLivePvpAccessConfig,
} from "@/lib/live-pvp-access";
import {
  getLegalMovesWithRecommendation,
  type LivePvpMove,
} from "@/lib/live-pvp-moves";
import { resolveLivePvpTurn, type LivePvpFighter } from "@/lib/live-pvp-engine";

async function requireLivePvpAccess() {
  const user = await getSessionUser();
  if (!user) throw new Error("Sessão inválida.");
  const player = await getSessionPlayer(user.id);
  const config = await getLivePvpAccessConfig();
  if (!canAccessLivePvp(config, player?.id, isAdmin(user.role)))
    throw new Error("Arena Online não liberada para esta conta.");
}

export async function loadLivePvpMovesAction(
  pokemonId: number,
  level: number,
): Promise<{
  moves?: LivePvpMove[];
  recommendedIds?: number[];
  error?: string;
}> {
  await requireLivePvpAccess();
  try {
    const result = await getLegalMovesWithRecommendation(pokemonId, level);
    return {
      moves: result.moves,
      recommendedIds: result.recommended.map((move) => move.id),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os golpes.",
    };
  }
}

export async function resolveLivePvpTurnAction(input: {
  fighterA: LivePvpFighter;
  fighterB: LivePvpFighter;
  moveA: LivePvpMove | null;
  moveB: LivePvpMove | null;
}) {
  await requireLivePvpAccess();
  return resolveLivePvpTurn(
    input.fighterA,
    input.moveA,
    input.fighterB,
    input.moveB,
  );
}
