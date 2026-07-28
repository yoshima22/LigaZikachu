"use server";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getPokemonName, getPokemonTypes } from "@/lib/mascot-data";
import { getPreferredSpriteUrl } from "@/lib/sprite-preferences";
import {
  getLegalMovesWithRecommendation,
  type LivePvpMove,
} from "@/lib/live-pvp-moves";
import { resolveLivePvpTurn, type LivePvpFighter } from "@/lib/live-pvp-engine";
import {
  canAccessLivePvp,
  getLivePvpAccessConfig,
} from "@/lib/live-pvp-access";

const QUEUE_PREFIX = "live_pvp_queue:";
const MATCH_PREFIX = "live_pvp_match:";
const PLAYER_MATCH_PREFIX = "live_pvp_player_match:";
const ACTIVE_WINDOW_MS = 90_000;

type QueueValue = {
  playerId: string;
  playerName: string;
  targetPlayerId: string | null;
  joinedAt: string;
};

export type LivePvpMatchValue = {
  id: string;
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  coinChooserId: string;
  coinResult: "CARA" | "COROA";
  coinChoice: "CARA" | "COROA" | null;
  coinWinnerId: string | null;
  firstPickerId: string | null;
  draftTurnId: string | null;
  draftQuota: number;
  teamAIds: string[];
  teamBIds: string[];
  orderAIds: string[];
  orderBIds: string[];
  orderTurnId: string | null;
  phase: "COIN_PICK" | "FIRST_PICK" | "DRAFT" | "ORDER" | "READY";
  deadline: string;
  revision: number;
  events: string[];
  battle: LivePvpBattleState | null;
  status: "PREGAME" | "FINISHED";
  createdAt: string;
};

export type LivePvpBattleAction =
  | { type: "MOVE"; moveId: number }
  | { type: "SWITCH"; mascotId: string };
export type LivePvpBattleState = {
  teamA: LivePvpFighter[];
  teamB: LivePvpFighter[];
  activeAId: string;
  activeBId: string;
  moves: Record<string, LivePvpMove[]>;
  pp: Record<string, Record<number, number>>;
  pendingA: LivePvpBattleAction | null;
  pendingB: LivePvpBattleAction | null;
  lastMoveAId?: number | null;
  lastMoveBId?: number | null;
  lastMoveAActorId?: string | null;
  lastMoveBActorId?: string | null;
  deadline: string;
  choiceTurnId: string;
  roundStarterId: string;
  winnerId: string | null;
  round: number;
  logs: string[];
};

type MatchValue = LivePvpMatchValue;

const nextDeadline = () => new Date(Date.now() + 30_000).toISOString();
function normalizeMatch(raw: Partial<MatchValue>): MatchValue {
  const match = {
    coinChoice: null,
    coinWinnerId: null,
    firstPickerId: null,
    draftTurnId: null,
    draftQuota: 1,
    teamAIds: [],
    teamBIds: [],
    orderAIds: [],
    orderBIds: [],
    orderTurnId: null,
    phase: "COIN_PICK",
    deadline: nextDeadline(),
    revision: 1,
    events: [],
    battle: null,
    ...raw,
  } as MatchValue;
  if (match.battle && !match.battle.deadline)
    match.battle.deadline = nextDeadline();
  return match;
}

function fighterFromMascot(mascot: {
  id: string;
  pokemonId: number;
  nickname: string | null;
  level: number;
  statForce: number;
  statAgility: number;
  statCharisma: number;
  statInstinct: number;
  statVitality: number;
}) {
  const maxHp = Math.max(
    10,
    Math.round(55 + mascot.level * 6 + mascot.statVitality * 4),
  );
  return {
    id: mascot.id,
    pokemonId: mascot.pokemonId,
    spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${mascot.pokemonId}.gif`,
    name: mascot.nickname ?? getPokemonName(mascot.pokemonId),
    level: mascot.level,
    types: getPokemonTypes(mascot.pokemonId),
    hp: maxHp,
    maxHp,
    force: mascot.statForce,
    agility: mascot.statAgility,
    charisma: mascot.statCharisma,
    instinct: mascot.statInstinct,
    vitality: mascot.statVitality,
  } satisfies LivePvpFighter;
}
const otherPlayerId = (match: MatchValue, playerId: string) =>
  playerId === match.playerAId ? match.playerBId : match.playerAId;
const sideTeam = (match: MatchValue, playerId: string) =>
  playerId === match.playerAId ? match.teamAIds : match.teamBIds;

async function findCurrentMatch(
  tx: Prisma.TransactionClient,
  playerId: string,
) {
  const index = await tx.appSetting.findUnique({
    where: { key: `${PLAYER_MATCH_PREFIX}${playerId}` },
    select: { value: true },
  });
  const matchId = (index?.value as { matchId?: string } | undefined)?.matchId;
  if (!matchId) throw new Error("Partida ativa não encontrada.");
  const row = await tx.appSetting.findUnique({
    where: { key: `${MATCH_PREFIX}${matchId}` },
    select: { value: true },
  });
  const match = row?.value
    ? normalizeMatch(row.value as Partial<MatchValue>)
    : undefined;
  if (!match || ![match.playerAId, match.playerBId].includes(playerId))
    throw new Error("Partida inválida.");
  return match;
}

async function saveMatch(tx: Prisma.TransactionClient, match: MatchValue) {
  match.revision += 1;
  await tx.appSetting.update({
    where: { key: `${MATCH_PREFIX}${match.id}` },
    data: { value: match as unknown as Prisma.InputJsonValue },
  });
}

async function applyPregameTimeout(
  tx: Prisma.TransactionClient,
  match: MatchValue,
) {
  if (
    new Date(match.deadline).getTime() > Date.now() ||
    match.phase === "READY"
  )
    return false;
  if (match.phase === "COIN_PICK") {
    match.coinChoice = Math.random() < 0.5 ? "CARA" : "COROA";
    match.coinWinnerId =
      match.coinChoice === match.coinResult
        ? match.coinChooserId
        : otherPlayerId(match, match.coinChooserId);
    match.phase = "FIRST_PICK";
    match.events.push(
      "O tempo da moeda acabou; o servidor escolheu automaticamente.",
    );
  } else if (match.phase === "FIRST_PICK") {
    match.firstPickerId =
      Math.random() < 0.5 ? match.playerAId : match.playerBId;
    match.draftTurnId = match.firstPickerId;
    match.draftQuota = 1;
    match.phase = "DRAFT";
    match.events.push(
      "O servidor sorteou quem inicia o draft por tempo esgotado.",
    );
  } else if (match.phase === "DRAFT" && match.draftTurnId) {
    const playerId = match.draftTurnId;
    const team = sideTeam(match, playerId);
    const required = Math.min(match.draftQuota, 6 - team.length);
    const automatic = await tx.mascot.findMany({
      where: { playerId, id: { notIn: team } },
      orderBy: [{ level: "desc" }, { id: "asc" }],
      take: required,
      select: { id: true },
    });
    if (automatic.length !== required)
      throw new Error(
        "O jogador não possui mascotes suficientes para completar o draft.",
      );
    const nextTeam = [...team, ...automatic.map((mascot) => mascot.id)];
    if (playerId === match.playerAId) match.teamAIds = nextTeam;
    else match.teamBIds = nextTeam;
    if (match.teamAIds.length === 6 && match.teamBIds.length === 6) {
      match.phase = "ORDER";
      match.orderTurnId = match.firstPickerId;
      match.draftTurnId = null;
    } else {
      const next = otherPlayerId(match, playerId);
      match.draftTurnId = next;
      match.draftQuota = Math.min(2, 6 - sideTeam(match, next).length);
    }
    match.events.push(
      "O servidor completou a escolha do draft por tempo esgotado.",
    );
  } else if (match.phase === "ORDER" && match.orderTurnId) {
    const playerId = match.orderTurnId;
    const team = [...sideTeam(match, playerId)];
    if (playerId === match.playerAId) match.orderAIds = team;
    else match.orderBIds = team;
    const other = otherPlayerId(match, playerId);
    const otherOrder =
      other === match.playerAId ? match.orderAIds : match.orderBIds;
    if (otherOrder.length === 6) {
      match.phase = "READY";
      match.orderTurnId = null;
    } else match.orderTurnId = other;
    match.events.push("O servidor manteve a ordem padrão por tempo esgotado.");
  }
  match.deadline = nextDeadline();
  await saveMatch(tx, match);
  return true;
}

async function requireLivePvpPlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Sessão inválida.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  const config = await getLivePvpAccessConfig();
  if (!canAccessLivePvp(config, player.id, isAdmin(user.role)))
    throw new Error("Arena Online ainda não foi liberada para esta conta.");
  return player;
}

async function requireAuthenticatedPlayer() {
  const user = await getSessionUser();
  if (!user) throw new Error("Sessão inválida.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  return player;
}

function asQueue(value: Prisma.JsonValue): QueueValue | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  return typeof data.playerId === "string" &&
    typeof data.playerName === "string"
    ? (data as QueueValue)
    : null;
}

export async function getLivePvpLobbyAction() {
  const player = await requireLivePvpPlayer();
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);
  let [queue, matchIndex] = await Promise.all([
    prisma.appSetting.findMany({
      where: { key: { startsWith: QUEUE_PREFIX }, updatedAt: { gte: cutoff } },
      select: { key: true, value: true },
    }),
    prisma.appSetting.findUnique({
      where: { key: `${PLAYER_MATCH_PREFIX}${player.id}` },
      select: { value: true },
    }),
  ]);
  const ownQueue = queue.find(
    (entry) => entry.key === `${QUEUE_PREFIX}${player.id}`,
  );
  if (ownQueue) {
    await prisma.appSetting.update({
      where: { key: ownQueue.key },
      data: { value: ownQueue.value as Prisma.InputJsonValue },
    });
    queue = queue.map((entry) =>
      entry.key === ownQueue.key ? { ...entry } : entry,
    );
  }
  const index = matchIndex?.value as { matchId?: string } | undefined;
  const match = index?.matchId
    ? await prisma.appSetting.findUnique({
        where: { key: `${MATCH_PREFIX}${index.matchId}` },
        select: { value: true },
      })
    : null;
  return {
    queueCount: queue.length,
    queued: queue.some((entry) => entry.key === `${QUEUE_PREFIX}${player.id}`),
    match: match?.value
      ? normalizeMatch(match.value as Partial<MatchValue>)
      : null,
  };
}

export async function getLivePvpMatchAction(includeMascots = true) {
  const player = await requireLivePvpPlayer();
  let match = await prisma.$transaction((tx) =>
    findCurrentMatch(tx, player.id),
  );
  if (!match.battle) {
    match = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
      const current = await findCurrentMatch(tx, player.id);
      await applyPregameTimeout(tx, current);
      return current;
    });
  }
  const selectedIds = [
    ...match.teamAIds,
    ...match.teamBIds,
    ...match.orderAIds,
    ...match.orderBIds,
  ];
  const selectedMascots =
    includeMascots && selectedIds.length
      ? await prisma.mascot.findMany({
          where: { id: { in: [...new Set(selectedIds)] } },
          select: {
            id: true,
            nickname: true,
            pokemonId: true,
            level: true,
            statForce: true,
            statAgility: true,
            statCharisma: true,
            statInstinct: true,
            statVitality: true,
            performanceTag: true,
            playerId: true,
            isShiny: true,
            player: {
              select: {
                displayName: true,
                avatarUrl: true,
                mascotSpritePreference: true,
                megaSpritePreference: true,
              },
            },
          },
        })
      : [];
  const participants = await prisma.player.findMany({
    where: { id: { in: [match.playerAId, match.playerBId] } },
    select: { id: true, displayName: true },
  });
  match.playerAName =
    participants.find((entry) => entry.id === match.playerAId)?.displayName ??
    match.playerAName;
  match.playerBName =
    participants.find((entry) => entry.id === match.playerBId)?.displayName ??
    match.playerBName;
  const responseMatch = structuredClone(match);
  if (!includeMascots && responseMatch.battle) {
    const activeIds = [
      responseMatch.battle.activeAId,
      responseMatch.battle.activeBId,
    ];
    responseMatch.battle.moves = {
      ...Object.fromEntries(
        activeIds.map((id) => [id, responseMatch.battle!.moves[id] ?? []]),
      ),
    };
    responseMatch.battle.pp = {
      ...Object.fromEntries(
        activeIds.map((id) => [id, responseMatch.battle!.pp[id] ?? {}]),
      ),
    };
  }
  return {
    match: responseMatch,
    viewerId: player.id,
    selectedMascots: selectedMascots.map((mascot) => ({
      id: mascot.id,
      pokemonId: mascot.pokemonId,
      name: mascot.nickname ?? getPokemonName(mascot.pokemonId),
      ownerName: mascot.player.displayName,
      ownerAvatarUrl: mascot.player.avatarUrl,
      performanceTag: mascot.performanceTag,
      gameStatus: "Selecionado",
      level: mascot.level,
      types: getPokemonTypes(mascot.pokemonId),
      spriteUrl: getPreferredSpriteUrl(mascot.pokemonId, mascot.player, {
        shiny: mascot.isShiny,
      }),
      statForce: mascot.statForce,
      statAgility: mascot.statAgility,
      statCharisma: mascot.statCharisma,
      statInstinct: mascot.statInstinct,
      statVitality: mascot.statVitality,
    })),
  };
}

export async function chooseLivePvpCoinAction(choice: "CARA" | "COROA") {
  const player = await requireLivePvpPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    if (match.phase !== "COIN_PICK" || match.coinChooserId !== player.id)
      throw new Error("A escolha da moeda pertence ao outro jogador.");
    match.coinChoice = choice;
    match.coinWinnerId =
      choice === match.coinResult ? player.id : otherPlayerId(match, player.id);
    match.phase = "FIRST_PICK";
    match.deadline = nextDeadline();
    match.events.push(
      `${player.displayName} escolheu ${choice}. O resultado foi ${match.coinResult}.`,
    );
    await saveMatch(tx, match);
    return match;
  });
}

export async function chooseLivePvpFirstPlayerAction(firstPlayerId: string) {
  const player = await requireLivePvpPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    if (match.phase !== "FIRST_PICK" || match.coinWinnerId !== player.id)
      throw new Error("Somente quem venceu a moeda pode escolher.");
    if (![match.playerAId, match.playerBId].includes(firstPlayerId))
      throw new Error("Jogador inicial inválido.");
    match.firstPickerId = firstPlayerId;
    match.draftTurnId = firstPlayerId;
    match.draftQuota = 1;
    match.phase = "DRAFT";
    match.deadline = nextDeadline();
    const firstName =
      firstPlayerId === match.playerAId ? match.playerAName : match.playerBName;
    match.events.push(
      `${player.displayName} escolheu ${firstName} para iniciar o draft.`,
    );
    await saveMatch(tx, match);
    return match;
  });
}

export async function submitLivePvpDraftAction(mascotIds: string[]) {
  const player = await requireLivePvpPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    if (match.phase !== "DRAFT" || match.draftTurnId !== player.id)
      throw new Error("Aguarde a vez do adversário.");
    const team = sideTeam(match, player.id);
    const required = Math.min(match.draftQuota, 6 - team.length);
    const uniqueIds = [...new Set(mascotIds)];
    if (uniqueIds.length !== required)
      throw new Error(`Selecione exatamente ${required} mascote(s).`);
    const valid = await tx.mascot.count({
      where: { id: { in: uniqueIds }, playerId: player.id },
    });
    if (valid !== uniqueIds.length || uniqueIds.some((id) => team.includes(id)))
      throw new Error(
        "Uma das escolhas não pertence à sua conta ou já foi usada.",
      );
    const nextTeam = [...team, ...uniqueIds];
    if (player.id === match.playerAId) match.teamAIds = nextTeam;
    else match.teamBIds = nextTeam;
    const names = await tx.mascot.findMany({
      where: { id: { in: uniqueIds } },
      select: { nickname: true, pokemonId: true },
    });
    match.events.push(
      `${player.displayName} confirmou ${names.map((mascot) => mascot.nickname ?? `#${mascot.pokemonId}`).join(", ")}.`,
    );
    if (match.teamAIds.length === 6 && match.teamBIds.length === 6) {
      match.phase = "ORDER";
      match.orderTurnId = match.firstPickerId;
      match.draftTurnId = null;
    } else {
      const next = otherPlayerId(match, player.id);
      match.draftTurnId = next;
      match.draftQuota = Math.min(2, 6 - sideTeam(match, next).length);
    }
    match.deadline = nextDeadline();
    await saveMatch(tx, match);
    return match;
  });
}

export async function submitLivePvpOrderAction(order: string[]) {
  const player = await requireLivePvpPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    if (match.phase !== "ORDER" || match.orderTurnId !== player.id)
      throw new Error("Aguarde o adversário organizar a equipe.");
    const team = sideTeam(match, player.id);
    if (
      order.length !== 6 ||
      new Set(order).size !== 6 ||
      order.some((id) => !team.includes(id))
    )
      throw new Error("A ordem precisa conter os seis mascotes escolhidos.");
    if (player.id === match.playerAId) match.orderAIds = order;
    else match.orderBIds = order;
    match.events.push(`${player.displayName} travou a ordem da equipe.`);
    const other = otherPlayerId(match, player.id);
    const otherOrder =
      other === match.playerAId ? match.orderAIds : match.orderBIds;
    if (otherOrder.length === 6) {
      match.phase = "READY";
      match.orderTurnId = null;
    } else match.orderTurnId = other;
    match.deadline = nextDeadline();
    await saveMatch(tx, match);
    return match;
  });
}

export async function leaveLivePvpQueueAction() {
  const player = await requireLivePvpPlayer();
  await prisma.appSetting.deleteMany({
    where: { key: `${QUEUE_PREFIX}${player.id}` },
  });
  return getLivePvpLobbyAction();
}

export async function initializeLivePvpBattleAction() {
  const player = await requireLivePvpPlayer();
  const current = await prisma.$transaction((tx) =>
    findCurrentMatch(tx, player.id),
  );
  if (current.phase !== "READY") throw new Error("O draft ainda não terminou.");
  if (current.battle) return current;
  const ids = [...current.orderAIds, ...current.orderBIds];
  const mascots = await prisma.mascot.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      pokemonId: true,
      nickname: true,
      level: true,
      statForce: true,
      statAgility: true,
      statCharisma: true,
      statInstinct: true,
      statVitality: true,
    },
  });
  const byId = new Map(mascots.map((mascot) => [mascot.id, mascot]));
  if (mascots.length !== 12)
    throw new Error("Não foi possível montar as duas equipes completas.");
  const loaded = await Promise.all(
    mascots.map(async (mascot) => {
      const result = await getLegalMovesWithRecommendation(
        mascot.pokemonId,
        mascot.level,
      );
      return [mascot.id, result.recommended] as const;
    }),
  );
  const moves = Object.fromEntries(loaded);
  const pp = Object.fromEntries(
    loaded.map(([id, list]) => [
      id,
      Object.fromEntries(list.map((move) => [move.id, move.pp])),
    ]),
  );
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    if (match.battle) return match;
    const teamA = match.orderAIds.map((id) => fighterFromMascot(byId.get(id)!));
    const teamB = match.orderBIds.map((id) => fighterFromMascot(byId.get(id)!));
    const starter = match.firstPickerId ?? match.playerAId;
    match.battle = {
      teamA,
      teamB,
      activeAId: teamA[0].id,
      activeBId: teamB[0].id,
      moves,
      pp,
      pendingA: null,
      pendingB: null,
      deadline: nextDeadline(),
      choiceTurnId: starter,
      roundStarterId: starter,
      winnerId: null,
      round: 1,
      logs: [
        `A batalha entre ${match.playerAName} e ${match.playerBName} começou.`,
      ],
    };
    await saveMatch(tx, match);
    return match;
  });
}

export async function submitLivePvpBattleAction(action: LivePvpBattleAction) {
  const player = await requireLivePvpPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    const battle = match.battle;
    if (!battle || battle.winnerId)
      throw new Error("A batalha não está aceitando ações.");
    const sideA = player.id === match.playerAId;
    if (sideA ? battle.pendingA : battle.pendingB)
      throw new Error("Sua ação desta rodada já foi confirmada.");
    const team = sideA ? battle.teamA : battle.teamB;
    const activeId = sideA ? battle.activeAId : battle.activeBId;
    if (action.type === "MOVE") {
      const move = battle.moves[activeId]?.find(
        (entry) => entry.id === action.moveId,
      );
      if (!move || (battle.pp[activeId]?.[move.id] ?? 0) <= 0)
        throw new Error("Golpe indisponível.");
    } else {
      const target = team.find((entry) => entry.id === action.mascotId);
      if (!target || target.hp <= 0 || target.id === activeId)
        throw new Error("Troca inválida.");
    }
    if (sideA) battle.pendingA = action;
    else battle.pendingB = action;
    if (!battle.pendingA || !battle.pendingB) {
      battle.logs.push(`${player.displayName} confirmou uma ação.`);
      await saveMatch(tx, match);
      return { ok: true };
    }
    const actionA = battle.pendingA;
    const actionB = battle.pendingB;
    if (actionA.type === "SWITCH") battle.activeAId = actionA.mascotId;
    if (actionB.type === "SWITCH") battle.activeBId = actionB.mascotId;
    let fighterA = battle.teamA.find((entry) => entry.id === battle.activeAId)!;
    let fighterB = battle.teamB.find((entry) => entry.id === battle.activeBId)!;
    const moveA =
      actionA.type === "MOVE"
        ? (battle.moves[fighterA.id].find(
            (move) => move.id === actionA.moveId,
          ) ?? null)
        : null;
    const moveB =
      actionB.type === "MOVE"
        ? (battle.moves[fighterB.id].find(
            (move) => move.id === actionB.moveId,
          ) ?? null)
        : null;
    battle.lastMoveAId = moveA?.id ?? null;
    battle.lastMoveBId = moveB?.id ?? null;
    battle.lastMoveAActorId = moveA ? fighterA.id : null;
    battle.lastMoveBActorId = moveB ? fighterB.id : null;
    if (moveA) battle.pp[fighterA.id][moveA.id] -= 1;
    if (moveB) battle.pp[fighterB.id][moveB.id] -= 1;
    const result = resolveLivePvpTurn(fighterA, moveA, fighterB, moveB);
    battle.teamA = battle.teamA.map((entry) =>
      entry.id === result.fighterA.id ? result.fighterA : entry,
    );
    battle.teamB = battle.teamB.map((entry) =>
      entry.id === result.fighterB.id ? result.fighterB : entry,
    );
    fighterA = result.fighterA;
    fighterB = result.fighterB;
    if (fighterA.hp <= 0)
      battle.activeAId =
        battle.teamA.find((entry) => entry.hp > 0)?.id ?? battle.activeAId;
    if (fighterB.hp <= 0)
      battle.activeBId =
        battle.teamB.find((entry) => entry.hp > 0)?.id ?? battle.activeBId;
    const aliveA = battle.teamA.some((entry) => entry.hp > 0),
      aliveB = battle.teamB.some((entry) => entry.hp > 0);
    if (!aliveA || !aliveB)
      battle.winnerId = aliveA ? match.playerAId : match.playerBId;
    battle.logs.push(...result.events);
    battle.pendingA = null;
    battle.pendingB = null;
    battle.round += 1;
    battle.deadline = nextDeadline();
    battle.roundStarterId = otherPlayerId(match, battle.roundStarterId);
    battle.choiceTurnId = battle.roundStarterId;
    await saveMatch(tx, match);
    return { ok: true };
  });
}

export async function surrenderLivePvpBattleAction() {
  const player = await requireAuthenticatedPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    if (!match.battle || match.battle.winnerId)
      throw new Error("A batalha já terminou.");
    match.battle.winnerId = otherPlayerId(match, player.id);
    match.battle.logs.push(`${player.displayName} desistiu da batalha.`);
    await saveMatch(tx, match);
    return { ok: true };
  });
}

export async function closeLivePvpMatchAction() {
  const player = await requireAuthenticatedPlayer();
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const indexRow = await tx.appSetting.findUnique({
      where: { key: `${PLAYER_MATCH_PREFIX}${player.id}` },
      select: { value: true },
    });
    const matchId = (indexRow?.value as { matchId?: string } | undefined)
      ?.matchId;
    if (!matchId) return;
    const matchRow = await tx.appSetting.findUnique({
      where: { key: `${MATCH_PREFIX}${matchId}` },
      select: { value: true },
    });
    const match = matchRow?.value as MatchValue | undefined;
    if (!match || ![match.playerAId, match.playerBId].includes(player.id))
      return;
    await tx.appSetting.delete({
      where: { key: `${PLAYER_MATCH_PREFIX}${player.id}` },
    });
    const otherId = otherPlayerId(match, player.id);
    const otherIndex = await tx.appSetting.findUnique({
      where: { key: `${PLAYER_MATCH_PREFIX}${otherId}` },
      select: { key: true },
    });
    if (!otherIndex)
      await tx.appSetting.deleteMany({
        where: { key: `${MATCH_PREFIX}${matchId}` },
      });
  });
  return { ok: true };
}

export async function joinLivePvpQueueAction(targetName?: string) {
  const player = await requireLivePvpPlayer();
  const target = targetName?.trim()
    ? await prisma.player.findFirst({
        where: {
          id: { not: player.id },
          active: true,
          user: { status: "ACTIVE" },
          OR: [
            { displayName: { equals: targetName.trim(), mode: "insensitive" } },
            { ptcglNick: { equals: targetName.trim(), mode: "insensitive" } },
          ],
        },
        select: { id: true, displayName: true, ptcglNick: true },
      })
    : null;
  if (targetName?.trim() && !target)
    throw new Error("Jogador não encontrado pelo nome ou nick informado.");
  const config = await getLivePvpAccessConfig();
  if (target && !canAccessLivePvp(config, target.id, false))
    throw new Error("Esse jogador ainda não possui acesso à Arena Online.");

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const cutoff = new Date(Date.now() - ACTIVE_WINDOW_MS);
    await tx.appSetting.deleteMany({
      where: { key: { startsWith: QUEUE_PREFIX }, updatedAt: { lt: cutoff } },
    });
    const entries = await tx.appSetting.findMany({
      where: { key: { startsWith: QUEUE_PREFIX }, updatedAt: { gte: cutoff } },
      orderBy: { updatedAt: "asc" },
      select: { value: true },
    });
    const opponent = entries
      .map((entry) => asQueue(entry.value))
      .find(
        (entry) =>
          entry &&
          entry.playerId !== player.id &&
          (target
            ? entry.playerId === target.id && entry.targetPlayerId === player.id
            : entry.targetPlayerId === null),
      );
    if (opponent) {
      const id = randomUUID();
      const match: MatchValue = {
        id,
        playerAId: opponent.playerId,
        playerAName: opponent.playerName,
        playerBId: player.id,
        playerBName: player.displayName,
        coinChooserId: Math.random() < 0.5 ? opponent.playerId : player.id,
        coinResult: Math.random() < 0.5 ? "CARA" : "COROA",
        coinChoice: null,
        coinWinnerId: null,
        firstPickerId: null,
        draftTurnId: null,
        draftQuota: 1,
        teamAIds: [],
        teamBIds: [],
        orderAIds: [],
        orderBIds: [],
        orderTurnId: null,
        phase: "COIN_PICK",
        deadline: nextDeadline(),
        revision: 1,
        events: [
          `${opponent.playerName} e ${player.displayName} foram conectados.`,
        ],
        battle: null,
        status: "PREGAME",
        createdAt: new Date().toISOString(),
      };
      await Promise.all([
        tx.appSetting.deleteMany({
          where: {
            key: {
              in: [
                `${QUEUE_PREFIX}${player.id}`,
                `${QUEUE_PREFIX}${opponent.playerId}`,
              ],
            },
          },
        }),
        tx.appSetting.create({
          data: {
            key: `${MATCH_PREFIX}${id}`,
            value: match as unknown as Prisma.InputJsonValue,
          },
        }),
        tx.appSetting.upsert({
          where: { key: `${PLAYER_MATCH_PREFIX}${player.id}` },
          create: {
            key: `${PLAYER_MATCH_PREFIX}${player.id}`,
            value: { matchId: id },
          },
          update: { value: { matchId: id } },
        }),
        tx.appSetting.upsert({
          where: { key: `${PLAYER_MATCH_PREFIX}${opponent.playerId}` },
          create: {
            key: `${PLAYER_MATCH_PREFIX}${opponent.playerId}`,
            value: { matchId: id },
          },
          update: { value: { matchId: id } },
        }),
      ]);
      return {
        queueCount: Math.max(0, entries.length - 1),
        queued: false,
        match,
      };
    }
    const value: QueueValue = {
      playerId: player.id,
      playerName: player.displayName,
      targetPlayerId: target?.id ?? null,
      joinedAt: new Date().toISOString(),
    };
    await tx.appSetting.upsert({
      where: { key: `${QUEUE_PREFIX}${player.id}` },
      create: {
        key: `${QUEUE_PREFIX}${player.id}`,
        value: value as unknown as Prisma.InputJsonValue,
      },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    return { queueCount: entries.length + 1, queued: true, match: null };
  });
}
