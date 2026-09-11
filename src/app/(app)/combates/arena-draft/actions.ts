"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { publicDraftPet, validateArenaDraftPets } from "@/lib/arena-draft";

async function currentPlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Faça login para acessar a Arena Draft.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  return player;
}

export async function saveDraftPresetAction(input: { id?: string; name: string; pets: unknown }) {
  try {
    const player = await currentPlayer();
    const name = input.name.trim().slice(0, 40);
    if (name.length < 3) throw new Error("Dê um nome de ao menos 3 caracteres ao preset.");
    const validation = validateArenaDraftPets(input.pets);
    if (input.id) {
      const existing = await prisma.arenaDraftPreset.findUnique({ where: { id: input.id } });
      if (!existing || existing.ownerId !== player.id) throw new Error("Preset não encontrado.");
      await prisma.arenaDraftPreset.update({ where: { id: input.id }, data: { name, petsJson: validation.pets as unknown as Prisma.InputJsonValue, isReady: validation.valid } });
    } else {
      await prisma.arenaDraftPreset.create({ data: { ownerId: player.id, name, petsJson: validation.pets as unknown as Prisma.InputJsonValue, isReady: validation.valid } });
    }
    revalidatePath("/combates/arena-draft");
    return { success: validation.valid ? "Preset pronto para competir." : "Rascunho salvo.", errors: validation.errors };
  } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível salvar." }; }
}

export async function deleteDraftPresetAction(id: string) {
  try {
    const player = await currentPlayer();
    await prisma.arenaDraftPreset.deleteMany({ where: { id, ownerId: player.id } });
    revalidatePath("/combates/arena-draft"); return { success: "Preset excluído." };
  } catch { return { error: "Não foi possível excluir o preset." }; }
}

export async function joinDraftQueueAction(presetId: string) {
  try {
    const player = await currentPlayer();
    const preset = await prisma.arenaDraftPreset.findFirst({ where: { id: presetId, ownerId: player.id, isReady: true } });
    if (!preset) throw new Error("Selecione um preset completo e válido.");
    const already = await prisma.arenaDraftMatch.findFirst({ where: { OR: [{ playerAId: player.id }, { playerBId: player.id }], state: { notIn: ["FINISHED", "CANCELLED"] } } });
    if (already) return { success: "Você já possui uma sala ativa.", matchId: already.id };
    const match = await prisma.$transaction(async (tx) => {
      const waiting = await tx.arenaDraftMatch.findFirst({ where: { state: "CREATED", playerBId: null, playerAId: { not: player.id } }, orderBy: { createdAt: "asc" } });
      const snapshot = preset.petsJson as Prisma.InputJsonValue;
      if (waiting) return tx.arenaDraftMatch.update({ where: { id: waiting.id }, data: { playerBId: player.id, presetBSnapshot: snapshot, state: "TEAM_REVEAL", stateVersion: { increment: 1 }, deadlineAt: new Date(Date.now() + 30_000), draftJson: { bansA: [], bansB: [], picksA: [], picksB: [], turn: "A", phase: "BAN" } } });
      return tx.arenaDraftMatch.create({ data: { playerAId: player.id, presetASnapshot: snapshot, state: "CREATED" } });
    });
    revalidatePath("/combates/arena-draft"); return { success: match.playerBId ? "Adversário encontrado!" : "Entrou na fila pública.", matchId: match.id };
  } catch (error) { return { error: error instanceof Error ? error.message : "Falha ao entrar na fila." }; }
}

export async function cancelDraftQueueAction(matchId: string) {
  const player = await currentPlayer();
  await prisma.arenaDraftMatch.updateMany({ where: { id: matchId, playerAId: player.id, state: "CREATED", playerBId: null }, data: { state: "CANCELLED", stateVersion: { increment: 1 } } });
  revalidatePath("/combates/arena-draft");
}

type DraftState = { bansA: string[]; bansB: string[]; picksA: string[]; picksB: string[]; turn: "A" | "B"; phase: "BAN" | "PICK" };
const pickOrder: Array<"A" | "B"> = ["A", "B", "B", "A", "A", "B", "B", "A", "A", "B", "B", "A"];
export async function submitArenaDraftAction(matchId: string, targetId: string, idempotencyKey: string) {
  try {
    const player = await currentPlayer();
    await prisma.$transaction(async (tx) => {
      const match = await tx.arenaDraftMatch.findUnique({ where: { id: matchId } });
      if (!match || (match.playerAId !== player.id && match.playerBId !== player.id)) throw new Error("Sala não encontrada.");
      const side: "A"|"B" = match.playerAId === player.id ? "A" : "B";
      if (match.state === "TEAM_REVEAL") {
        await tx.arenaDraftMatch.update({ where: { id: match.id }, data: { state: "BAN_PHASE", stateVersion: { increment: 1 }, deadlineAt: new Date(Date.now()+90_000) } });
        return;
      }
      if (match.state !== "BAN_PHASE" && match.state !== "PICK_PHASE") throw new Error("A sala não aceita esta ação agora.");
      const draft = match.draftJson as unknown as DraftState;
      if (draft.turn !== side) throw new Error("Aguarde a vez do adversário.");
      const own = (match.playerAId === player.id ? match.presetASnapshot : match.presetBSnapshot) as unknown;
      const rival = (match.playerAId === player.id ? match.presetBSnapshot : match.presetASnapshot) as unknown;
      const ownPets = validateArenaDraftPets(own).pets; const rivalPets = validateArenaDraftPets(rival).pets;
      const pool = draft.phase === "BAN" ? rivalPets : ownPets;
      if (!pool.some(p=>p.id===targetId)) throw new Error("Mascote inválido para esta ação.");
      const allUsed = [...draft.bansA,...draft.bansB,...draft.picksA,...draft.picksB];
      if (allUsed.includes(targetId)) throw new Error("Este mascote já foi escolhido ou banido.");
      if (draft.phase === "BAN") {
        (side === "A" ? draft.bansA : draft.bansB).push(targetId);
        const total = draft.bansA.length + draft.bansB.length;
        if (total >= 6) { draft.phase="PICK"; draft.turn=pickOrder[0]; }
        else draft.turn = side === "A" ? "B" : "A";
      } else {
        (side === "A" ? draft.picksA : draft.picksB).push(targetId);
        const total = draft.picksA.length + draft.picksB.length;
        if (total < pickOrder.length) draft.turn = pickOrder[total];
      }
      const totalPicks = draft.picksA.length + draft.picksB.length;
      const nextState = draft.phase === "PICK" ? (totalPicks >= 12 ? "BATTLE_INIT" : "PICK_PHASE") : "BAN_PHASE";
      await tx.arenaDraftAction.create({ data: { matchId, actorId: player.id, idempotencyKey, sequence: match.eventSequence+1, phase: draft.phase, actionType: match.state === "BAN_PHASE" ? "BAN" : "PICK", payloadJson: { targetId } } });
      await tx.arenaDraftMatch.update({ where: { id:matchId }, data: { draftJson: draft as unknown as Prisma.InputJsonValue, state: nextState, stateVersion: { increment:1 }, eventSequence:{increment:1}, deadlineAt:new Date(Date.now()+90_000) } });
    });
    revalidatePath(`/combates/arena-draft/${matchId}`); return { success: "Ação registrada." };
  } catch(error) { return { error:error instanceof Error?error.message:"Ação recusada." }; }
}
