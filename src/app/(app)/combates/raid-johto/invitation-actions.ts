"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  getJohtoInvitationForPlayer,
  openJohtoInvitation,
  skipJohtoInvitationVote,
  submitJohtoInvitationVote,
} from "@/lib/johto-invitation";
import { JOHTO_VOTE_QUESTIONS, type JohtoVoteQuestionKey } from "@/lib/johto-invitation-copy";

async function sessionPlayerId(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user || isAdmin(user.role)) return null;
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  return player?.id ?? null;
}

function refreshInvitation() {
  revalidatePath("/combates/raid-johto");
  revalidatePath("/", "layout");
}

type MutationResult =
  | { ok: true; state: Awaited<ReturnType<typeof getJohtoInvitationForPlayer>> }
  | { ok: false; message: string };

async function transition(
  operation: (playerId: string) => ReturnType<typeof openJohtoInvitation>,
  options: { revalidate?: boolean } = {},
): Promise<MutationResult> {
  const playerId = await sessionPlayerId();
  if (!playerId) return { ok: false, message: "Faça login novamente." };
  try {
    const state = await operation(playerId);
    if (options.revalidate !== false) refreshInvitation();
    return { ok: true, state };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível atualizar o convite." };
  }
}

export async function getJohtoInvitationAction() {
  const playerId = await sessionPlayerId();
  return playerId ? getJohtoInvitationForPlayer(playerId) : null;
}

export async function openJohtoInvitationAction(_formData?: FormData): Promise<MutationResult> {
  // A abertura é gravada, mas o layout não pode ser revalidado neste momento:
  // ele removeria o modal antes de o jogador conseguir ler o convite.
  return transition(openJohtoInvitation, { revalidate: false });
}

export async function skipJohtoInvitationVoteAction(_formData?: FormData): Promise<MutationResult> {
  return transition(skipJohtoInvitationVote);
}

export async function submitJohtoInvitationVoteAction(formData: FormData): Promise<MutationResult> {
  const answers = Object.fromEntries(
    JOHTO_VOTE_QUESTIONS.map(({ key }) => [key, String(formData.get(key) ?? "")]),
  ) as Record<JohtoVoteQuestionKey, string>;
  // Mantém a confirmação do voto visível até o jogador escolher continuar.
  return transition((playerId) => submitJohtoInvitationVote(playerId, answers), { revalidate: false });
}
