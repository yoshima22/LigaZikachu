"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { TraceRouteType, TraceTarget } from "@prisma/client";
import { TRACE_EVENTS, GOLDEN_PAW_SHOP, type TraceEvent } from "./constants";
function createId() { return crypto.randomUUID(); }

// ── Constants ──────────────────────────────────────────────────────────────

const ROUTE_STEPS: Record<TraceRouteType, number> = {
  SHORT: 3,
  MEDIUM: 4,
  LONG: 5,
  WEEKLY: 6,
};

const ROUTE_EXPIRY_HOURS: Record<TraceRouteType, number> = {
  SHORT: 6,
  MEDIUM: 12,
  LONG: 24,
  WEEKLY: 168,
};

const DIRECTIONS = ["N", "S", "L", "O"] as const;
type Direction = (typeof DIRECTIONS)[number];

const GOLDEN_PAWS_REWARDS = {
  hunterWins: { hunter: 20, hider: 8 },
  hiderEscapes: { hider: 25, hunter: 5 },
  routeBonus: { SHORT: 1, MEDIUM: 1.25, LONG: 1.5, WEEKLY: 2 },
};

const MAP_ITEM_TO_ROUTE: Record<string, TraceRouteType> = {
  TRACE_MAP_SHORT: "SHORT",
  TRACE_MAP_MEDIUM: "MEDIUM",
  TRACE_MAP_LONG: "LONG",
  TRACE_MAP_WEEKLY: "WEEKLY",
  TRACE_SPECIAL_MAP: "LONG",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function generateRoutePath(steps: number): Direction[] {
  return Array.from({ length: steps }, () => DIRECTIONS[Math.floor(Math.random() * 4)]);
}

function calcFocus(steps: number, vitalityStat: number): number {
  return steps + Math.floor(vitalityStat / 20);
}

function rollRandomEvent(
  instinctStat: number,
  isHiderPerspective: boolean,
): TraceEvent | null {
  const baseChance = 0.30;
  if (Math.random() > baseChance) return null;

  const instinctBonus = instinctStat / 100; // 0–1 range modifier
  const events = [...TRACE_EVENTS];

  // Hider's instinct skews events in hider's favor; hunter's instinct skews toward reveal_hint
  const weighted = events.map((e) => {
    let weight = 1;
    if (isHiderPerspective && e.positiveForHider) weight += instinctBonus * 2;
    if (!isHiderPerspective && !e.positiveForHider) weight += instinctBonus * 2;
    return { e, weight };
  });

  const total = weighted.reduce((s, { weight }) => s + weight, 0);
  let roll = Math.random() * total;
  for (const { e, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return e;
  }
  return events[0];
}

async function applyEventEffect(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  room: { id: string; focusPoints: number },
  event: TraceEvent,
) {
  const updates: Record<string, unknown> = {};
  switch (event.effectType) {
    case "FOCUS_GAIN_HIDER":
      updates.focusPoints = Math.max(room.focusPoints, room.focusPoints) + 1;
      break;
    case "FOCUS_LOSS_HIDER":
      updates.focusPoints = Math.max(0, room.focusPoints - 1);
      break;
    case "SKIP_NEXT_MOVE":
      updates.skipNextMove = true;
      break;
    case "REVEAL_HINT":
      // Hint will be set by caller since we need routePath
      break;
    case "FLAVOR_ONLY":
      break;
  }
  if (Object.keys(updates).length > 0) {
    await tx.traceRoom.update({ where: { id: room.id }, data: updates as never });
  }
}

async function awardGoldenPaws(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  playerId: string,
  amount: number,
  reason: string,
) {
  await tx.player.update({ where: { id: playerId }, data: { goldenPaws: { increment: amount } } });
  await tx.goldenPawTransaction.create({
    data: { id: createId(), playerId, amount, reason },
  });
}

async function logGlobalEvent(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  roomId: string | null,
  playerName: string,
  description: string,
) {
  await tx.traceEventLog.create({
    data: { id: createId(), roomId, playerName, description },
  });
}

// ── Read action ────────────────────────────────────────────────────────────

export async function getTracePageDataAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const [myRooms, openRooms, globalHistory, myInventory, allMascots] = await Promise.all([
    // Salas onde o jogador participa (hider ou hunter), não finalizadas
    prisma.traceRoom.findMany({
      where: {
        OR: [{ hiderId: player.id }, { hunterId: player.id }],
        status: { in: ["WAITING", "HUNTING"] },
      },
      include: {
        hider: { select: { displayName: true } },
        hiderMascot: { select: { pokemonId: true, nickname: true, statVitality: true, statInstinct: true, statAgility: true } },
        hunter: { select: { displayName: true } },
        hunterMascot: { select: { pokemonId: true, nickname: true, statInstinct: true, statAgility: true } },
        moves: { orderBy: { createdAt: "asc" } },
        randomEvents: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Salas abertas aguardando caçador (não minhas)
    prisma.traceRoom.findMany({
      where: { status: "WAITING", hiderId: { not: player.id } },
      include: {
        hider: { select: { displayName: true } },
        hiderMascot: { select: { pokemonId: true, nickname: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Histórico global (últimas 10 entradas)
    prisma.traceEventLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // Inventário do jogador (itens de rastros)
    prisma.playerInventory.findMany({
      where: {
        playerId: player.id,
        item: {
          type: {
            in: [
              "TRACE_MAP_SHORT", "TRACE_MAP_MEDIUM", "TRACE_MAP_LONG", "TRACE_MAP_WEEKLY",
              "TRACE_HUNT_TICKET", "TRACE_SIGNAL_FLARE", "TRACE_DECOY", "TRACE_SILENCE_POTION",
              "TRACE_ARMOR_VEST", "TRACE_MIST_SHIELD", "TRACE_INSTINCT_BOOST",
              "TRACE_GOLDEN_TICKET", "TRACE_SPECIAL_MAP",
            ],
          },
        },
        quantity: { gt: 0 },
      },
      include: { item: { select: { type: true, name: true } } },
    }),
    // Mascotes disponíveis (FREE, não em expedição)
    prisma.mascot.findMany({
      where: {
        playerId: player.id,
        arenaState: "FREE",
        expeditions: { none: { status: "ACTIVE" } },
        buffs: { none: { type: "VACATION", expiresAt: { gt: new Date() } } },
      },
      select: { id: true, pokemonId: true, nickname: true, statInstinct: true, statAgility: true, statVitality: true, statForce: true, statCharisma: true, level: true },
      orderBy: { level: "desc" },
    }),
  ]);

  const fullPlayer = await prisma.player.findUnique({
    where: { id: player.id },
    select: { goldenPaws: true },
  });

  return {
    player: { id: player.id, displayName: player.displayName, goldenPaws: fullPlayer?.goldenPaws ?? 0 },
    myRooms,
    openRooms,
    globalHistory,
    myInventory,
    availableMascots: allMascots,
  };
}

// ── Create Hide Room ───────────────────────────────────────────────────────

export async function createTraceRoomAction(mascotId: string, routeType: TraceRouteType, bypassItem = false) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const mascot = await prisma.mascot.findFirst({
    where: { id: mascotId, playerId: player.id, arenaState: "FREE" },
  });
  if (!mascot) return { error: "Mascote não disponível" };

  // Check vacation/recovery
  const onVacation = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "VACATION", expiresAt: { gt: new Date() } },
  });
  if (onVacation) return { error: "Mascote em férias não pode participar" };

  const onExpedition = await prisma.mascotExpedition.findFirst({
    where: { mascotId, status: "ACTIVE" },
  });
  if (onExpedition) return { error: "Mascote em expedição não pode participar" };

  // Verify player has the map item (unless admin bypass)
  let mapInventoryId: string | null = null;
  if (!bypassItem) {
    const mapTypeNeeded = Object.entries(MAP_ITEM_TO_ROUTE).find(([, r]) => r === routeType)?.[0];
    if (!mapTypeNeeded) return { error: "Tipo de rota inválido" };

    const inv = await prisma.playerInventory.findFirst({
      where: {
        playerId: player.id,
        quantity: { gt: 0 },
        item: { type: mapTypeNeeded as never },
      },
    });
    if (!inv) return { error: "Você não possui um Mapa para este tipo de rota" };
    mapInventoryId = inv.id;
  }

  const steps = ROUTE_STEPS[routeType];
  const path = generateRoutePath(steps);
  const focus = calcFocus(steps, mascot.statVitality);
  const expiresAt = new Date(Date.now() + ROUTE_EXPIRY_HOURS[routeType] * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const room = await tx.traceRoom.create({
      data: {
        id: createId(),
        hiderId: player.id,
        hiderMascotId: mascotId,
        routeType,
        routePath: JSON.stringify(path),
        focusPoints: focus,
        maxFocus: focus,
        expiresAt,
        isAdminSim: bypassItem,
        updatedAt: new Date(),
      },
    });

    await tx.mascot.update({
      where: { id: mascotId },
      data: { arenaState: "TRACE_HIDING" },
    });

    if (mapInventoryId) {
      await tx.playerInventory.update({
        where: { id: mapInventoryId },
        data: { quantity: { decrement: 1 } },
      });
    }

    await logGlobalEvent(tx, room.id, player.displayName, `${player.displayName} abriu um esconderijo (rota ${routeType}).`);
  });

  revalidatePath("/combates/cacada-de-rastros");
  return { success: true };
}

// ── Join Hunt Room ─────────────────────────────────────────────────────────

export async function joinTraceRoomAction(roomId: string, mascotId: string, bypassItem = false) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const room = await prisma.traceRoom.findFirst({
    where: { id: roomId, status: "WAITING" },
  });
  if (!room) return { error: "Sala não encontrada ou já em andamento" };
  if (room.hiderId === player.id) return { error: "Você não pode caçar seu próprio esconderijo" };

  const mascot = await prisma.mascot.findFirst({
    where: { id: mascotId, playerId: player.id, arenaState: "FREE" },
  });
  if (!mascot) return { error: "Mascote não disponível" };

  const onVacation = await prisma.mascotBuff.findFirst({
    where: { mascotId, type: "VACATION", expiresAt: { gt: new Date() } },
  });
  if (onVacation) return { error: "Mascote em férias não pode participar" };

  const onExpedition = await prisma.mascotExpedition.findFirst({
    where: { mascotId, status: "ACTIVE" },
  });
  if (onExpedition) return { error: "Mascote em expedição não pode participar" };

  // Check hunt ticket
  let ticketInvId: string | null = null;
  if (!bypassItem) {
    const golden = await prisma.playerInventory.findFirst({
      where: { playerId: player.id, quantity: { gt: 0 }, item: { type: "TRACE_GOLDEN_TICKET" } },
    });
    const regular = await prisma.playerInventory.findFirst({
      where: { playerId: player.id, quantity: { gt: 0 }, item: { type: "TRACE_HUNT_TICKET" } },
    });
    const ticket = golden ?? regular;
    if (!ticket) return { error: "Você não possui um Ticket de Caçada" };
    ticketInvId = ticket.id;
  }

  await prisma.$transaction(async (tx) => {
    await tx.traceRoom.update({
      where: { id: roomId },
      data: {
        hunterId: player.id,
        hunterMascotId: mascotId,
        status: "HUNTING",
        lastHunterMoveAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await tx.mascot.update({ where: { id: mascotId }, data: { arenaState: "TRACE_HUNTING" } });

    if (ticketInvId) {
      await tx.playerInventory.update({
        where: { id: ticketInvId },
        data: { quantity: { decrement: 1 } },
      });
    }

    await logGlobalEvent(tx, roomId, player.displayName, `${player.displayName} entrou na caçada!`);
  });

  revalidatePath("/combates/cacada-de-rastros");
  return { success: true };
}

// ── Make Move ──────────────────────────────────────────────────────────────

const MOVE_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes

export async function makeTraceMoveAction(roomId: string, direction: Direction) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const room = await prisma.traceRoom.findFirst({
    where: { id: roomId, hunterId: player.id, status: "HUNTING" },
    include: {
      hider: { select: { displayName: true, id: true } },
      hunter: { select: { displayName: true, id: true } },
      hiderMascot: { select: { statInstinct: true, statAgility: true, statVitality: true } },
      hunterMascot: { select: { statInstinct: true, statAgility: true } },
    },
  });
  if (!room) return { error: "Sala não encontrada" };

  // Cooldown check
  if (room.lastHunterMoveAt && !room.isAdminSim) {
    const elapsed = Date.now() - room.lastHunterMoveAt.getTime();
    if (elapsed < MOVE_COOLDOWN_MS) {
      const remaining = Math.ceil((MOVE_COOLDOWN_MS - elapsed) / 1000);
      return { error: `Aguarde ${remaining}s antes do próximo movimento` };
    }
  }

  if (room.skipNextMove) {
    await prisma.traceRoom.update({
      where: { id: roomId },
      data: { skipNextMove: false, lastHunterMoveAt: new Date(), updatedAt: new Date() },
    });
    return { skipped: true, message: "Seu movimento foi bloqueado por um evento! Tente novamente." };
  }

  const routePath: Direction[] = JSON.parse(room.routePath);
  const correct = routePath[room.currentStep] === direction;

  let eventResult: TraceEvent | null = null;
  const newStep = correct ? room.currentStep + 1 : room.currentStep;
  const isFound = correct && newStep >= routePath.length;
  const isEscaped = !correct && room.focusPoints <= 1;

  await prisma.$transaction(async (tx) => {
    await tx.traceMove.create({
      data: { id: createId(), roomId, step: room.currentStep, direction, correct },
    });

    if (isFound) {
      // Hunter wins
      const bonus = GOLDEN_PAWS_REWARDS.routeBonus[room.routeType];
      const hunterPaws = Math.round(GOLDEN_PAWS_REWARDS.hunterWins.hunter * bonus);
      const hiderPaws = Math.round(GOLDEN_PAWS_REWARDS.hunterWins.hider * bonus);

      await tx.traceRoom.update({
        where: { id: roomId },
        data: { status: "FOUND", resolvedAt: new Date(), currentStep: newStep, lastHunterMoveAt: new Date(), updatedAt: new Date() },
      });
      await tx.mascot.update({ where: { id: room.hiderMascotId }, data: { arenaState: "FREE" } });
      await tx.mascot.update({ where: { id: room.hunterMascotId! }, data: { arenaState: "FREE" } });
      await awardGoldenPaws(tx, room.hunterId!, hunterPaws, `Caçada vitoriosa (${room.routeType})`);
      await awardGoldenPaws(tx, room.hiderId, hiderPaws, `Capturado na caçada (${room.routeType})`);
      await logGlobalEvent(tx, roomId, room.hunter!.displayName, `🏆 ${room.hunter!.displayName} encontrou o esconderijo de ${room.hider.displayName}! +${hunterPaws} 🐾`);
    } else if (isEscaped) {
      // Hider escapes due to no focus left
      const bonus = GOLDEN_PAWS_REWARDS.routeBonus[room.routeType];
      const hiderPaws = Math.round(GOLDEN_PAWS_REWARDS.hiderEscapes.hider * bonus);
      const hunterPaws = GOLDEN_PAWS_REWARDS.hiderEscapes.hunter;

      await tx.traceRoom.update({
        where: { id: roomId },
        data: { status: "ESCAPED", resolvedAt: new Date(), focusPoints: 0, lastHunterMoveAt: new Date(), updatedAt: new Date() },
      });
      await tx.mascot.update({ where: { id: room.hiderMascotId }, data: { arenaState: "FREE" } });
      await tx.mascot.update({ where: { id: room.hunterMascotId! }, data: { arenaState: "FREE" } });
      await awardGoldenPaws(tx, room.hiderId, hiderPaws, `Escapou da caçada (${room.routeType})`);
      await awardGoldenPaws(tx, room.hunterId!, hunterPaws, `Caçada perdida (${room.routeType})`);
      await logGlobalEvent(tx, roomId, room.hider.displayName, `💨 ${room.hider.displayName} escapou da caçada! +${hiderPaws} 🐾`);
    } else {
      // Game continues — roll for random event
      eventResult = rollRandomEvent(room.hiderMascot.statInstinct, true);
      let newFocus = correct ? room.focusPoints : Math.max(0, room.focusPoints - 1);
      const roomUpdates: Record<string, unknown> = {
        currentStep: newStep,
        focusPoints: newFocus,
        lastHunterMoveAt: new Date(),
        hintDirection: null,
        updatedAt: new Date(),
      };

      if (eventResult) {
        await tx.traceRoomEvent.create({
          data: {
            id: createId(),
            roomId,
            eventCode: eventResult.code,
            target: eventResult.target as TraceTarget,
            step: room.currentStep,
            effectApplied: true,
          },
        });

        if (eventResult.effectType === "FOCUS_GAIN_HIDER") {
          roomUpdates.focusPoints = newFocus + 1;
        } else if (eventResult.effectType === "FOCUS_LOSS_HIDER") {
          roomUpdates.focusPoints = Math.max(0, newFocus - 1);
        } else if (eventResult.effectType === "SKIP_NEXT_MOVE") {
          roomUpdates.skipNextMove = true;
        } else if (eventResult.effectType === "REVEAL_HINT") {
          const nextStep = newStep;
          if (nextStep < routePath.length) {
            roomUpdates.hintDirection = routePath[nextStep];
          }
        }

        await logGlobalEvent(tx, roomId, room.hunter!.displayName, `⚡ Evento: ${eventResult.label} — ${eventResult.description}`);
      }

      await tx.traceRoom.update({ where: { id: roomId }, data: roomUpdates as never });
    }
  });

  revalidatePath("/combates/cacada-de-rastros");
  const ev = eventResult as TraceEvent | null;
  return {
    success: true,
    correct,
    isFound,
    isEscaped,
    event: ev ? { label: ev.label, description: ev.description } : null,
  };
}

// ── Leave Room ─────────────────────────────────────────────────────────────

export async function leaveTraceRoomAction(roomId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const room = await prisma.traceRoom.findFirst({
    where: {
      id: roomId,
      OR: [{ hiderId: player.id }, { hunterId: player.id }],
      status: { in: ["WAITING", "HUNTING"] },
    },
  });
  if (!room) return { error: "Sala não encontrada" };

  await prisma.$transaction(async (tx) => {
    await tx.traceRoom.update({
      where: { id: roomId },
      data: { status: "CANCELLED", resolvedAt: new Date(), updatedAt: new Date() },
    });
    await tx.mascot.update({ where: { id: room.hiderMascotId }, data: { arenaState: "FREE" } });
    if (room.hunterMascotId) {
      await tx.mascot.update({ where: { id: room.hunterMascotId }, data: { arenaState: "FREE" } });
    }
    await logGlobalEvent(tx, roomId, player.displayName, `${player.displayName} abandonou a caçada.`);
  });

  revalidatePath("/combates/cacada-de-rastros");
  return { success: true };
}

// ── Use Sinalizador (free flare per room) ─────────────────────────────────

export async function useSinalizadorAction(roomId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const room = await prisma.traceRoom.findFirst({
    where: { id: roomId, hiderId: player.id, status: "HUNTING" },
  });
  if (!room) return { error: "Sala não encontrada" };
  if (room.sinalizadorUsed) return { error: "Sinalizador gratuito já usado nesta sala" };

  const routePath: Direction[] = JSON.parse(room.routePath);
  const hint = routePath[room.currentStep] ?? null;

  await prisma.traceRoom.update({
    where: { id: roomId },
    data: { sinalizadorUsed: true, hintDirection: hint, updatedAt: new Date() },
  });

  revalidatePath("/combates/cacada-de-rastros");
  return { success: true, hint };
}

// ── Admin: Grant Golden Paws ───────────────────────────────────────────────

export async function adminGrantGoldenPawsAction(targetPlayerId: string, amount: number) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  await prisma.$transaction(async (tx) => {
    await awardGoldenPaws(tx, targetPlayerId, amount, "Admin grant");
  });

  revalidatePath("/combates/cacada-de-rastros");
  return { success: true };
}

// ── Admin: Simulate Full Room ──────────────────────────────────────────────

export async function adminSimulateRoomAction(
  hiderMascotId: string,
  hunterMascotId: string,
  routeType: TraceRouteType,
) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const hiderMascot = await prisma.mascot.findFirst({ where: { id: hiderMascotId, playerId: player.id } });
  const hunterMascot = await prisma.mascot.findFirst({ where: { id: hunterMascotId, playerId: player.id } });
  if (!hiderMascot || !hunterMascot) return { error: "Mascotes não encontrados" };
  if (hiderMascotId === hunterMascotId) return { error: "Use mascotes diferentes para hider e hunter" };

  const steps = ROUTE_STEPS[routeType];
  const path = generateRoutePath(steps);
  const focus = calcFocus(steps, hiderMascot.statVitality);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    const room = await tx.traceRoom.create({
      data: {
        id: createId(),
        hiderId: player.id,
        hiderMascotId,
        hunterId: player.id,
        hunterMascotId,
        routeType,
        routePath: JSON.stringify(path),
        focusPoints: focus,
        maxFocus: focus,
        status: "HUNTING",
        lastHunterMoveAt: new Date(Date.now() - MOVE_COOLDOWN_MS),
        expiresAt,
        isAdminSim: true,
        updatedAt: new Date(),
      },
    });

    await tx.mascot.update({ where: { id: hiderMascotId }, data: { arenaState: "TRACE_HIDING" } });
    await tx.mascot.update({ where: { id: hunterMascotId }, data: { arenaState: "TRACE_HUNTING" } });
    await logGlobalEvent(tx, room.id, player.displayName, `[Simulação Admin] ${player.displayName} criou uma sala de teste.`);
  });

  revalidatePath("/combates/cacada-de-rastros");
  return { success: true };
}

// ── Admin: Seed shop items (disabled) ─────────────────────────────────────

export async function adminSeedTraceShopItemsAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const now = new Date();

  const items = [
    { type: "TRACE_MAP_SHORT",        name: "Mapa de Rota Curta",        description: "Abre um esconderijo de rota curta (3 passos).",           price: 150,  active: false },
    { type: "TRACE_MAP_MEDIUM",       name: "Mapa de Rota Média",        description: "Abre um esconderijo de rota média (4 passos).",           price: 300,  active: false },
    { type: "TRACE_MAP_LONG",         name: "Mapa de Rota Longa",        description: "Abre um esconderijo de rota longa (5 passos).",           price: 600,  active: false },
    { type: "TRACE_MAP_WEEKLY",       name: "Mapa de Rota Semanal",      description: "Abre um esconderijo semanal de alta recompensa (6 passos).", price: 1200, active: false },
    { type: "TRACE_HUNT_TICKET",      name: "Ticket de Caçada",          description: "Permite entrar como caçador em uma sala aberta.",         price: 120,  active: false },
    { type: "TRACE_SIGNAL_FLARE",     name: "Sinalizador de Rastro",     description: "Adiciona uma seta de pista visível ao caçador (loja Pegadas).", price: 0, active: false },
    { type: "TRACE_DECOY",            name: "Isca Falsa",                description: "Cria um rastro falso para confundir o caçador.",          price: 0,    active: false },
    { type: "TRACE_SILENCE_POTION",   name: "Poção do Silêncio",         description: "Desativa o próximo evento aleatório do escondido.",       price: 0,    active: false },
    { type: "TRACE_ARMOR_VEST",       name: "Colete de Armadura",        description: "O caçador sobrevive a 1 evento negativo.",                price: 0,    active: false },
    { type: "TRACE_MIST_SHIELD",      name: "Escudo de Neblina",         description: "O próximo passo errado do caçador não reduz o Foco.",     price: 0,    active: false },
    { type: "TRACE_INSTINCT_BOOST",   name: "Impulso de Instinto",       description: "Revela a direção correta do passo atual ao caçador.",     price: 0,    active: false },
    { type: "TRACE_GOLDEN_TICKET",    name: "Ticket Dourado",            description: "Entrada gratuita em qualquer caçada (substitui Ticket de Caçada).", price: 0, active: false },
    { type: "TRACE_SPECIAL_MAP",      name: "Mapa Especial",             description: "Abre uma rota Longa sem precisar comprar o Mapa de Rota Longa.", price: 0, active: false },
  ];

  let created = 0;
  for (const item of items) {
    const exists = await prisma.shopItem.findFirst({ where: { type: item.type as never } });
    if (!exists) {
      await prisma.shopItem.create({
        data: {
          id: createId(),
          type: item.type as never,
          name: item.name,
          description: item.description,
          price: item.price,
          active: item.active,
          createdAt: now,
          updatedAt: now,
        },
      });
      created++;
    }
  }

  revalidatePath("/combates/cacada-de-rastros");
  return { success: true, created };
}

// ── Buy Golden Paw item ────────────────────────────────────────────────────

export async function buyGoldenPawItemAction(itemType: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const basePlayer = await getSessionPlayer(session.user.id);
  if (!basePlayer) return { error: "Jogador não encontrado" };

  const shopEntry = GOLDEN_PAW_SHOP.find((e) => e.type === itemType);
  if (!shopEntry) return { error: "Item inválido" };

  const player = await prisma.player.findUnique({
    where: { id: basePlayer.id },
    select: { id: true, goldenPaws: true },
  });
  if (!player) return { error: "Jogador não encontrado" };

  if (player.goldenPaws < shopEntry.cost) {
    return { error: `Pegadas insuficientes. Você tem ${player.goldenPaws}, precisa de ${shopEntry.cost}.` };
  }

  // Find the ShopItem in DB
  const shopItem = await prisma.shopItem.findFirst({ where: { type: itemType as never } });
  if (!shopItem) return { error: "Item não configurado no sistema. Peça ao admin para executar o seed." };

  await prisma.$transaction(async (tx) => {
    await tx.player.update({
      where: { id: player.id },
      data: { goldenPaws: { decrement: shopEntry.cost } },
    });
    await tx.goldenPawTransaction.create({
      data: { id: createId(), playerId: player.id, amount: -shopEntry.cost, reason: `Compra: ${shopEntry.name}` },
    });
    await tx.playerInventory.upsert({
      where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } },
      create: { id: createId(), playerId: player.id, itemId: shopItem.id, quantity: 1, source: "GOLDEN_PAW_SHOP" },
      update: { quantity: { increment: 1 } },
    });
  });

  revalidatePath("/combates/cacada-de-rastros");
  return { success: true };
}
