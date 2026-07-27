"use server";

import { requireAdmin } from "@/lib/auth/permissions";
import { getLegalMoves, type LivePvpMove } from "@/lib/live-pvp-moves";
import { resolveLivePvpTurn, type LivePvpFighter } from "@/lib/live-pvp-engine";

export async function loadLivePvpMovesAction(pokemonId: number, level: number): Promise<{ moves?: LivePvpMove[]; error?: string }> {
  await requireAdmin();
  try {
    return { moves: await getLegalMoves(pokemonId, level) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível carregar os golpes." };
  }
}

export async function resolveLivePvpTurnAction(input: {
  fighterA: LivePvpFighter;
  fighterB: LivePvpFighter;
  moveA: LivePvpMove;
  moveB: LivePvpMove;
}) {
  await requireAdmin();
  return resolveLivePvpTurn(input.fighterA, input.moveA, input.fighterB, input.moveB);
}
