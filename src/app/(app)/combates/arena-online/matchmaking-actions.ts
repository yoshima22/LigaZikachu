"use server";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { getSessionUser, isAdmin } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getPokemonName,
  getPokemonTypes,
  getTypeAdvantageMultiplier,
} from "@/lib/mascot-data";
import { getPreferredSpriteUrl } from "@/lib/sprite-preferences";
import {
  COMBAT_ROLE_VALUES,
  recommendCombatRole,
  type CombatRole,
} from "@/lib/combat-roles";
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
  | { type: "AUTO"; mascotId: string; x?: number; y?: number }
  | { type: "ATTACK"; mascotId: string; x?: number; y?: number }
  | { type: "DEFEND"; mascotId: string; x?: number; y?: number }
  | { type: "WAIT"; mascotId: string; x?: number; y?: number };
export type TacticalFormation = "WALL" | "WEDGE" | "SPLIT";
export type TacticalPlacement = { mascotId: string; x: number; y: number };
export type TacticalBattleEvent = {
  unitId: string;
  targetId?: string;
  kind: string;
  text: string;
  amount?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
};
export type TacticalUnit = {
  id: string;
  pokemonId: number;
  spriteUrl: string;
  name: string;
  level: number;
  types: string[];
  hp: number;
  maxHp: number;
  force: number;
  agility: number;
  charisma: number;
  instinct: number;
  vitality: number;
  role: CombatRole;
  x: number;
  y: number;
  shield: number;
  survivorUsed: boolean;
};
export type LivePvpBattleState = {
  teamA: TacticalUnit[];
  teamB: TacticalUnit[];
  phase: "FORMATION" | "PLANNING" | "FINISHED";
  formationA: TacticalFormation | null;
  formationB: TacticalFormation | null;
  pendingA: LivePvpBattleAction[] | null;
  pendingB: LivePvpBattleAction[] | null;
  turnPlayerId: string;
  roundStarterId: string;
  deadline: string;
  winnerId: string | null;
  round: number;
  logs: string[];
  lastEvents: TacticalBattleEvent[];
};

type MatchValue = LivePvpMatchValue;

const nextDeadline = () => new Date(Date.now() + 30_000).toISOString();
const nextTacticalDeadline = () => new Date(Date.now() + 120_000).toISOString();
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
  if (match.battle && !match.battle.turnPlayerId)
    match.battle.turnPlayerId = match.firstPickerId ?? match.playerAId;
  if (match.battle && !match.battle.roundStarterId)
    match.battle.roundStarterId = match.firstPickerId ?? match.playerAId;
  if (match.phase === "ORDER") {
    match.orderAIds = [...match.teamAIds];
    match.orderBIds = [...match.teamBIds];
    match.orderTurnId = null;
    match.phase = "READY";
  }
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
    role: recommendCombatRole({
      statForce: mascot.statForce,
      statAgility: mascot.statAgility,
      statCharisma: mascot.statCharisma,
      statInstinct: mascot.statInstinct,
      statVitality: mascot.statVitality,
    }),
    x: -1,
    y: -1,
    shield: 0,
    survivorUsed: false,
  } satisfies TacticalUnit;
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
      match.orderAIds = [...match.teamAIds];
      match.orderBIds = [...match.teamBIds];
      match.phase = "READY";
      match.orderTurnId = null;
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
    if (responseMatch.battle.phase === "FORMATION") {
      if (player.id === responseMatch.playerAId) {
        responseMatch.battle.formationB = null;
        responseMatch.battle.teamB = responseMatch.battle.teamB.map((unit) => ({
          ...unit,
          x: -1,
          y: -1,
        }));
      } else {
        responseMatch.battle.formationA = null;
        responseMatch.battle.teamA = responseMatch.battle.teamA.map((unit) => ({
          ...unit,
          x: -1,
          y: -1,
        }));
      }
    }
    if (player.id === responseMatch.playerAId)
      responseMatch.battle.pendingB = responseMatch.battle.pendingB ? [] : null;
    else
      responseMatch.battle.pendingA = responseMatch.battle.pendingA ? [] : null;
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
      match.orderAIds = [...match.teamAIds];
      match.orderBIds = [...match.teamBIds];
      match.phase = "READY";
      match.orderTurnId = null;
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

/* Legacy prototype with individual PokéAPI moves, retained temporarily for reference.
export async function initializeLivePvpBattleActionLegacy() {
  const player = await requireLivePvpPlayer();
  const current = await prisma.$transaction((tx) =>
    findCurrentMatch(tx, player.id),
  );
  if (current.phase !== "READY") throw new Error("O draft ainda não terminou.");
  if (current.battle) return current;
  const ids = [
    ...(current.orderAIds.length ? current.orderAIds : current.teamAIds),
    ...(current.orderBIds.length ? current.orderBIds : current.teamBIds),
  ];
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
      turnPlayerId: match.firstPickerId ?? match.playerAId,
      roundStarterId: match.firstPickerId ?? match.playerAId,
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

*/

const FORMATION_CELLS: Record<TacticalFormation, Array<[number, number]>> = {
  WALL: [
    [2, 1],
    [2, 2],
    [2, 3],
    [2, 4],
    [2, 5],
    [2, 6],
  ],
  WEDGE: [
    [2, 2],
    [2, 5],
    [1, 1],
    [1, 6],
    [0, 2],
    [0, 5],
  ],
  SPLIT: [
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 5],
    [1, 6],
    [0, 7],
  ],
};
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const deterministicRoll = (round: number, ...ids: string[]) => {
  const text = `${round}:${ids.join(":")}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0) / 4294967296;
};
const roleRange = (role: CombatRole) =>
  ["DEFENDER", "ATTACKER", "GUARDIAN", "PROVOKER", "SURVIVOR"].includes(role)
    ? 1
    : role === "SCOUT" || role === "HEALER" || role === "ENCOURAGER"
      ? 3
      : 2;
const formationUnits = (
  units: TacticalUnit[],
  formation: TacticalFormation,
  sideA: boolean,
  orderedIds?: string[],
) =>
  (
    orderedIds
      ?.map((id) => units.find((unit) => unit.id === id)!)
      .filter(Boolean) ?? units
  ).map((unit, index) => {
    const [baseX, y] = FORMATION_CELLS[formation][index];
    return { ...unit, x: sideA ? baseX : 11 - baseX, y };
  });
const nearest = (unit: TacticalUnit, targets: TacticalUnit[]) =>
  [...targets].sort(
    (a, b) => distance(unit, a) - distance(unit, b) || a.hp - b.hp,
  )[0];

function applyTacticalMovement(
  battle: LivePvpBattleState,
  team: TacticalUnit[],
  enemies: TacticalUnit[],
  orders: LivePvpBattleAction[],
) {
  const events: TacticalBattleEvent[] = [];
  const occupied = new Map(
    [...battle.teamA, ...battle.teamB]
      .filter((unit) => unit.hp > 0)
      .map((unit) => [`${unit.x}:${unit.y}`, unit.id]),
  );
  for (const unit of [...team]
    .filter((entry) => entry.hp > 0)
    .sort((a, b) => b.agility - a.agility)) {
    const order = orders.find((entry) => entry.mascotId === unit.id)!;
    const enemyAverage = enemies.length
      ? enemies.reduce((sum, entry) => sum + entry.agility, 0) / enemies.length
      : unit.agility;
    const mobility =
      2 +
      (unit.agility - enemyAverage >= 140
        ? 2
        : unit.agility - enemyAverage >= 60
          ? 1
          : 0);
    let x = order.x ?? unit.x,
      y = order.y ?? unit.y;
    if (order.type === "AUTO" && order.x == null && order.y == null) {
      const target = nearest(
        unit,
        enemies.filter((entry) => entry.hp > 0),
      );
      if (target) {
        const dx = Math.sign(target.x - unit.x),
          dy = Math.sign(target.y - unit.y);
        x =
          unit.x +
          (Math.abs(target.x - unit.x) >= Math.abs(target.y - unit.y) ? dx : 0);
        y = unit.y + (x === unit.x ? dy : 0);
      }
    }
    const valid =
      x >= 0 &&
      x < 12 &&
      y >= 0 &&
      y < 8 &&
      distance(unit, { x, y }) <= mobility;
    const destinationOwner = occupied.get(`${x}:${y}`);
    if (!valid || (destinationOwner && destinationOwner !== unit.id)) {
      order.x = unit.x;
      order.y = unit.y;
      if (valid && destinationOwner)
        events.push({
          unitId: unit.id,
          kind: "BLOCK",
          text: `${unit.name} não conseguiu ocupar (${x + 1}, ${y + 1}); a célula já estava ocupada.`,
        });
      continue;
    }
    occupied.delete(`${unit.x}:${unit.y}`);
    if (unit.x !== x || unit.y !== y)
      events.push({
        unitId: unit.id,
        kind: "MOVE",
        text: `${unit.name} moveu de (${unit.x + 1}, ${unit.y + 1}) para (${x + 1}, ${y + 1}).`,
        fromX: unit.x,
        fromY: unit.y,
        toX: x,
        toY: y,
      });
    unit.x = x;
    unit.y = y;
    order.x = x;
    order.y = y;
    occupied.set(`${x}:${y}`, unit.id);
  }
  return events;
}

function resolveTacticalRound(match: MatchValue) {
  const battle = match.battle!;
  const orders = new Map(
    [...(battle.pendingA ?? []), ...(battle.pendingB ?? [])].map((order) => [
      order.mascotId,
      order,
    ]),
  );
  const all = [...battle.teamA, ...battle.teamB];
  const aliveA = () => battle.teamA.filter((unit) => unit.hp > 0);
  const aliveB = () => battle.teamB.filter((unit) => unit.hp > 0);
  const events: TacticalBattleEvent[] = [
    ...battle.lastEvents.filter((event) =>
      ["MOVE", "BLOCK"].includes(event.kind),
    ),
  ];

  const desired = all
    .filter((unit) => unit.hp > 0)
    .map((unit) => {
      const enemies = battle.teamA.some((entry) => entry.id === unit.id)
        ? aliveB()
        : aliveA();
      const order = orders.get(unit.id);
      const enemyAverage = enemies.length
        ? enemies.reduce((sum, entry) => sum + entry.agility, 0) /
          enemies.length
        : unit.agility;
      const mobility =
        2 +
        (unit.agility - enemyAverage >= 140
          ? 2
          : unit.agility - enemyAverage >= 60
            ? 1
            : 0);
      let x = order?.x ?? unit.x;
      let y = order?.y ?? unit.y;
      if (!order && x === unit.x && y === unit.y) {
        const target = nearest(unit, enemies);
        if (target) {
          const dx = Math.sign(target.x - unit.x),
            dy = Math.sign(target.y - unit.y);
          x =
            unit.x +
            (Math.abs(target.x - unit.x) >= Math.abs(target.y - unit.y)
              ? dx
              : 0);
          y = unit.y + (x === unit.x ? dy : 0);
        }
      }
      if (
        x < 0 ||
        x > 11 ||
        y < 0 ||
        y > 7 ||
        Math.abs(x - unit.x) + Math.abs(y - unit.y) > mobility
      )
        return { unit, x: unit.x, y: unit.y };
      return { unit, x, y };
    })
    .sort(
      (a, b) =>
        b.unit.agility - a.unit.agility || a.unit.id.localeCompare(b.unit.id),
    );
  const occupied = new Set<string>();
  const initialOccupied = new Map(
    all
      .filter((unit) => unit.hp > 0)
      .map((unit) => [`${unit.x}:${unit.y}`, unit.id]),
  );
  for (const move of desired) {
    const key = `${move.x}:${move.y}`;
    const initialOwner = initialOccupied.get(key);
    if (
      !occupied.has(key) &&
      (!initialOwner || initialOwner === move.unit.id)
    ) {
      if (move.unit.x !== move.x || move.unit.y !== move.y)
        events.push({
          unitId: move.unit.id,
          kind: "MOVE",
          text: `${move.unit.name} moveu para (${move.x + 1}, ${move.y + 1}).`,
        });
      move.unit.x = move.x;
      move.unit.y = move.y;
      occupied.add(key);
    } else occupied.add(`${move.unit.x}:${move.unit.y}`);
  }

  const actors = [...all]
    .filter((unit) => unit.hp > 0)
    .sort(
      (a, b) =>
        b.agility - a.agility || deterministicRoll(battle.round, a.id) - 0.5,
    );
  for (const actor of actors) {
    if (actor.hp <= 0) continue;
    actor.shield = 0;
    const ownA = battle.teamA.some((entry) => entry.id === actor.id);
    const allies = ownA ? aliveA() : aliveB();
    const enemies = ownA ? aliveB() : aliveA();
    if (!enemies.length) break;
    const order = orders.get(actor.id);
    const action = order?.type ?? "AUTO";
    if (action === "WAIT") continue;
    if (action === "DEFEND") {
      actor.shield =
        actor.role === "DEFENDER"
          ? 0.45
          : actor.role === "GUARDIAN"
            ? 0.38
            : 0.32;
      events.push({
        unitId: actor.id,
        kind: "DEFEND",
        text: `${actor.name} preparou ${Math.round(actor.shield * 100)}% de defesa.`,
        amount: Math.round(actor.shield * 100),
      });
      continue;
    }
    if (actor.role === "HEALER" && action === "AUTO") {
      const wounded = allies
        .filter(
          (unit) =>
            unit.id !== actor.id &&
            unit.hp > 0 &&
            unit.hp < unit.maxHp &&
            distance(actor, unit) <= 3,
        )
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (wounded) {
        const amount = Math.max(
          15,
          Math.round(
            (actor.charisma * 0.35 + actor.vitality * 0.25 + actor.level) * 2.5,
          ),
        );
        wounded.hp = Math.min(wounded.maxHp, wounded.hp + amount);
        events.push({
          unitId: actor.id,
          targetId: wounded.id,
          kind: "HEAL",
          text: `${actor.name} curou ${wounded.name} em ${amount} HP.`,
          amount,
        });
        continue;
      }
    }
    let candidates = enemies.filter(
      (unit) => distance(actor, unit) <= roleRange(actor.role),
    );
    if (!candidates.length) continue;
    if (actor.role === "FLANK" || actor.role === "SCOUT")
      candidates.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    else if (actor.role === "ATTACKER")
      candidates.sort((a, b) => b.force - a.force);
    else if (actor.role === "OPPORTUNIST")
      candidates.sort((a, b) => a.instinct - b.instinct);
    let target = candidates[0];
    const defenders = enemies.filter(
      (unit) =>
        unit.role === "DEFENDER" && distance(unit, target) <= 2 && unit.hp > 0,
    );
    const defender = defenders[0];
    if (defender && actor.role !== "FLANK") {
      const chance = actor.role === "ATTACKER" ? 0.62 : 0.78;
      if (deterministicRoll(battle.round, actor.id, defender.id) < chance)
        target = defender;
    }
    let roleMult =
      actor.role === "ATTACKER"
        ? 1.08 + Math.min(0.18, actor.force / 420)
        : actor.role === "FLANK"
          ? 1.04 + Math.min(0.14, actor.agility / 500)
          : actor.role === "SPECIALIST"
            ? 1.06 +
              Math.min(
                0.14,
                Math.max(
                  actor.force,
                  actor.agility,
                  actor.instinct,
                  actor.vitality,
                  actor.charisma,
                ) / 500,
              )
            : 1;
    if (actor.role === "ATTACKER" && target.role === "DEFENDER")
      roleMult *= 1.15;
    if (
      actor.role === "FLANK" &&
      ["ENCOURAGER", "HEALER", "OPPORTUNIST"].includes(target.role)
    )
      roleMult *= 1.12;
    const encourage = allies
      .filter(
        (unit) => unit.role === "ENCOURAGER" && distance(unit, actor) <= 3,
      )
      .reduce(
        (best, unit) =>
          Math.max(best, Math.min(0.18, 0.04 + unit.charisma / 650)),
        0,
      );
    if (encourage > 0)
      events.push({
        unitId: actor.id,
        targetId: actor.id,
        kind: "BUFF",
        text: `${actor.name} recebeu ${Math.round(encourage * 100)}% de impulso de um Encorajador próximo.`,
        amount: Math.round(encourage * 100),
      });
    const typeMult = getPokemonTypes(actor.pokemonId).some(
      (type) =>
        getPokemonTypes(target.pokemonId) &&
        getTypeAdvantageMultiplier([type], getPokemonTypes(target.pokemonId)) >
          1,
    )
      ? 1.3
      : 1;
    let damage = Math.max(
      1,
      Math.round(
        ((actor.force * 1.8 +
          actor.level * 2 +
          actor.instinct * 0.7 +
          (battle.round % 12)) *
          (1 + encourage) *
          roleMult *
          typeMult -
          (target.vitality * 0.8 + target.level)) *
          (1 - target.shield),
      ),
    );
    const guardian = (ownA ? aliveB() : aliveA()).find(
      (unit) =>
        unit.role === "GUARDIAN" &&
        unit.id !== target.id &&
        distance(unit, target) <= 2,
    );
    if (guardian) {
      const absorbed = Math.round(
        damage *
          Math.min(0.4, 0.15 + (guardian.vitality + guardian.charisma) / 600),
      );
      guardian.hp = Math.max(0, guardian.hp - absorbed);
      damage -= absorbed;
      events.push({
        unitId: guardian.id,
        targetId: target.id,
        kind: "GUARD",
        text: `${guardian.name} interceptou ${absorbed} de dano por ${target.name}.`,
        amount: absorbed,
      });
    }
    if (
      target.role === "SURVIVOR" &&
      !target.survivorUsed &&
      target.hp - damage <= 0
    ) {
      damage = target.hp - 1;
      target.survivorUsed = true;
    }
    target.hp = Math.max(0, target.hp - damage);
    events.push({
      unitId: actor.id,
      targetId: target.id,
      kind: "ATTACK",
      text: `${actor.name} atacou ${target.name} e causou ${damage} de dano.`,
      amount: damage,
    });
    if (target.hp <= 0)
      events.push({
        unitId: target.id,
        targetId: target.id,
        kind: "KO",
        text: `${target.name} foi nocauteado e saiu do combate.`,
      });
  }
  battle.lastEvents = events;
  battle.logs.push(
    `Rodada ${battle.round}`,
    ...events.map((event) => event.text),
  );
  battle.pendingA = null;
  battle.pendingB = null;
  battle.round += 1;
  battle.deadline = nextTacticalDeadline();
  const remainingA = aliveA(),
    remainingB = aliveB();
  if (!remainingA.length || !remainingB.length || battle.round > 12) {
    const score = (team: TacticalUnit[]) =>
      team.filter((unit) => unit.hp > 0).length * 10000 +
      team.reduce((sum, unit) => sum + unit.hp / unit.maxHp, 0);
    battle.winnerId =
      score(battle.teamA) === score(battle.teamB)
        ? null
        : score(battle.teamA) > score(battle.teamB)
          ? match.playerAId
          : match.playerBId;
    battle.phase = "FINISHED";
  }
}

export async function initializeLivePvpBattleAction() {
  const player = await requireLivePvpPlayer();
  const current = await prisma.$transaction((tx) =>
    findCurrentMatch(tx, player.id),
  );
  if (current.phase !== "READY") throw new Error("O draft ainda não terminou.");
  if (current.battle) return { ok: true };
  const ids = [
    ...(current.orderAIds.length ? current.orderAIds : current.teamAIds),
    ...(current.orderBIds.length ? current.orderBIds : current.teamBIds),
  ];
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
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    if (match.battle) return { ok: true };
    const teamAIds = match.orderAIds.length ? match.orderAIds : match.teamAIds;
    const teamBIds = match.orderBIds.length ? match.orderBIds : match.teamBIds;
    match.battle = {
      teamA: teamAIds.map((id) => fighterFromMascot(byId.get(id)!)),
      teamB: teamBIds.map((id) => fighterFromMascot(byId.get(id)!)),
      phase: "FORMATION",
      formationA: null,
      formationB: null,
      pendingA: null,
      pendingB: null,
      turnPlayerId: match.firstPickerId ?? match.playerAId,
      roundStarterId: match.firstPickerId ?? match.playerAId,
      deadline: nextTacticalDeadline(),
      winnerId: null,
      round: 1,
      logs: [
        `${match.playerAName} e ${match.playerBName} entraram na Arena Tática.`,
      ],
      lastEvents: [],
    };
    await saveMatch(tx, match);
    return { ok: true };
  });
}

export async function submitLivePvpFormationAction(
  formation: TacticalFormation,
  roles: Record<string, CombatRole>,
  orderedIds?: string[],
  positions?: TacticalPlacement[],
) {
  const player = await requireLivePvpPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id),
      battle = match.battle;
    if (!battle || battle.phase !== "FORMATION")
      throw new Error("A formação já foi encerrada.");
    const sideA = player.id === match.playerAId,
      team = sideA ? battle.teamA : battle.teamB;
    const placement = orderedIds?.length
      ? orderedIds
      : team.map((unit) => unit.id);
    if (
      placement.length !== team.length ||
      new Set(placement).size !== team.length ||
      placement.some((id) => !team.some((unit) => unit.id === id))
    )
      throw new Error("Posicionamento inicial inválido.");
    for (const unit of team)
      if (roles[unit.id] && COMBAT_ROLE_VALUES.includes(roles[unit.id]))
        unit.role = roles[unit.id];
    const customPositions =
      positions?.length === team.length ? positions : null;
    if (customPositions) {
      const ids = new Set(customPositions.map((entry) => entry.mascotId));
      const cells = new Set(
        customPositions.map((entry) => `${entry.x}:${entry.y}`),
      );
      const validColumns = sideA
        ? (x: number) => x >= 0 && x <= 2
        : (x: number) => x >= 9 && x <= 11;
      if (
        ids.size !== team.length ||
        cells.size !== team.length ||
        customPositions.some(
          (entry) =>
            !team.some((unit) => unit.id === entry.mascotId) ||
            !validColumns(entry.x) ||
            entry.y < 0 ||
            entry.y > 7,
        )
      )
        throw new Error(
          "As posições devem ficar nas três colunas iniciais e não podem se sobrepor.",
        );
    }
    const positionedTeam = customPositions
      ? team.map((unit) => {
          const position = customPositions.find(
            (entry) => entry.mascotId === unit.id,
          )!;
          return { ...unit, x: position.x, y: position.y };
        })
      : formationUnits(team, formation, sideA, placement);
    if (sideA) {
      battle.formationA = formation;
      battle.teamA = positionedTeam;
    } else {
      battle.formationB = formation;
      battle.teamB = positionedTeam;
    }
    if (battle.formationA && battle.formationB) {
      battle.phase = "PLANNING";
      battle.turnPlayerId = battle.roundStarterId;
      battle.deadline = nextTacticalDeadline();
      battle.logs.push("As formações foram reveladas. Rodada 1 iniciada.");
    }
    await saveMatch(tx, match);
    return { ok: true };
  });
}

export async function submitLivePvpBattleAction(
  actions: LivePvpBattleAction[] | LivePvpBattleAction,
) {
  const player = await requireLivePvpPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id),
      battle = match.battle;
    if (!battle || battle.phase !== "PLANNING" || battle.winnerId)
      throw new Error("A rodada não está aceitando ordens.");
    if (battle.turnPlayerId !== player.id)
      throw new Error("Aguarde o turno de movimentação do adversário.");
    const sideA = player.id === match.playerAId,
      team = sideA ? battle.teamA : battle.teamB;
    const list = Array.isArray(actions) ? actions : [actions];
    const normalized = team
      .filter((unit) => unit.hp > 0)
      .map(
        (unit) =>
          list.find((entry) => entry.mascotId === unit.id) ?? {
            type: "AUTO" as const,
            mascotId: unit.id,
          },
      );
    const movementEvents = applyTacticalMovement(
      battle,
      team,
      sideA ? battle.teamB : battle.teamA,
      normalized,
    );
    battle.lastEvents = movementEvents;
    battle.logs.push(
      `${player.displayName} concluiu a movimentação da rodada ${battle.round}.`,
      ...movementEvents.map((event) => event.text),
    );
    if (sideA) battle.pendingA = normalized;
    else battle.pendingB = normalized;
    if (battle.pendingA && battle.pendingB) {
      resolveTacticalRound(match);
      // O vencedor da escolha inicial permanece como primeiro jogador das
      // rodadas. Assim ninguém joga duas vezes seguidas na virada da rodada.
      battle.turnPlayerId = battle.roundStarterId;
    } else {
      battle.turnPlayerId = otherPlayerId(match, player.id);
      battle.deadline = nextTacticalDeadline();
    }
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
    match.battle.phase = "FINISHED";
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
