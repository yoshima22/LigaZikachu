"use server";

import { requireAdmin } from "@/lib/auth/permissions";
import { getLegalMovesWithRecommendation, type LivePvpMove } from "@/lib/live-pvp-moves";
import { resolveLivePvpTurn, type LivePvpFighter } from "@/lib/live-pvp-engine";

export async function loadLivePvpMovesAction(pokemonId: number, level: number): Promise<{ moves?: LivePvpMove[]; recommendedIds?: number[]; error?: string }> {
  await requireAdmin();
  try {
    const result = await getLegalMovesWithRecommendation(pokemonId, level);
    return { moves: result.moves, recommendedIds: result.recommended.map((move) => move.id) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível carregar os golpes." };
  }
}

export async function resolveLivePvpTurnAction(input: {
  fighterA: LivePvpFighter;
  fighterB: LivePvpFighter;
  moveA: LivePvpMove | null;
  moveB: LivePvpMove | null;
}) {
  await requireAdmin();
  return resolveLivePvpTurn(input.fighterA, input.moveA, input.fighterB, input.moveB);
}
