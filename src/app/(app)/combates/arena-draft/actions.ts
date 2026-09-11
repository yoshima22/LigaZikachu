"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { publicDraftPet, validateArenaDraftPets } from "@/lib/arena-draft";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import {
  runArenaCombat,
  type ArenaMascot,
  type ArenaTurnLog,
} from "@/lib/arena-z";

async function currentPlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Faça login para acessar a Arena Draft.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  return player;
}

export async function saveDraftPresetAction(input: {
  id?: string;
  name: string;
  pets: unknown;
}) {
  try {
    const player = await currentPlayer();
    const name = input.name.trim().slice(0, 40);
    if (name.length < 3)
      throw new Error("Dê um nome de ao menos 3 caracteres ao preset.");
    const validation = validateArenaDraftPets(input.pets);
    if (input.id) {
      const existing = await prisma.arenaDraftPreset.findUnique({
        where: { id: input.id },
      });
      if (!existing || existing.ownerId !== player.id)
        throw new Error("Preset não encontrado.");
      await prisma.arenaDraftPreset.update({
        where: { id: input.id },
        data: {
          name,
          petsJson: validation.pets as unknown as Prisma.InputJsonValue,
          isReady: validation.valid,
        },
      });
    } else {
      await prisma.arenaDraftPreset.create({
        data: {
          ownerId: player.id,
          name,
          petsJson: validation.pets as unknown as Prisma.InputJsonValue,
          isReady: validation.valid,
        },
      });
    }
    revalidatePath("/combates/arena-draft");
    return {
      success: validation.valid
        ? "Preset pronto para competir."
        : "Rascunho salvo.",
      errors: validation.errors,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível salvar.",
    };
  }
}

export async function deleteDraftPresetAction(id: string) {
  try {
    const player = await currentPlayer();
    await prisma.arenaDraftPreset.deleteMany({
      where: { id, ownerId: player.id },
    });
    revalidatePath("/combates/arena-draft");
    return { success: "Preset excluído." };
  } catch {
    return { error: "Não foi possível excluir o preset." };
  }
}

export async function joinDraftQueueAction(presetId: string) {
  try {
    const player = await currentPlayer();
    const preset = await prisma.arenaDraftPreset.findFirst({
      where: { id: presetId, ownerId: player.id, isReady: true },
    });
    if (!preset) throw new Error("Selecione um preset completo e válido.");
    if (!validateArenaDraftPets(preset.petsJson).valid)
      throw new Error(
        "Este preset usa as regras antigas. Abra, ajuste os 4.500 pontos do time e salve novamente.",
      );
    const already = await prisma.arenaDraftMatch.findFirst({
      where: {
        OR: [{ playerAId: player.id }, { playerBId: player.id }],
        state: { notIn: ["FINISHED", "CANCELLED"] },
      },
    });
    if (already)
      return { success: "Você já possui uma sala ativa.", matchId: already.id };
    const match = await prisma.$transaction(async (tx) => {
      const waiting = await tx.arenaDraftMatch.findFirst({
        where: {
          state: "CREATED",
          playerBId: null,
          playerAId: { not: player.id },
        },
        orderBy: { createdAt: "asc" },
      });
      const snapshot = preset.petsJson as Prisma.InputJsonValue;
      if (waiting)
        return tx.arenaDraftMatch.update({
          where: { id: waiting.id },
          data: {
            playerBId: player.id,
            presetBSnapshot: snapshot,
            state: "TEAM_REVEAL",
            stateVersion: { increment: 1 },
            deadlineAt: new Date(Date.now() + 30_000),
            draftJson: {
              bansA: [],
              bansB: [],
              picksA: [],
              picksB: [],
              turn: "A",
              phase: "BAN",
            },
          },
        });
      return tx.arenaDraftMatch.create({
        data: {
          playerAId: player.id,
          presetASnapshot: snapshot,
          state: "CREATED",
        },
      });
    });
    revalidatePath("/combates/arena-draft");
    return {
      success: match.playerBId
        ? "Adversário encontrado!"
        : "Entrou na fila pública.",
      matchId: match.id,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Falha ao entrar na fila.",
    };
  }
}

export async function cancelDraftQueueAction(matchId: string) {
  const player = await currentPlayer();
  await prisma.arenaDraftMatch.updateMany({
    where: {
      id: matchId,
      playerAId: player.id,
      state: "CREATED",
      playerBId: null,
    },
    data: { state: "CANCELLED", stateVersion: { increment: 1 } },
  });
  revalidatePath("/combates/arena-draft");
}

export async function createDraftChallengeAction(
  presetId: string,
  targetPlayerId: string,
) {
  try {
    const player = await currentPlayer();
    if (player.id === targetPlayerId)
      throw new Error("Você não pode desafiar a si mesmo.");
    const [preset, target, occupied] = await Promise.all([
      prisma.arenaDraftPreset.findFirst({
        where: { id: presetId, ownerId: player.id, isReady: true },
      }),
      prisma.player.findFirst({
        where: { id: targetPlayerId, active: true },
        select: { id: true },
      }),
      prisma.arenaDraftMatch.findFirst({
        where: {
          OR: [{ playerAId: targetPlayerId }, { playerBId: targetPlayerId }],
          state: { notIn: ["FINISHED", "CANCELLED"] },
        },
      }),
    ]);
    if (!preset) throw new Error("Escolha um preset válido.");
    if (!validateArenaDraftPets(preset.petsJson).valid)
      throw new Error(
        "Este preset precisa ser salvo novamente com 4.500 pontos no time.",
      );
    if (!target) throw new Error("Jogador indisponível.");
    if (occupied) throw new Error("Esse jogador já está em uma sala.");
    const match = await prisma.arenaDraftMatch.create({
      data: {
        playerAId: player.id,
        playerBId: targetPlayerId,
        presetASnapshot: preset.petsJson as Prisma.InputJsonValue,
        state: "CHALLENGE_PENDING",
        deadlineAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    revalidatePath("/combates/arena-draft");
    return {
      success: "Desafio enviado. Ele expira em 10 minutos.",
      matchId: match.id,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível desafiar.",
    };
  }
}

export async function answerDraftChallengeAction(
  matchId: string,
  presetId: string | null,
  accept: boolean,
) {
  try {
    const player = await currentPlayer();
    const match = await prisma.arenaDraftMatch.findFirst({
      where: { id: matchId, playerBId: player.id, state: "CHALLENGE_PENDING" },
    });
    if (!match) throw new Error("Desafio indisponível.");
    if (!accept) {
      await prisma.arenaDraftMatch.update({
        where: { id: match.id },
        data: {
          state: "CANCELLED",
          stateVersion: { increment: 1 },
          deadlineAt: null,
        },
      });
      revalidatePath("/combates/arena-draft");
      return { success: "Desafio recusado." };
    }
    const preset = await prisma.arenaDraftPreset.findFirst({
      where: { id: presetId ?? "", ownerId: player.id, isReady: true },
    });
    if (!preset) throw new Error("Selecione um preset válido para aceitar.");
    if (!validateArenaDraftPets(preset.petsJson).valid)
      throw new Error(
        "Este preset precisa ser ajustado para as regras atuais.",
      );
    await prisma.arenaDraftMatch.update({
      where: { id: match.id },
      data: {
        presetBSnapshot: preset.petsJson as Prisma.InputJsonValue,
        state: "TEAM_REVEAL",
        stateVersion: { increment: 1 },
        deadlineAt: new Date(Date.now() + 30_000),
        draftJson: {
          bansA: [],
          bansB: [],
          picksA: [],
          picksB: [],
          turn: "A",
          phase: "BAN",
        },
      },
    });
    revalidatePath("/combates/arena-draft");
    return { success: "Desafio aceito.", matchId: match.id };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível responder.",
    };
  }
}

type DraftState = {
  bansA: string[];
  bansB: string[];
  picksA: string[];
  picksB: string[];
  turn: "A" | "B";
  phase: "BAN" | "PICK";
};
const pickOrder: Array<"A" | "B"> = [
  "A",
  "B",
  "B",
  "A",
  "A",
  "B",
  "B",
  "A",
  "A",
  "B",
  "B",
  "A",
];
export async function submitArenaDraftAction(
  matchId: string,
  targetId: string,
  idempotencyKey: string,
) {
  try {
    const player = await currentPlayer();
    await prisma.$transaction(async (tx) => {
      const match = await tx.arenaDraftMatch.findUnique({
        where: { id: matchId },
      });
      if (
        !match ||
        (match.playerAId !== player.id && match.playerBId !== player.id)
      )
        throw new Error("Sala não encontrada.");
      const side: "A" | "B" = match.playerAId === player.id ? "A" : "B";
      if (match.state === "TEAM_REVEAL") {
        await tx.arenaDraftMatch.update({
          where: { id: match.id },
          data: {
            state: "BAN_PHASE",
            stateVersion: { increment: 1 },
            deadlineAt: new Date(Date.now() + 90_000),
          },
        });
        return;
      }
      if (match.state !== "BAN_PHASE" && match.state !== "PICK_PHASE")
        throw new Error("A sala não aceita esta ação agora.");
      const draft = match.draftJson as unknown as DraftState;
      if (draft.turn !== side) throw new Error("Aguarde a vez do adversário.");
      const own = (
        match.playerAId === player.id
          ? match.presetASnapshot
          : match.presetBSnapshot
      ) as unknown;
      const rival = (
        match.playerAId === player.id
          ? match.presetBSnapshot
          : match.presetASnapshot
      ) as unknown;
      const ownPets = validateArenaDraftPets(own).pets;
      const rivalPets = validateArenaDraftPets(rival).pets;
      const pool = draft.phase === "BAN" ? rivalPets : ownPets;
      if (!pool.some((p) => p.id === targetId))
        throw new Error("Mascote inválido para esta ação.");
      const allUsed = [
        ...draft.bansA,
        ...draft.bansB,
        ...draft.picksA,
        ...draft.picksB,
      ];
      if (allUsed.includes(targetId))
        throw new Error("Este mascote já foi escolhido ou banido.");
      if (draft.phase === "BAN") {
        (side === "A" ? draft.bansA : draft.bansB).push(targetId);
        const total = draft.bansA.length + draft.bansB.length;
        if (total >= 6) {
          draft.phase = "PICK";
          draft.turn = pickOrder[0];
        } else draft.turn = side === "A" ? "B" : "A";
      } else {
        (side === "A" ? draft.picksA : draft.picksB).push(targetId);
        const total = draft.picksA.length + draft.picksB.length;
        if (total < pickOrder.length) draft.turn = pickOrder[total];
      }
      const totalPicks = draft.picksA.length + draft.picksB.length;
      const nextState =
        draft.phase === "PICK"
          ? totalPicks >= 12
            ? "BATTLE_INIT"
            : "PICK_PHASE"
          : "BAN_PHASE";
      await tx.arenaDraftAction.create({
        data: {
          matchId,
          actorId: player.id,
          idempotencyKey,
          sequence: match.eventSequence + 1,
          phase: draft.phase,
          actionType: match.state === "BAN_PHASE" ? "BAN" : "PICK",
          payloadJson: { targetId },
        },
      });
      await tx.arenaDraftMatch.update({
        where: { id: matchId },
        data: {
          draftJson: draft as unknown as Prisma.InputJsonValue,
          state: nextState,
          stateVersion: { increment: 1 },
          eventSequence: { increment: 1 },
          deadlineAt: new Date(Date.now() + 90_000),
        },
      });
    });
    revalidatePath(`/combates/arena-draft/${matchId}`);
    return { success: "Ação registrada." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Ação recusada." };
  }
}

function draftFighter(
  pet: ReturnType<typeof validateArenaDraftPets>["pets"][number],
  ownerId: string,
): ArenaMascot {
  const bonus = pet.isMega ? 10 : 0;
  const role = pet.posture;
  return {
    id: pet.id,
    ownerId,
    pokemonId: pet.speciesId,
    types: getPokemonTypes(pet.speciesId),
    name: getPokemonName(pet.speciesId),
    level: 100,
    force: pet.stats.force + bonus,
    agility: pet.stats.agility + bonus,
    charisma: pet.stats.charisma + bonus,
    instinct: pet.stats.instinct + bonus,
    vitality: pet.stats.vitality + bonus,
    happiness: 100,
    hp: Math.max(10, Math.round(55 + 600 + (pet.stats.vitality + bonus) * 4)),
    combatRole: role as ArenaMascot["combatRole"],
    personality: pet.personality,
  };
}
function metricsFromLogs(logs: ArenaTurnLog[], fighters: ArenaMascot[]) {
  return fighters.map((f) => {
    const dealt = logs
      .filter((l) => l.actorId === f.id && l.action === "ATTACK")
      .reduce((s, l) => s + l.damage, 0);
    const received = logs
      .filter((l) => l.targetId === f.id && l.action === "ATTACK")
      .reduce((s, l) => s + l.damage, 0);
    const healing = logs
      .filter((l) => l.actorId === f.id && l.action === "HEAL")
      .reduce((s, l) => s + l.damage, 0);
    const kos = new Set(
      logs
        .filter(
          (l) => l.actorId === f.id && l.action === "ATTACK" && l.damage > 0,
        )
        .map((l) => l.targetId),
    );
    return {
      petId: f.id,
      speciesId: f.pokemonId,
      name: f.name,
      damageDealt: dealt,
      damageReceived: received,
      healing,
      kos: kos.size,
      actions: logs.filter((l) => l.actorId === f.id).length,
    };
  });
}
export async function resolveArenaDraftBattleAction(matchId: string) {
  try {
    const player = await currentPlayer();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${matchId}))`;
      const match = await tx.arenaDraftMatch.findUnique({
        where: { id: matchId },
      });
      if (
        !match ||
        !match.playerBId ||
        (match.playerAId !== player.id && match.playerBId !== player.id)
      )
        throw new Error("Partida indisponível.");
      if (match.state === "FINISHED") return;
      if (match.state !== "BATTLE_INIT")
        throw new Error("O draft ainda não terminou.");
      const draft = match.draftJson as unknown as DraftState;
      const petsA = validateArenaDraftPets(match.presetASnapshot).pets;
      const petsB = validateArenaDraftPets(match.presetBSnapshot).pets;
      const idsA = new Set(draft.picksA),
        idsB = new Set(draft.picksB);
      const teamA = petsA
        .filter((p) => idsA.has(p.id))
        .map((p) => draftFighter(p, match.playerAId));
      const teamB = petsB
        .filter((p) => idsB.has(p.id))
        .map((p) => draftFighter(p, match.playerBId!));
      if (teamA.length !== 6 || teamB.length !== 6)
        throw new Error("Formação final inválida.");
      const combat = runArenaCombat(teamA, teamB);
      const winnerId =
        combat.result === "ATTACKER_WIN"
          ? match.playerAId
          : combat.result === "DEFENDER_WIN"
            ? match.playerBId
            : null;
      const metrics = {
        playerA: metricsFromLogs(combat.log, teamA),
        playerB: metricsFromLogs(combat.log, teamB),
        rounds: combat.rounds,
      };
      await tx.arenaDraftMatch.update({
        where: { id: match.id },
        data: {
          state: "FINISHED",
          stateVersion: { increment: 1 },
          winnerId,
          finishedAt: new Date(),
          battleJson: {
            version: 1,
            checkpoints: [20, 35, 45],
            events: combat.log,
            result: combat.result,
            rounds: combat.rounds,
          } as unknown as Prisma.InputJsonValue,
          metricsJson: metrics as unknown as Prisma.InputJsonValue,
          eventSequence: { increment: combat.log.length },
        },
      });
    });
    revalidatePath(`/combates/arena-draft/${matchId}`);
    revalidatePath("/combates/arena-draft");
    return { success: "Combate concluído e replay salvo." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Falha ao iniciar combate.",
    };
  }
}
