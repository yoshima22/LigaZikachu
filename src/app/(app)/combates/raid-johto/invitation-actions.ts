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
): Promise<MutationResult> {
  const playerId = await sessionPlayerId();
  if (!playerId) return { ok: false, message: "Faça login novamente." };
  try {
    const state = await operation(playerId);
    refreshInvitation();
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
  return transition(openJohtoInvitation);
}

export async function skipJohtoInvitationVoteAction(_formData?: FormData): Promise<MutationResult> {
  return transition(skipJohtoInvitationVote);
}

export async function submitJohtoInvitationVoteAction(formData: FormData): Promise<MutationResult> {
  const answers = Object.fromEntries(
    JOHTO_VOTE_QUESTIONS.map(({ key }) => [key, String(formData.get(key) ?? "")]),
  ) as Record<JohtoVoteQuestionKey, string>;
  return transition((playerId) => submitJohtoInvitationVote(playerId, answers));
}
