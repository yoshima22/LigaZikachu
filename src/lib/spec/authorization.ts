import { prisma } from "@/lib/prisma";
import type { SpecBroadcasterPolicy } from "./constants";

// Resolve o torneio de uma partida TCG (via tournamentWeek). Partidas apenas de
// temporada (sem tournamentWeek) não são transmissíveis pelo Modo SPEC.
export async function getMatchTournamentId(matchId: string): Promise<string | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { tournamentWeek: { select: { tournamentId: true } } },
  }).catch(() => null);
  return match?.tournamentWeek?.tournamentId ?? null;
}

/** É participante APROVADO do torneio? */
export async function isApprovedTournamentParticipant(playerId: string, tournamentId: string): Promise<boolean> {
  const reg = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_playerId: { tournamentId, playerId } },
    select: { status: true },
  }).catch(() => null);
  return reg?.status === "APPROVED";
}

/**
 * Pode abrir uma transmissão desta partida?
 * Respeita a política configurada (participante do torneio / só jogadores da
 * partida / só admin). Admin sempre pode.
 */
export async function canStartSpecStream(params: {
  playerId: string | null;
  isAdmin: boolean;
  tournamentId: string;
  policy: SpecBroadcasterPolicy;
  matchPlayerIds: string[];
}): Promise<boolean> {
  if (params.isAdmin) return true;
  if (!params.playerId) return false;
  switch (params.policy) {
    case "ADMIN_ONLY":
      return false;
    case "MATCH_PLAYERS_ONLY":
      return params.matchPlayerIds.includes(params.playerId);
    case "ANY_TOURNAMENT_PARTICIPANT":
    default:
      return isApprovedTournamentParticipant(params.playerId, params.tournamentId);
  }
}

/** Qualquer usuário autenticado pode assistir. */
export function canWatchSpecStream(userId: string | null | undefined): boolean {
  return Boolean(userId);
}

/** O dono da transmissão ou um admin podem encerrá-la. */
export function canManageSpecStream(params: {
  userId: string | null | undefined;
  isAdmin: boolean;
  broadcasterUserId: string;
}): boolean {
  if (!params.userId) return false;
  return params.isAdmin || params.userId === params.broadcasterUserId;
}
