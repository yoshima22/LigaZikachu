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
import {
  createTacticalBiomes,
  tacticalBiomeAt,
  tacticalFogState,
  type TacticalBiome,
} from "@/lib/tactical-arena";

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
  banTurnId: string | null;
  bansByAIds: string[];
  bansByBIds: string[];
  banLimitA: number;
  banLimitB: number;
  draftTurnId: string | null;
  draftQuota: number;
  teamAIds: string[];
  teamBIds: string[];
  orderAIds: string[];
  orderBIds: string[];
  orderTurnId: string | null;
  phase: "COIN_PICK" | "FIRST_PICK" | "BAN" | "DRAFT" | "ORDER" | "READY";
  deadline: string;
  revision: number;
  events: string[];
  battle: LivePvpBattleState | null;
  status: "PREGAME" | "FINISHED";
  createdAt: string;
};

export type LivePvpBattleAction =
  | {
      type: "AUTO";
      mascotId: string;
      x?: number;
      y?: number;
      targetId?: string;
    }
  | {
      type: "ATTACK";
      mascotId: string;
      x?: number;
      y?: number;
      targetId?: string;
    }
  | {
      type: "DEFEND";
      mascotId: string;
      x?: number;
      y?: number;
      targetId?: string;
    }
  | {
      type: "WAIT";
      mascotId: string;
      x?: number;
      y?: number;
      targetId?: string;
    };
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
  fogTurns: number;
  effects: Array<{
    id: string;
    label: string;
    kind: "BUFF" | "DEBUFF";
    stat?: "force" | "agility" | "charisma" | "instinct" | "vitality";
    value: number;
    duration: number;
  }>;
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
  biomes: TacticalBiome[];
};

type MatchValue = LivePvpMatchValue;

const nextDeadline = () => new Date(Date.now() + 30_000).toISOString();
const nextTacticalDeadline = () => new Date(Date.now() + 120_000).toISOString();
function normalizeMatch(raw: Partial<MatchValue>): MatchValue {
  const match = {
    coinChoice: null,
    coinWinnerId: null,
    firstPickerId: null,
    banTurnId: null,
    bansByAIds: [],
    bansByBIds: [],
    banLimitA: 3,
    banLimitB: 3,
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
  if (match.battle) {
    match.battle.teamA = match.battle.teamA.map((unit) => ({
      ...unit,
      effects: unit.effects ?? [],
      fogTurns: unit.fogTurns ?? 0,
    }));
    match.battle.teamB = match.battle.teamB.map((unit) => ({
      ...unit,
      effects: unit.effects ?? [],
      fogTurns: unit.fogTurns ?? 0,
    }));
  }
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
    fogTurns: 0,
    effects: [],
  } satisfies TacticalUnit;
}
const otherPlayerId = (match: MatchValue, playerId: string) =>
  playerId === match.playerAId ? match.playerBId : match.playerAId;
const sideTeam = (match: MatchValue, playerId: string) =>
  playerId === match.playerAId ? match.teamAIds : match.teamBIds;
const bansMadeBy = (match: MatchValue, playerId: string) =>
  playerId === match.playerAId ? match.bansByAIds : match.bansByBIds;
const bansAgainst = (match: MatchValue, playerId: string) =>
  playerId === match.playerAId ? match.bansByBIds : match.bansByAIds;
const banLimitFor = (match: MatchValue, playerId: string) =>
  playerId === match.playerAId ? match.banLimitA : match.banLimitB;

async function beginBanOrDraft(
  tx: Prisma.TransactionClient,
  match: MatchValue,
  firstPlayerId: string,
) {
  const [countA, countB] = await Promise.all([
    tx.mascot.count({ where: { playerId: match.playerAId } }),
    tx.mascot.count({ where: { playerId: match.playerBId } }),
  ]);
  match.banLimitA = Math.min(3, Math.max(0, countB - 6));
  match.banLimitB = Math.min(3, Math.max(0, countA - 6));
  match.bansByAIds = [];
  match.bansByBIds = [];
  if (match.banLimitA || match.banLimitB) {
    match.phase = "BAN";
    match.banTurnId =
      banLimitFor(match, firstPlayerId) > 0
        ? firstPlayerId
        : otherPlayerId(match, firstPlayerId);
    match.draftTurnId = null;
  } else {
    match.phase = "DRAFT";
    match.draftTurnId = firstPlayerId;
    match.draftQuota = 1;
  }
}

function advanceBanTurn(match: MatchValue, playerId: string) {
  const other = otherPlayerId(match, playerId);
  const currentDone =
    bansMadeBy(match, playerId).length >= banLimitFor(match, playerId);
  const otherDone =
    bansMadeBy(match, other).length >= banLimitFor(match, other);
  if (currentDone && otherDone) {
    match.phase = "DRAFT";
    match.banTurnId = null;
    match.draftTurnId = match.firstPickerId ?? match.playerAId;
    match.draftQuota = 1;
  } else if (!otherDone) match.banTurnId = other;
  else match.banTurnId = playerId;
}

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
    await beginBanOrDraft(tx, match, match.firstPickerId);
    match.events.push(
      "O servidor sorteou quem inicia o draft por tempo esgotado.",
    );
  } else if (match.phase === "BAN" && match.banTurnId) {
    const playerId = match.banTurnId;
    const opponentId = otherPlayerId(match, playerId);
    const used = [...match.bansByAIds, ...match.bansByBIds];
    const automatic = await tx.mascot.findFirst({
      where: { playerId: opponentId, id: { notIn: used } },
      orderBy: [{ level: "desc" }, { id: "asc" }],
      select: { id: true, nickname: true, pokemonId: true },
    });
    if (automatic) {
      if (playerId === match.playerAId) match.bansByAIds.push(automatic.id);
      else match.bansByBIds.push(automatic.id);
      match.events.push(
        `O servidor baniu ${automatic.nickname ?? `#${automatic.pokemonId}`} por tempo esgotado.`,
      );
    }
    advanceBanTurn(match, playerId);
  } else if (match.phase === "DRAFT" && match.draftTurnId) {
    const playerId = match.draftTurnId;
    const team = sideTeam(match, playerId);
    const required = Math.min(match.draftQuota, 6 - team.length);
    const automatic = await tx.mascot.findMany({
      where: {
        playerId,
        id: { notIn: [...team, ...bansAgainst(match, playerId)] },
      },
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
    includeMascots && (selectedIds.length || match.phase === "BAN")
      ? await prisma.mascot.findMany({
          where:
            match.phase === "BAN"
              ? { playerId: { in: [match.playerAId, match.playerBId] } }
              : { id: { in: [...new Set(selectedIds)] } },
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
      ownerId: mascot.playerId,
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
    await beginBanOrDraft(tx, match, firstPlayerId);
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

export async function submitLivePvpBanAction(mascotId: string) {
  const player = await requireLivePvpPlayer();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73422026)`;
    const match = await findCurrentMatch(tx, player.id);
    if (match.phase !== "BAN" || match.banTurnId !== player.id)
      throw new Error("Aguarde sua vez de banir.");
    const opponentId = otherPlayerId(match, player.id);
    const mascot = await tx.mascot.findFirst({
      where: { id: mascotId, playerId: opponentId },
      select: { id: true, nickname: true, pokemonId: true },
    });
    if (
      !mascot ||
      [...match.bansByAIds, ...match.bansByBIds].includes(mascot.id)
    )
      throw new Error("Este mascote não está disponível para banimento.");
    if (player.id === match.playerAId) match.bansByAIds.push(mascot.id);
    else match.bansByBIds.push(mascot.id);
    match.events.push(
      `${player.displayName} baniu ${mascot.nickname ?? `#${mascot.pokemonId}`}.`,
    );
    advanceBanTurn(match, player.id);
    match.deadline = nextDeadline();
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
      where: {
        id: { in: uniqueIds, notIn: bansAgainst(match, player.id) },
        playerId: player.id,
      },
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
const effectiveStat = (
  unit: TacticalUnit,
  stat: "force" | "agility" | "charisma" | "instinct" | "vitality",
) => {
  const modifier = (unit.effects ?? [])
    .filter((effect) => effect.stat === stat)
    .reduce(
      (total, effect) =>
        total + (effect.kind === "BUFF" ? effect.value : -effect.value),
      0,
    );
  return Math.max(1, Math.round(unit[stat] * (1 + modifier)));
};
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
    .sort(
      (a, b) => effectiveStat(b, "agility") - effectiveStat(a, "agility"),
    )) {
    const order = orders.find((entry) => entry.mascotId === unit.id)!;
    const enemyAverage = enemies.length
      ? enemies.reduce(
          (sum, entry) => sum + effectiveStat(entry, "agility"),
          0,
        ) / enemies.length
      : effectiveStat(unit, "agility");
    const unitAgility = effectiveStat(unit, "agility");
    const fogPenalty =
      tacticalFogState(battle.round, unit.x, unit.y) === "ACTIVE" ? 1 : 0;
    const mobility =
      2 +
      (unitAgility - enemyAverage >= 140
        ? 2
        : unitAgility - enemyAverage >= 60
          ? 1
          : 0) -
      fogPenalty;
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
    const leavingEnemyControl =
      unit.role !== "FLANK" &&
      enemies.some((enemy) => enemy.hp > 0 && distance(unit, enemy) === 1) &&
      (x !== unit.x || y !== unit.y);
    const movementCost =
      distance(unit, { x, y }) + (leavingEnemyControl ? 1 : 0);
    const valid =
      x >= 0 && x < 12 && y >= 0 && y < 8 && movementCost <= mobility;
    const destinationOwner = occupied.get(`${x}:${y}`);
    if (!valid || (destinationOwner && destinationOwner !== unit.id)) {
      order.x = unit.x;
      order.y = unit.y;
      if (!valid && leavingEnemyControl)
        events.push({
          unitId: unit.id,
          kind: "CONTROL",
          text: `${unit.name} não conseguiu sair da zona de controle inimiga com a mobilidade disponível.`,
        });
      else if (valid && destinationOwner)
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

  const roleStat = (role: CombatRole) =>
    role === "ATTACKER" || role === "DUELIST" || role === "SPECIALIST"
      ? ("force" as const)
      : role === "FLANK" || role === "SCOUT" || role === "SABOTEUR"
        ? ("agility" as const)
        : role === "ENCOURAGER" || role === "HEALER" || role === "PROVOKER"
          ? ("charisma" as const)
          : role === "OPPORTUNIST"
            ? ("instinct" as const)
            : ("vitality" as const);
  for (const unit of all.filter((entry) => entry.hp > 0)) {
    unit.effects = unit.effects.filter(
      (effect) => !effect.id.startsWith("biome:"),
    );
    const biome = tacticalBiomeAt(battle.biomes ?? [], unit.x, unit.y);
    if (!biome) continue;
    const favored = unit.types.some((type) =>
      biome.favoredTypes.includes(type),
    );
    const penalized = unit.types.some((type) =>
      biome.penalizedTypes.includes(type),
    );
    if (favored || penalized)
      unit.effects.push({
        id: `biome:${biome.id}`,
        label: `${biome.name}: ${favored ? "+10%" : "-10%"} em ${roleStat(unit.role)}`,
        kind: favored ? "BUFF" : "DEBUFF",
        stat: roleStat(unit.role),
        value: 0.1,
        duration: 2,
      });
  }

  const desired = all
    .filter((unit) => unit.hp > 0)
    .map((unit) => {
      const enemies = battle.teamA.some((entry) => entry.id === unit.id)
        ? aliveB()
        : aliveA();
      const order = orders.get(unit.id);
      const enemyAverage = enemies.length
        ? enemies.reduce(
            (sum, entry) => sum + effectiveStat(entry, "agility"),
            0,
          ) / enemies.length
        : effectiveStat(unit, "agility");
      const unitAgility = effectiveStat(unit, "agility");
      const fogPenalty =
        tacticalFogState(battle.round, unit.x, unit.y) === "ACTIVE" ? 1 : 0;
      const mobility =
        2 +
        (unitAgility - enemyAverage >= 140
          ? 2
          : unitAgility - enemyAverage >= 60
            ? 1
            : 0) -
        fogPenalty;
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
        effectiveStat(b.unit, "agility") - effectiveStat(a.unit, "agility") ||
        a.unit.id.localeCompare(b.unit.id),
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

  for (const [scouts, enemies] of [
    [aliveA(), aliveB()],
    [aliveB(), aliveA()],
  ] as const) {
    for (const scout of scouts.filter((unit) => unit.role === "SCOUT")) {
      const target = enemies
        .filter((unit) => distance(scout, unit) <= 4)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!target) continue;
      const markId = `scout:${scout.id}`;
      const alreadyMarked = target.effects.some(
        (effect) => effect.id === markId,
      );
      for (const enemy of enemies)
        enemy.effects = enemy.effects.filter((effect) => effect.id !== markId);
      target.effects.push({
        id: markId,
        label: `Marcado por ${scout.name}`,
        kind: "DEBUFF",
        value: 0.08,
        duration: 3,
      });
      if (!alreadyMarked)
        events.push({
          unitId: scout.id,
          targetId: target.id,
          kind: "MARK",
          text: `${scout.name} marcou ${target.name}; aliados próximos causam 8% a mais de dano nesse alvo.`,
          amount: 8,
        });
    }
  }

  const reactionBlocked = (unit: TacticalUnit) => {
    const blocked = unit.effects.find((effect) =>
      effect.id.startsWith("reaction-block:"),
    );
    if (!blocked) return false;
    unit.effects = unit.effects.filter((effect) => effect.id !== blocked.id);
    events.push({
      unitId: unit.id,
      targetId: unit.id,
      kind: "INTERFERENCE",
      text: `${unit.name} perdeu sua reação de postura por Interferência.`,
    });
    return true;
  };
  const reactionUses = new Map<string, number>();
  const reactionLimit = (unit: TacticalUnit) =>
    unit.role === "GUARDIAN" && orders.get(unit.id)?.type === "DEFEND" ? 2 : 1;
  const reactionAvailable = (unit: TacticalUnit) =>
    (reactionUses.get(unit.id) ?? 0) < reactionLimit(unit);
  const recordReaction = (unit: TacticalUnit) =>
    reactionUses.set(unit.id, (reactionUses.get(unit.id) ?? 0) + 1);

  for (const unit of all) unit.shield = 0;
  for (const unit of all.filter((entry) => entry.hp > 0)) {
    if (orders.get(unit.id)?.type !== "DEFEND") continue;
    unit.shield =
      unit.role === "DEFENDER" ? 0.45 : unit.role === "GUARDIAN" ? 0.38 : 0.32;
    events.push({
      unitId: unit.id,
      targetId: unit.id,
      kind: "DEFEND",
      text: `${unit.name} preparou ${Math.round(unit.shield * 100)}% de defesa para o próximo ataque direto.`,
      amount: Math.round(unit.shield * 100),
    });
  }

  const actors = [...all]
    .filter((unit) => unit.hp > 0)
    .sort(
      (a, b) =>
        effectiveStat(b, "agility") - effectiveStat(a, "agility") ||
        deterministicRoll(battle.round, a.id) - 0.5,
    );
  for (const actor of actors) {
    if (actor.hp <= 0) continue;
    const ownA = battle.teamA.some((entry) => entry.id === actor.id);
    const allies = ownA ? aliveA() : aliveB();
    const enemies = ownA ? aliveB() : aliveA();
    if (!enemies.length) break;
    const order = orders.get(actor.id);
    const action = order?.type ?? "AUTO";
    if (action === "WAIT") continue;
    if (action === "DEFEND") continue;
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
        const saboteur = enemies.find(
          (unit) => unit.role === "SABOTEUR" && distance(unit, actor) <= 3,
        );
        const baseAmount = Math.max(
          15,
          Math.round(
            (actor.charisma * 0.35 + actor.vitality * 0.25 + actor.level) * 2.5,
          ),
        );
        const fogHealingPenalty =
          tacticalFogState(battle.round, wounded.x, wounded.y) === "ACTIVE"
            ? 0.5
            : 1;
        const amount = Math.max(
          1,
          Math.round(baseAmount * (saboteur ? 0.7 : 1) * fogHealingPenalty),
        );
        if (saboteur)
          events.push({
            unitId: saboteur.id,
            targetId: actor.id,
            kind: "SABOTAGE",
            text: `${saboteur.name} reduziu em 30% a cura de ${actor.name}.`,
            amount: 30,
          });
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
    let target =
      (action === "ATTACK" && order?.targetId
        ? candidates.find((unit) => unit.id === order.targetId)
        : null) ?? candidates[0];
    if (actor.role === "DUELIST") {
      const marked = candidates.find((unit) =>
        unit.effects.some((effect) => effect.id === `duelist:${actor.id}`),
      );
      if (marked && !order?.targetId) target = marked;
    }
    const originalTarget = target;
    const defenders = enemies.filter(
      (unit) =>
        unit.role === "DEFENDER" &&
        distance(unit, target) <= 2 &&
        unit.hp > 0 &&
        reactionAvailable(unit) &&
        !reactionBlocked(unit),
    );
    const defender = defenders[0];
    if (defender && actor.role === "FLANK") {
      const bypassChance = Math.min(
        0.82,
        0.35 + effectiveStat(actor, "agility") / 530,
      );
      if (
        deterministicRoll(battle.round, actor.id, defender.id, "flank") <
        bypassChance
      )
        events.push({
          unitId: actor.id,
          targetId: defender.id,
          kind: "BYPASS",
          text: `${actor.name} flanqueou a zona de ${defender.name} e manteve o alvo original.`,
          amount: Math.round(bypassChance * 100),
        });
      else target = defender;
    } else if (defender) {
      const baseChance = actor.role === "ATTACKER" ? 0.62 : 0.78;
      const chance = Math.min(
        0.95,
        baseChance + (orders.get(defender.id)?.type === "DEFEND" ? 0.2 : 0),
      );
      if (deterministicRoll(battle.round, actor.id, defender.id) < chance) {
        target = defender;
        recordReaction(defender);
        events.push({
          unitId: defender.id,
          targetId: originalTarget.id,
          kind: "REDIRECT",
          text: `${defender.name} redirecionou o ataque que iria atingir ${originalTarget.name}.`,
          amount: Math.round(chance * 100),
        });
      }
    }
    if (target === originalTarget) {
      const provoker = enemies.find(
        (unit) =>
          unit.role === "PROVOKER" &&
          unit.id !== target.id &&
          distance(unit, target) <= 3 &&
          reactionAvailable(unit) &&
          !reactionBlocked(unit),
      );
      if (provoker) {
        const chance = Math.min(
          0.55,
          0.2 + (provoker.charisma + provoker.instinct) / 850,
        );
        if (
          deterministicRoll(battle.round, actor.id, provoker.id, "provoke") <
          chance
        ) {
          target = provoker;
          recordReaction(provoker);
          events.push({
            unitId: provoker.id,
            targetId: originalTarget.id,
            kind: "PROVOKE",
            text: `${provoker.name} provocou ${actor.name} e tomou o ataque no lugar de ${originalTarget.name}.`,
            amount: Math.round(chance * 100),
          });
        }
      }
    }
    let roleMult =
      actor.role === "ATTACKER"
        ? 1.08 + Math.min(0.18, actor.force / 420)
        : actor.role === "FLANK"
          ? 1.04 + Math.min(0.14, actor.agility / 500)
          : actor.role === "DUELIST"
            ? 1.06 + Math.min(0.12, actor.force / 520)
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
    if (actor.role === "GUARDIAN") roleMult *= 0.9;
    if (actor.role === "PROVOKER") roleMult *= 0.92;
    if (actor.role === "SCOUT") roleMult *= 0.95;
    if (actor.role === "SURVIVOR" && actor.hp / actor.maxHp < 0.3)
      roleMult *= 1.15;
    if (actor.role === "DUELIST") {
      const markId = `duelist:${actor.id}`;
      const hasMark = target.effects.some((effect) => effect.id === markId);
      if (!hasMark) {
        for (const enemy of enemies)
          enemy.effects = enemy.effects.filter(
            (effect) => effect.id !== markId,
          );
        target.effects.push({
          id: markId,
          label: `Duelo com ${actor.name}`,
          kind: "DEBUFF",
          value: 0.12,
          duration: 5,
        });
        events.push({
          unitId: actor.id,
          targetId: target.id,
          kind: "MARK",
          text: `${actor.name} marcou ${target.name} como rival do duelo.`,
          amount: 12,
        });
      }
      if (hasMark) roleMult *= 1.12;
    }
    const encourager = allies
      .filter(
        (unit) => unit.role === "ENCOURAGER" && distance(unit, actor) <= 3,
      )
      .sort((a, b) => b.charisma - a.charisma)[0];
    const encouragementBase = encourager
      ? Math.min(0.18, 0.04 + encourager.charisma / 650)
      : 0;
    const encouragementSaboteur = encourager
      ? enemies.find(
          (unit) => unit.role === "SABOTEUR" && distance(unit, encourager) <= 3,
        )
      : null;
    const encourage = encouragementBase * (encouragementSaboteur ? 0.7 : 1);
    if (encouragementSaboteur && encourager)
      events.push({
        unitId: encouragementSaboteur.id,
        targetId: encourager.id,
        kind: "SABOTAGE",
        text: `${encouragementSaboteur.name} reduziu em 30% a aura de ${encourager.name}.`,
        amount: 30,
      });
    if (encourage > 0)
      events.push({
        unitId: actor.id,
        targetId: actor.id,
        kind: "BUFF",
        text: `${actor.name} recebeu ${Math.round(encourage * 100)}% de impulso de um Encorajador próximo.`,
        amount: Math.round(encourage * 100),
      });
    const scoutBonus = allies.some(
      (scout) =>
        scout.role === "SCOUT" &&
        distance(scout, actor) <= 3 &&
        target.effects.some((effect) => effect.id === `scout:${scout.id}`),
    )
      ? 0.08
      : 0;
    if (scoutBonus > 0)
      events.push({
        unitId: actor.id,
        targetId: target.id,
        kind: "SCOUT_BONUS",
        text: `${actor.name} aproveitou a marca do Batedor contra ${target.name}: +8% de dano.`,
        amount: 8,
      });
    const typeMult = getPokemonTypes(actor.pokemonId).some(
      (type) =>
        getPokemonTypes(target.pokemonId) &&
        getTypeAdvantageMultiplier([type], getPokemonTypes(target.pokemonId)) >
          1,
    )
      ? 1.3
      : 1;
    const actorBiome = tacticalBiomeAt(battle.biomes ?? [], actor.x, actor.y);
    const biomeMult = actorBiome?.favoredTypes.some((type) =>
      actor.types.includes(type),
    )
      ? 1.08
      : 1;
    const preparedShield = target.shield;
    const targetReduction =
      target.role === "DEFENDER"
        ? Math.min(0.35, 0.08 + effectiveStat(target, "vitality") / 500)
        : target.role === "GUARDIAN"
          ? Math.min(0.2, 0.05 + effectiveStat(target, "vitality") / 750)
          : target.role === "SURVIVOR"
            ? Math.min(0.15, effectiveStat(target, "vitality") / 900) +
              (target.hp / target.maxHp < 0.3 ? 0.25 : 0)
            : 0;
    let damage = Math.max(
      1,
      Math.round(
        ((effectiveStat(actor, "force") * 1.8 +
          actor.level * 2 +
          effectiveStat(actor, "instinct") * 0.7 +
          (battle.round % 12)) *
          (1 + encourage) *
          (1 + scoutBonus) *
          roleMult *
          typeMult *
          biomeMult -
          (effectiveStat(target, "vitality") * 0.8 + target.level)) *
          (1 - targetReduction) *
          (1 - target.shield),
      ),
    );
    if (targetReduction > 0)
      events.push({
        unitId: target.id,
        targetId: target.id,
        kind: "MITIGATE",
        text: `${target.name} reduziu ${Math.round(targetReduction * 100)}% do dano com sua postura.`,
        amount: Math.round(targetReduction * 100),
      });
    if (preparedShield > 0) target.shield = 0;
    if (target.role === "PROVOKER" && target.id !== originalTarget.id)
      damage = Math.max(1, Math.round(damage * 0.92));
    const guardian = (ownA ? aliveB() : aliveA()).find(
      (unit) =>
        unit.role === "GUARDIAN" &&
        unit.id !== target.id &&
        distance(unit, target) <= 2 &&
        reactionAvailable(unit) &&
        !reactionBlocked(unit),
    );
    if (guardian) {
      recordReaction(guardian);
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
      if (guardian.hp <= 0)
        events.push({
          unitId: guardian.id,
          targetId: guardian.id,
          kind: "KO",
          text: `${guardian.name} foi nocauteado ao interceptar o ataque.`,
        });
    }
    if (
      target.role === "SURVIVOR" &&
      !target.survivorUsed &&
      target.hp - damage <= 0
    ) {
      damage = target.hp - 1;
      target.survivorUsed = true;
      events.push({
        unitId: target.id,
        targetId: target.id,
        kind: "SURVIVE",
        text: `${target.name} ativou Sobrevivente e resistiu ao golpe fatal com 1 HP.`,
      });
    }
    target.hp = Math.max(0, target.hp - damage);
    events.push({
      unitId: actor.id,
      targetId: target.id,
      kind: "ATTACK",
      text: `${actor.name} atacou ${target.name} e causou ${damage} de dano.`,
      amount: damage,
    });
    if (actor.role === "OPPORTUNIST" && target.hp > 0) {
      const chance = Math.min(
        0.62,
        0.22 + effectiveStat(actor, "instinct") / 500,
      );
      if (
        deterministicRoll(battle.round, actor.id, target.id, "opportunist") <
        chance
      ) {
        const stats = ["force", "agility", "instinct", "vitality"] as const;
        const stat =
          stats[
            Math.floor(
              deterministicRoll(battle.round, target.id, actor.id, "stat") *
                stats.length,
            )
          ];
        const value = Math.min(
          0.25,
          0.08 + effectiveStat(actor, "instinct") / 900,
        );
        target.effects = [
          ...target.effects.filter(
            (effect) => effect.id !== `opportunist:${actor.id}:${stat}`,
          ),
          {
            id: `opportunist:${actor.id}:${stat}`,
            label: `Interferência: ${stat === "force" ? "Força" : stat === "agility" ? "Agilidade" : stat === "instinct" ? "Instinto" : "Vitalidade"}`,
            kind: "DEBUFF",
            stat,
            value,
            duration: 4,
          },
        ];
        events.push({
          unitId: actor.id,
          targetId: target.id,
          kind: "DEBUFF",
          text: `${actor.name} aplicou ${Math.round(value * 100)}% de Interferência em ${target.name} por 3 rodadas.`,
          amount: Math.round(value * 100),
        });
      }
    }
    if (actor.role === "SABOTEUR" && target.hp > 0) {
      const chance = Math.min(
        0.55,
        0.18 + (actor.instinct + actor.agility) / 900,
      );
      if (
        deterministicRoll(battle.round, actor.id, target.id, "sabotage") <
        chance
      ) {
        const effectId = `reaction-block:${actor.id}`;
        target.effects = [
          ...target.effects.filter((effect) => effect.id !== effectId),
          {
            id: effectId,
            label: "Reação de postura bloqueada",
            kind: "DEBUFF",
            value: 1,
            duration: 3,
          },
        ];
        events.push({
          unitId: actor.id,
          targetId: target.id,
          kind: "SABOTAGE",
          text: `${actor.name} bloqueou a próxima reação de postura de ${target.name}.`,
          amount: Math.round(chance * 100),
        });
      }
    }
    if (target.hp <= 0)
      events.push({
        unitId: target.id,
        targetId: target.id,
        kind: "KO",
        text: `${target.name} foi nocauteado e saiu do combate.`,
      });
  }
  for (const unit of all.filter((entry) => entry.hp > 0)) {
    const fog = tacticalFogState(battle.round, unit.x, unit.y);
    if (fog !== "ACTIVE") {
      unit.fogTurns = 0;
      continue;
    }
    unit.fogTurns += 1;
    const percent = [8, 12, 16, 20][Math.min(3, unit.fogTurns - 1)];
    const damage = Math.max(1, Math.round(unit.maxHp * (percent / 100)));
    unit.hp = Math.max(0, unit.hp - damage);
    events.push({
      unitId: unit.id,
      targetId: unit.id,
      kind: "FOG",
      text: `A névoa causou ${damage} de dano em ${unit.name} (${percent}% do HP máximo).`,
      amount: damage,
    });
    if (unit.hp <= 0)
      events.push({
        unitId: unit.id,
        targetId: unit.id,
        kind: "KO",
        text: `${unit.name} foi nocauteado pela névoa de combate.`,
      });
  }
  battle.lastEvents = events;
  battle.logs.push(
    `Rodada ${battle.round}`,
    ...events.map((event) => event.text),
  );
  battle.pendingA = null;
  battle.pendingB = null;
  for (const unit of all)
    unit.effects = unit.effects
      .map((effect) => ({ ...effect, duration: effect.duration - 1 }))
      .filter((effect) => effect.duration > 0);
  battle.round += 1;
  battle.deadline = nextTacticalDeadline();
  const remainingA = aliveA(),
    remainingB = aliveB();
  if (!remainingA.length || !remainingB.length || battle.round > 18) {
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
      biomes: createTacticalBiomes(match.id),
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
        banTurnId: null,
        bansByAIds: [],
        bansByBIds: [],
        banLimitA: 3,
        banLimitB: 3,
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
