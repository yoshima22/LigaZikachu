"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { publicDraftPet, validateArenaDraftPets } from "@/lib/arena-draft";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { sendNotificationToUser } from "@/lib/notifications";
import { MEGA_FORM_IDS } from "@/lib/mega-evolution";
import { CUSTOM_MEGA_POKEMON_IDS } from "@/lib/extra-mega-stones";
import {
  runArenaCombat,
  type ArenaCombatRuntime,
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

export async function searchDraftOpponentsAction(query: string) {
  const player = await currentPlayer();
  const term = query.trim().slice(0, 40);
  if (term.length < 2) return [];
  const players = await prisma.player.findMany({
    where: {
      active: true,
      id: { not: player.id },
      OR: [
        { displayName: { contains: term, mode: "insensitive" } },
        { ptcglNick: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: { displayName: "asc" },
    take: 8,
    select: { id: true, displayName: true, ptcglNick: true },
  });
  return players.map((candidate) => ({
    id: candidate.id,
    name: candidate.displayName,
    nickname: candidate.ptcglNick,
  }));
}

async function disabledMegaIdsInPreset(
  pets: ReturnType<typeof validateArenaDraftPets>["pets"],
) {
  const managedMegaIds = new Set(CUSTOM_MEGA_POKEMON_IDS);
  const ids = [
    ...new Set(
      pets
        .map((pet) => pet.speciesId)
        .filter(
          (speciesId) =>
            MEGA_FORM_IDS.has(speciesId) && managedMegaIds.has(speciesId),
        ),
    ),
  ];
  if (!ids.length) return [];
  const rows = await prisma.eggPokemonToggle.findMany({
    where: { pokemonId: { in: ids }, disabled: true },
    select: { pokemonId: true },
  });
  return rows.map((row) => row.pokemonId);
}

async function assertPresetMegasEnabled(
  pets: ReturnType<typeof validateArenaDraftPets>["pets"],
) {
  const disabled = await disabledMegaIdsInPreset(pets);
  if (disabled.length)
    throw new Error(
      "Este preset contém uma forma Mega que ainda não foi liberada no jogo. Remova-a e salve novamente.",
    );
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
    const disabledMegas = await disabledMegaIdsInPreset(validation.pets);
    const isReady = validation.valid && disabledMegas.length === 0;
    const errors = [
      ...validation.errors,
      ...(disabledMegas.length
        ? ["Remova as formas Mega que ainda não foram liberadas no jogo."]
        : []),
    ];
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
          isReady,
        },
      });
    } else {
      const presetCount = await prisma.arenaDraftPreset.count({
        where: { ownerId: player.id },
      });
      if (presetCount >= 10)
        throw new Error(
          "Você já atingiu o limite de 10 presets. Exclua um para criar outro.",
        );
      await prisma.arenaDraftPreset.create({
        data: {
          ownerId: player.id,
          name,
          petsJson: validation.pets as unknown as Prisma.InputJsonValue,
          isReady,
        },
      });
    }
    revalidatePath("/combates/arena-draft");
    return {
      success: isReady ? "Preset pronto para competir." : "Rascunho salvo.",
      errors,
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

export async function renameDraftPresetAction(id: string, nextName: string) {
  try {
    const player = await currentPlayer();
    const name = nextName.trim().slice(0, 40);
    if (name.length < 3) throw new Error("Use ao menos 3 caracteres no nome.");
    const updated = await prisma.arenaDraftPreset.updateMany({
      where: { id, ownerId: player.id },
      data: { name },
    });
    if (!updated.count) throw new Error("Preset não encontrado.");
    revalidatePath("/combates/arena-draft");
    return { success: "Preset renomeado." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível renomear.",
    };
  }
}

export async function duplicateDraftPresetAction(id: string) {
  try {
    const player = await currentPlayer();
    const preset = await prisma.arenaDraftPreset.findFirst({
      where: { id, ownerId: player.id },
    });
    if (!preset) throw new Error("Preset não encontrado.");
    const presetCount = await prisma.arenaDraftPreset.count({
      where: { ownerId: player.id },
    });
    if (presetCount >= 10)
      throw new Error(
        "Você já atingiu o limite de 10 presets. Exclua um antes de duplicar.",
      );
    await prisma.arenaDraftPreset.create({
      data: {
        ownerId: player.id,
        name: `${preset.name} (cópia)`.slice(0, 40),
        petsJson: preset.petsJson as Prisma.InputJsonValue,
        isReady:
          preset.isReady && validateArenaDraftPets(preset.petsJson).valid,
      },
    });
    revalidatePath("/combates/arena-draft");
    return { success: "Preset duplicado." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível duplicar.",
    };
  }
}

export async function joinDraftQueueAction(presetId: string) {
  try {
    const player = await currentPlayer();
    const preset = await prisma.arenaDraftPreset.findFirst({
      where: { id: presetId, ownerId: player.id },
    });
    if (!preset) throw new Error("Selecione um preset completo e válido.");
    if (!validateArenaDraftPets(preset.petsJson).valid)
      throw new Error(
        "Este preset usa as regras antigas. Abra, ajuste os 4.500 pontos do time e salve novamente.",
      );
    await assertPresetMegasEnabled(
      validateArenaDraftPets(preset.petsJson).pets,
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
            state: "BAN_PHASE",
            stateVersion: { increment: 1 },
            deadlineAt: new Date(Date.now() + 90_000),
            draftJson: {
              readyA: true,
              readyB: true,
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

export async function getDraftQueueStatusAction(matchId: string) {
  try {
    const player = await currentPlayer();
    const match = await prisma.arenaDraftMatch.findFirst({
      where: {
        id: matchId,
        OR: [{ playerAId: player.id }, { playerBId: player.id }],
      },
      select: { state: true, playerBId: true },
    });
    return {
      matched: Boolean(
        match?.playerBId && !["CREATED", "CANCELLED"].includes(match.state),
      ),
      cancelled: match?.state === "CANCELLED",
    };
  } catch {
    return { matched: false, cancelled: false };
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
        where: { id: presetId, ownerId: player.id },
      }),
      prisma.player.findFirst({
        where: { id: targetPlayerId, active: true },
        select: { id: true, userId: true },
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
    await assertPresetMegasEnabled(
      validateArenaDraftPets(preset.petsJson).pets,
    );
    if (!target) throw new Error("Jogador indisponível.");
    if (occupied) throw new Error("Esse jogador já está em uma sala.");
    const recentPair = await prisma.arenaDraftMatch.findFirst({
      where: {
        state: "FINISHED",
        finishedAt: { gte: new Date(Date.now() - 30 * 60_000) },
        OR: [
          { playerAId: player.id, playerBId: targetPlayerId },
          { playerAId: targetPlayerId, playerBId: player.id },
        ],
      },
      select: { id: true },
    });
    if (recentPair)
      throw new Error(
        "Aguarde 30 minutos antes de desafiar novamente este jogador.",
      );
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
    await sendNotificationToUser(target.userId, {
      title: "Novo desafio na Arena Draft",
      body: `${player.displayName} quer enfrentar você. O convite expira em 10 minutos.`,
      url: "/combates/arena-draft",
    }).catch(() => null);
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
      where: { id: presetId ?? "", ownerId: player.id },
    });
    if (!preset) throw new Error("Selecione um preset válido para aceitar.");
    if (!validateArenaDraftPets(preset.petsJson).valid)
      throw new Error(
        "Este preset precisa ser ajustado para as regras atuais.",
      );
    await assertPresetMegasEnabled(
      validateArenaDraftPets(preset.petsJson).pets,
    );
    await prisma.arenaDraftMatch.update({
      where: { id: match.id },
      data: {
        presetBSnapshot: preset.petsJson as Prisma.InputJsonValue,
        state: "TEAM_REVEAL",
        stateVersion: { increment: 1 },
        deadlineAt: new Date(Date.now() + 30_000),
        draftJson: {
          readyA: false,
          readyB: false,
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
  readyA?: boolean;
  readyB?: boolean;
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${matchId}))`;
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
        const draft = match.draftJson as unknown as DraftState;
        if (side === "A" ? draft.readyA : draft.readyB)
          throw new Error("Sua equipe já está confirmada.");
        if (side === "A") draft.readyA = true;
        else draft.readyB = true;
        const bothReady = Boolean(draft.readyA && draft.readyB);
        await tx.arenaDraftAction.create({
          data: {
            matchId: match.id,
            actorId: player.id,
            idempotencyKey,
            sequence: match.eventSequence + 1,
            phase: "TEAM_REVEAL",
            actionType: "READY",
            payloadJson: {},
          },
        });
        await tx.arenaDraftMatch.update({
          where: { id: match.id },
          data: {
            draftJson: draft as unknown as Prisma.InputJsonValue,
            state: bothReady ? "BAN_PHASE" : "TEAM_REVEAL",
            stateVersion: { increment: 1 },
            eventSequence: { increment: 1 },
            deadlineAt: new Date(Date.now() + (bothReady ? 90_000 : 30_000)),
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
          (l) =>
            l.actorId === f.id &&
            l.action === "ATTACK" &&
            l.targetHpAfter === 0,
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

type StrategyPlan = {
  activeIds: string[];
  postures: Record<string, ArenaMascot["combatRole"]>;
  confirmedAt: string;
};
type DraftBattle = {
  version: 2;
  seed?: number;
  checkpoint: number;
  checkpoints: number[];
  eligibleA: string[];
  eligibleB: string[];
  activeA: string[];
  activeB: string[];
  posturesA: Record<string, ArenaMascot["combatRole"]>;
  posturesB: Record<string, ArenaMascot["combatRole"]>;
  plans?: { A?: StrategyPlan; B?: StrategyPlan };
  runtime?: ArenaCombatRuntime;
  events: ArenaTurnLog[];
  strategyHistory: Array<{
    checkpoint: number;
    activeA: string[];
    activeB: string[];
  }>;
  result?: string;
  rounds?: number;
};

const STRATEGY_CHECKPOINTS = [20, 35, 45] as const;
function draftSeed(matchId: string) {
  let hash = 2166136261;
  for (const char of matchId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function postureMap(pets: ReturnType<typeof validateArenaDraftPets>["pets"]) {
  return Object.fromEntries(pets.map((pet) => [pet.id, pet.posture])) as Record<
    string,
    ArenaMascot["combatRole"]
  >;
}
function buildDraftTeam(
  pets: ReturnType<typeof validateArenaDraftPets>["pets"],
  ownerId: string,
  activeIds: string[],
  postures: Record<string, ArenaMascot["combatRole"]>,
) {
  const active = new Set(activeIds);
  return pets
    .filter((pet) => active.has(pet.id))
    .map((pet) =>
      draftFighter(
        { ...pet, posture: postures[pet.id] ?? pet.posture },
        ownerId,
      ),
    );
}

async function persistCombatSegment(
  tx: Prisma.TransactionClient,
  match: {
    id: string;
    playerAId: string;
    playerBId: string | null;
    presetASnapshot: Prisma.JsonValue;
    presetBSnapshot: Prisma.JsonValue | null;
    battleJson: Prisma.JsonValue | null;
  },
  battle: DraftBattle,
) {
  if (!match.playerBId) throw new Error("Adversário ausente.");
  const petsA = validateArenaDraftPets(match.presetASnapshot).pets;
  const petsB = validateArenaDraftPets(match.presetBSnapshot).pets;
  const teamA = buildDraftTeam(
    petsA,
    match.playerAId,
    battle.activeA,
    battle.posturesA,
  );
  const teamB = buildDraftTeam(
    petsB,
    match.playerBId,
    battle.activeB,
    battle.posturesB,
  );
  if (teamA.length !== 6 || teamB.length !== 6)
    throw new Error("Formação final inválida.");
  const stopAtTurn = STRATEGY_CHECKPOINTS[battle.checkpoint] ?? 80;
  const combat = runArenaCombat(teamA, teamB, {
    runtime: battle.runtime,
    stopAtTurn,
    seed: battle.seed,
  });
  battle.runtime = combat.runtime;
  battle.events.push(...combat.log);
  battle.rounds = combat.rounds;
  battle.plans = {};
  if (!combat.finished && battle.checkpoint < STRATEGY_CHECKPOINTS.length) {
    await tx.arenaDraftMatch.update({
      where: { id: match.id },
      data: {
        state: "STRATEGY_WINDOW",
        stateVersion: { increment: 1 },
        deadlineAt: new Date(Date.now() + 180_000),
        battleJson: battle as unknown as Prisma.InputJsonValue,
        eventSequence: { increment: combat.log.length },
      },
    });
    return false;
  }
  battle.result = combat.result;
  const winnerId =
    combat.result === "ATTACKER_WIN"
      ? match.playerAId
      : combat.result === "DEFENDER_WIN"
        ? match.playerBId
        : null;
  const allA = petsA.map((p) =>
    draftFighter(
      { ...p, posture: battle.posturesA[p.id] ?? p.posture },
      match.playerAId,
    ),
  );
  const allB = petsB.map((p) =>
    draftFighter(
      { ...p, posture: battle.posturesB[p.id] ?? p.posture },
      match.playerBId!,
    ),
  );
  await tx.arenaDraftMatch.update({
    where: { id: match.id },
    data: {
      state: "FINISHED",
      stateVersion: { increment: 1 },
      winnerId,
      finishedAt: new Date(),
      deadlineAt: null,
      battleJson: battle as unknown as Prisma.InputJsonValue,
      metricsJson: {
        playerA: metricsFromLogs(battle.events, allA),
        playerB: metricsFromLogs(battle.events, allB),
        rounds: combat.rounds,
      } as unknown as Prisma.InputJsonValue,
      eventSequence: { increment: combat.log.length },
    },
  });
  return true;
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
      const bannedByB = new Set(draft.bansB),
        bannedByA = new Set(draft.bansA);
      const eligibleA = petsA
        .filter((p) => !bannedByB.has(p.id))
        .map((p) => p.id);
      const eligibleB = petsB
        .filter((p) => !bannedByA.has(p.id))
        .map((p) => p.id);
      const battle: DraftBattle = {
        version: 2,
        seed: draftSeed(match.id),
        checkpoint: 0,
        checkpoints: [...STRATEGY_CHECKPOINTS],
        eligibleA,
        eligibleB,
        activeA: draft.picksA,
        activeB: draft.picksB,
        posturesA: postureMap(petsA),
        posturesB: postureMap(petsB),
        plans: {},
        events: [],
        strategyHistory: [],
      };
      await tx.arenaDraftAction.create({
        data: {
          matchId,
          actorId: player.id,
          idempotencyKey: `battle-init:${match.id}`,
          sequence: match.eventSequence + 1,
          phase: "BATTLE_INIT",
          actionType: "BATTLE_STARTED",
          payloadJson: {},
        },
      });
      await tx.arenaDraftMatch.update({
        where: { id: match.id },
        data: { eventSequence: { increment: 1 } },
      });
      await persistCombatSegment(tx, match, battle);
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

export async function submitArenaDraftStrategyAction(input: {
  matchId: string;
  activeIds: string[];
  postures: Record<string, ArenaMascot["combatRole"]>;
}) {
  try {
    const player = await currentPlayer();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.matchId}))`;
      const match = await tx.arenaDraftMatch.findUnique({
        where: { id: input.matchId },
      });
      if (!match || !match.playerBId || match.state !== "STRATEGY_WINDOW")
        throw new Error("A janela estratégica não está aberta.");
      const side =
        match.playerAId === player.id
          ? "A"
          : match.playerBId === player.id
            ? "B"
            : null;
      if (!side) throw new Error("Você não participa desta partida.");
      const battle = match.battleJson as unknown as DraftBattle;
      if (battle.plans?.[side])
        throw new Error("Sua estratégia já foi confirmada.");
      const eligible = side === "A" ? battle.eligibleA : battle.eligibleB;
      const unique = [...new Set(input.activeIds)];
      if (unique.length !== 6 || unique.some((id) => !eligible.includes(id)))
        throw new Error("Escolha exatamente 6 mascotes válidos.");
      const dead = new Set(
        Object.entries(battle.runtime?.hp ?? {})
          .filter(([, hp]) => hp <= 0)
          .map(([id]) => id),
      );
      const currentlyActive = new Set(
        side === "A" ? battle.activeA : battle.activeB,
      );
      if (unique.some((id) => dead.has(id) && !currentlyActive.has(id)))
        throw new Error(
          "Mascotes derrotados não podem voltar do banco ao campo.",
        );
      const validRoles = new Set([
        "DEFENDER",
        "ATTACKER",
        "FLANK",
        "OPPORTUNIST",
        "ENCOURAGER",
        "GUARDIAN",
        "DUELIST",
        "SABOTEUR",
        "HEALER",
        "SCOUT",
        "PROVOKER",
        "SPECIALIST",
        "SURVIVOR",
      ]);
      const postures = Object.fromEntries(
        eligible.map((id) => {
          const role = input.postures[id];
          if (!validRoles.has(role)) throw new Error("Postura inválida.");
          return [id, role];
        }),
      ) as Record<string, ArenaMascot["combatRole"]>;
      battle.plans = {
        ...(battle.plans ?? {}),
        [side]: {
          activeIds: unique,
          postures,
          confirmedAt: new Date().toISOString(),
        },
      };
      await tx.arenaDraftAction.create({
        data: {
          matchId: match.id,
          actorId: player.id,
          idempotencyKey: `strategy:${match.id}:${battle.checkpoint}:${player.id}`,
          sequence: match.eventSequence + 1,
          phase: "STRATEGY_WINDOW",
          actionType: "STRATEGY_LOCKED",
          payloadJson: { checkpoint: STRATEGY_CHECKPOINTS[battle.checkpoint] },
        },
      });
      await tx.arenaDraftMatch.update({
        where: { id: match.id },
        data: { eventSequence: { increment: 1 } },
      });
      if (!battle.plans.A || !battle.plans.B) {
        await tx.arenaDraftMatch.update({
          where: { id: match.id },
          data: {
            battleJson: battle as unknown as Prisma.InputJsonValue,
            stateVersion: { increment: 1 },
          },
        });
        return;
      }
      battle.activeA = battle.plans.A.activeIds;
      battle.activeB = battle.plans.B.activeIds;
      battle.posturesA = battle.plans.A.postures;
      battle.posturesB = battle.plans.B.postures;
      battle.strategyHistory.push({
        checkpoint: STRATEGY_CHECKPOINTS[battle.checkpoint],
        activeA: battle.activeA,
        activeB: battle.activeB,
      });
      battle.checkpoint += 1;
      await persistCombatSegment(tx, match, battle);
    });
    revalidatePath(`/combates/arena-draft/${input.matchId}`);
    revalidatePath("/combates/arena-draft");
    return { success: "Estratégia confirmada em segredo." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Estratégia recusada.",
    };
  }
}

/** Resolve apenas quando o prazo já venceu. As escolhas ausentes mantêm a
 * formação e as posturas atuais, portanto uma queda de conexão não inventa
 * trocas nem revela informação privada. */
export async function advanceArenaDraftTimeoutAction(matchId: string) {
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
        return;
      if (!match.deadlineAt || match.deadlineAt.getTime() > Date.now()) return;
      if (match.state === "TEAM_REVEAL") {
        const draft = match.draftJson as unknown as DraftState;
        draft.readyA = true;
        draft.readyB = true;
        await tx.arenaDraftMatch.update({
          where: { id: match.id },
          data: {
            draftJson: draft as unknown as Prisma.InputJsonValue,
            state: "BAN_PHASE",
            stateVersion: { increment: 1 },
            deadlineAt: new Date(Date.now() + 90_000),
          },
        });
        return;
      }
      if (match.state === "BAN_PHASE" || match.state === "PICK_PHASE") {
        const draft = match.draftJson as unknown as DraftState;
        const side = draft.turn;
        const own = validateArenaDraftPets(
          side === "A" ? match.presetASnapshot : match.presetBSnapshot,
        ).pets;
        const rival = validateArenaDraftPets(
          side === "A" ? match.presetBSnapshot : match.presetASnapshot,
        ).pets;
        const used = new Set([
          ...draft.bansA,
          ...draft.bansB,
          ...draft.picksA,
          ...draft.picksB,
        ]);
        const pool = (draft.phase === "BAN" ? rival : own).filter(
          (pet) => !used.has(pet.id),
        );
        const target = pool[0];
        if (!target) throw new Error("Não há escolha automática válida.");
        if (draft.phase === "BAN") {
          (side === "A" ? draft.bansA : draft.bansB).push(target.id);
          const total = draft.bansA.length + draft.bansB.length;
          if (total >= 6) {
            draft.phase = "PICK";
            draft.turn = pickOrder[0];
          } else draft.turn = side === "A" ? "B" : "A";
        } else {
          (side === "A" ? draft.picksA : draft.picksB).push(target.id);
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
            actorId: side === "A" ? match.playerAId : match.playerBId,
            idempotencyKey: `timeout:${match.id}:${match.eventSequence + 1}`,
            sequence: match.eventSequence + 1,
            phase: draft.phase,
            actionType: "TIMEOUT_AUTO",
            payloadJson: { targetId: target.id },
          },
        });
        await tx.arenaDraftMatch.update({
          where: { id: match.id },
          data: {
            draftJson: draft as unknown as Prisma.InputJsonValue,
            state: nextState,
            stateVersion: { increment: 1 },
            eventSequence: { increment: 1 },
            deadlineAt:
              nextState === "BATTLE_INIT"
                ? null
                : new Date(Date.now() + 90_000),
          },
        });
        return;
      }
      if (match.state !== "STRATEGY_WINDOW") return;
      const battle = match.battleJson as unknown as DraftBattle;
      battle.plans = battle.plans ?? {};
      battle.plans.A ??= {
        activeIds: battle.activeA,
        postures: battle.posturesA,
        confirmedAt: match.deadlineAt.toISOString(),
      };
      battle.plans.B ??= {
        activeIds: battle.activeB,
        postures: battle.posturesB,
        confirmedAt: match.deadlineAt.toISOString(),
      };
      battle.activeA = battle.plans.A.activeIds;
      battle.activeB = battle.plans.B.activeIds;
      battle.posturesA = battle.plans.A.postures;
      battle.posturesB = battle.plans.B.postures;
      battle.strategyHistory.push({
        checkpoint: STRATEGY_CHECKPOINTS[battle.checkpoint],
        activeA: battle.activeA,
        activeB: battle.activeB,
      });
      battle.checkpoint += 1;
      await persistCombatSegment(tx, match, battle);
    });
    revalidatePath(`/combates/arena-draft/${matchId}`);
    return { success: true };
  } catch {
    return { success: false };
  }
}

export async function heartbeatArenaDraftAction(matchId: string) {
  try {
    const player = await currentPlayer();
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${matchId}))`;
      const match = await tx.arenaDraftMatch.findUnique({
        where: { id: matchId },
        include: { presences: true },
      });
      if (
        !match ||
        !match.playerBId ||
        (match.playerAId !== player.id && match.playerBId !== player.id) ||
        ["FINISHED", "CANCELLED"].includes(match.state)
      )
        return { active: false, opponentOnline: false };
      const now = new Date();
      await tx.arenaDraftPresence.upsert({
        where: { matchId_playerId: { matchId, playerId: player.id } },
        update: { lastSeenAt: now },
        create: { matchId, playerId: player.id, lastSeenAt: now },
      });
      const opponentId =
        match.playerAId === player.id ? match.playerBId : match.playerAId;
      const opponentPresence = match.presences.find(
        (presence) => presence.playerId === opponentId,
      );
      const reference = opponentPresence?.lastSeenAt ?? match.updatedAt;
      const battleStarted =
        [
          "BATTLE_INIT",
          "BATTLE_RUNNING",
          "STRATEGY_WINDOW",
          "STRATEGY_RESOLVING",
        ].includes(match.state) || Boolean(match.battleJson);
      const toleranceMs = battleStarted ? 90_000 : 5 * 60_000;
      const absentMs = now.getTime() - reference.getTime();
      if (absentMs <= toleranceMs)
        return {
          active: true,
          opponentOnline: Boolean(opponentPresence && absentMs <= 45_000),
          graceSeconds: Math.max(0, Math.ceil((toleranceMs - absentMs) / 1000)),
        };
      const nextSequence = match.eventSequence + 1;
      await tx.arenaDraftAction.create({
        data: {
          matchId,
          actorId: player.id,
          idempotencyKey: `disconnect:${match.id}:${opponentId}`,
          sequence: nextSequence,
          phase: match.state,
          actionType: battleStarted ? "TECHNICAL_FORFEIT" : "DISCONNECT_CANCEL",
          payloadJson: {
            absentPlayerId: opponentId,
            toleranceSeconds: toleranceMs / 1000,
          },
        },
      });
      if (battleStarted) {
        const battle = (match.battleJson ?? {}) as Record<string, unknown>;
        battle.result = "TECHNICAL_FORFEIT";
        battle.forfeitPlayerId = opponentId;
        await tx.arenaDraftMatch.update({
          where: { id: match.id },
          data: {
            state: "FINISHED",
            winnerId: player.id,
            finishedAt: now,
            deadlineAt: null,
            battleJson: battle as Prisma.InputJsonValue,
            stateVersion: { increment: 1 },
            eventSequence: { increment: 1 },
          },
        });
      } else
        await tx.arenaDraftMatch.update({
          where: { id: match.id },
          data: {
            state: "CANCELLED",
            deadlineAt: null,
            stateVersion: { increment: 1 },
            eventSequence: { increment: 1 },
          },
        });
      return { active: false, opponentOnline: false, resolved: true };
    });
  } catch {
    return { active: false, opponentOnline: false };
  }
}
