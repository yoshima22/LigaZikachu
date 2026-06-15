import { Prisma, ShopItemRarity, SyncTicketSide } from "@prisma/client";

export const SYNC_TICKET_TYPES = {
  fireLeft: "SYNC_TICKET_FIRE_LEFT",
  waterRight: "SYNC_TICKET_WATER_RIGHT",
  complete: "SYNC_TICKET_COMPLETE",
} as const;

export type SyncTicketDropSource =
  | "arena-pve"
  | "arena-pvp"
  | "expedition-3h"
  | "expedition-6h"
  | "crafting-dust-recycle"
  | "tcg-match-win";

export const SYNC_TICKET_ITEMS = [
  {
    type: SYNC_TICKET_TYPES.fireLeft,
    side: SyncTicketSide.LEFT,
    name: "Metade Ticket de Desafio - Esquerda",
    description: "Metade esquerda de fogo. Nao pode ser usada por quem gerou; envie para outro jogador.",
    imageUrl: "/events/desafio-sincronizado/ticket-esquerda-fogo.png",
    rarity: ShopItemRarity.EPIC,
    price: 0,
    sortOrder: 910,
  },
  {
    type: SYNC_TICKET_TYPES.waterRight,
    side: SyncTicketSide.RIGHT,
    name: "Metade Ticket de Desafio - Direita",
    description: "Metade direita de agua. Nao pode ser usada por quem gerou; envie para outro jogador.",
    imageUrl: "/events/desafio-sincronizado/ticket-direita-agua.png",
    rarity: ShopItemRarity.EPIC,
    price: 0,
    sortOrder: 911,
  },
  {
    type: SYNC_TICKET_TYPES.complete,
    name: "Ticket Completo de Desafio",
    description: "Ticket completo formado por uma metade esquerda e uma direita. Bane automaticamente os dois geradores da sala criada.",
    imageUrl: "/events/desafio-sincronizado/ticket-completo-agua-fogo.png",
    rarity: ShopItemRarity.LEGENDARY,
    price: 0,
    sortOrder: 912,
  },
] as const;

export function getSideImage(side: SyncTicketSide) {
  return side === SyncTicketSide.LEFT
    ? "/events/desafio-sincronizado/ticket-esquerda-fogo.png"
    : "/events/desafio-sincronizado/ticket-direita-agua.png";
}

export function getSideLabel(side: SyncTicketSide) {
  return side === SyncTicketSide.LEFT ? "Esquerda de Fogo" : "Direita de Agua";
}

export async function ensureSyncChallengeItems(tx: Prisma.TransactionClient) {
  const items = [];
  for (const item of SYNC_TICKET_ITEMS) {
    const existing = await tx.shopItem.findFirst({
      where: { type: item.type as never, name: item.name },
      select: { id: true },
    });
    const data = {
      type: item.type as never,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      rarity: item.rarity,
      price: item.price,
      active: true,
      sortOrder: item.sortOrder,
    };
    items.push(existing
      ? await tx.shopItem.update({ where: { id: existing.id }, data, select: { id: true, type: true, name: true } })
      : await tx.shopItem.create({ data, select: { id: true, type: true, name: true } }));
  }
  return items;
}

export async function getSyncChallengeConfig(tx: Prisma.TransactionClient) {
  const existing = await tx.syncChallengeConfig.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return tx.syncChallengeConfig.create({ data: { id: "singleton" } });
}

function chanceForSource(config: Awaited<ReturnType<typeof getSyncChallengeConfig>>, source: SyncTicketDropSource) {
  if (!config.ticketsEnabled) return 0;
  switch (source) {
    case "arena-pve": return config.dropFromPve ? config.pveDropChance : 0;
    case "arena-pvp": return config.dropFromPvp ? config.pvpDropChance : 0;
    case "expedition-3h": return config.dropFromExpedition ? config.expedition3hDropChance : 0;
    case "expedition-6h": return config.dropFromExpedition ? config.expedition6hDropChance : 0;
    case "crafting-dust-recycle": return config.dropFromCraftingDustRecycle ? config.recycleDropChance : 0;
    case "tcg-match-win": return config.dropFromTcgMatch ? config.tcgWinDropChance : 0;
  }
}

export async function grantSyncTicketHalf(
  tx: Prisma.TransactionClient,
  playerId: string,
  sourceAction: SyncTicketDropSource | string,
  side: SyncTicketSide = Math.random() < 0.5 ? SyncTicketSide.LEFT : SyncTicketSide.RIGHT,
  generatedByPlayerId = playerId,
) {
  const half = await tx.syncTicketHalf.create({
    data: {
      side,
      ownerId: playerId,
      generatedByPlayerId,
      sourceAction,
      status: "AVAILABLE",
    },
    include: {
      owner: { select: { displayName: true } },
      generatedByPlayer: { select: { displayName: true } },
    },
  });
  await tx.auditLog.create({
    data: {
      entityType: "SyncTicketHalf",
      entityId: half.id,
      action: "GENERATED",
      after: { side, playerId, generatedByPlayerId, sourceAction },
    },
  }).catch(() => null);
  return half;
}

export async function maybeDropSyncTicket(
  tx: Prisma.TransactionClient,
  playerId: string,
  source: SyncTicketDropSource,
) {
  const config = await getSyncChallengeConfig(tx);
  const chance = chanceForSource(config, source);
  if (chance <= 0 || Math.random() >= chance) return null;
  return grantSyncTicketHalf(tx, playerId, source);
}

export async function transferSyncTicketHalf(
  tx: Prisma.TransactionClient,
  input: { halfId: string; fromPlayerId: string; toPlayerId: string },
) {
  if (input.fromPlayerId === input.toPlayerId) throw new Error("Escolha outro jogador.");
  const half = await tx.syncTicketHalf.findUnique({
    where: { id: input.halfId },
    include: { generatedByPlayer: { select: { displayName: true } } },
  });
  if (!half || half.ownerId !== input.fromPlayerId) throw new Error("Metade nao encontrada.");
  if (half.status !== "AVAILABLE" && half.status !== "SENT") throw new Error("Esta metade nao pode ser enviada.");

  const target = await tx.player.findUnique({ where: { id: input.toPlayerId }, select: { id: true, displayName: true } });
  if (!target) throw new Error("Jogador de destino nao encontrado.");

  const updated = await tx.syncTicketHalf.update({
    where: { id: half.id },
    data: { ownerId: target.id, status: "SENT", sentAt: new Date() },
    include: { generatedByPlayer: { select: { displayName: true } } },
  });
  await tx.playerGift.create({
    data: {
      playerId: target.id,
      type: "CUSTOM",
      title: "Metade de ticket recebida",
      description: `Voce recebeu uma metade ${getSideLabel(updated.side)} gerada por ${updated.generatedByPlayer.displayName}.`,
      payload: { rewardKind: "SYNC_TICKET_HALF", halfId: updated.id, side: updated.side },
    },
  });
  await tx.auditLog.create({
    data: {
      entityType: "SyncTicketHalf",
      entityId: half.id,
      action: "SENT",
      before: { ownerId: input.fromPlayerId },
      after: { ownerId: target.id },
    },
  }).catch(() => null);
  return updated;
}

export async function combineSyncTicketHalves(
  tx: Prisma.TransactionClient,
  input: { playerId: string; leftHalfId: string; rightHalfId: string },
) {
  if (input.leftHalfId === input.rightHalfId) throw new Error("Escolha duas metades diferentes.");
  const [left, right] = await Promise.all([
    tx.syncTicketHalf.findUnique({ where: { id: input.leftHalfId } }),
    tx.syncTicketHalf.findUnique({ where: { id: input.rightHalfId } }),
  ]);
  if (!left || !right) throw new Error("Metades nao encontradas.");
  if (left.ownerId !== input.playerId || right.ownerId !== input.playerId) throw new Error("Voce precisa possuir as duas metades.");
  if (left.status !== "AVAILABLE" && left.status !== "SENT") throw new Error("A metade esquerda nao esta disponivel.");
  if (right.status !== "AVAILABLE" && right.status !== "SENT") throw new Error("A metade direita nao esta disponivel.");
  if (left.side !== SyncTicketSide.LEFT || right.side !== SyncTicketSide.RIGHT) throw new Error("O ticket precisa de uma metade esquerda e uma direita.");
  if (left.generatedByPlayerId === input.playerId || right.generatedByPlayerId === input.playerId) {
    throw new Error("Voce nao pode usar metades geradas por voce mesmo.");
  }
  if (left.generatedByPlayerId === right.generatedByPlayerId) {
    throw new Error("As duas metades precisam ter geradores diferentes.");
  }

  const now = new Date();
  const ticket = await tx.syncTicket.create({
    data: {
      ownerId: input.playerId,
      leftHalfId: left.id,
      rightHalfId: right.id,
      bannedUserAId: left.generatedByPlayerId,
      bannedUserBId: right.generatedByPlayerId,
      status: "AVAILABLE",
    },
  });
  await tx.syncTicketHalf.updateMany({
    where: { id: { in: [left.id, right.id] } },
    data: { status: "COMBINED", combinedAt: now },
  });
  await tx.auditLog.create({
    data: {
      entityType: "SyncTicket",
      entityId: ticket.id,
      action: "COMBINED",
      after: {
        ownerId: input.playerId,
        leftHalfId: left.id,
        rightHalfId: right.id,
        bannedUserAId: left.generatedByPlayerId,
        bannedUserBId: right.generatedByPlayerId,
      },
    },
  }).catch(() => null);
  return ticket;
}

export async function grantValidSyncTicketForPlayer(tx: Prisma.TransactionClient, playerId: string) {
  const generators = await tx.player.findMany({
    where: { id: { not: playerId }, active: true, user: { status: "ACTIVE" } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  if (generators.length < 2) {
    throw new Error("E preciso ter pelo menos 2 outros jogadores ativos para gerar um ticket valido.");
  }
  const left = await grantSyncTicketHalf(tx, playerId, "admin-valid-ticket", SyncTicketSide.LEFT, generators[0].id);
  const right = await grantSyncTicketHalf(tx, playerId, "admin-valid-ticket", SyncTicketSide.RIGHT, generators[1].id);
  return combineSyncTicketHalves(tx, { playerId, leftHalfId: left.id, rightHalfId: right.id });
}

type SyncWindowConfig = {
  registrationOpensAt?: Date | string | null;
  registrationClosesAt?: Date | string | null;
  adminSimulationEnabled?: boolean | null;
};

function formatBrtDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getSyncWindowState(
  configOrNow?: SyncWindowConfig | Date,
  nowOrOptions?: Date | { admin?: boolean },
  maybeOptions?: { admin?: boolean },
) {
  const config = configOrNow instanceof Date ? undefined : configOrNow;
  const now = configOrNow instanceof Date ? configOrNow : nowOrOptions instanceof Date ? nowOrOptions : new Date();
  const options = configOrNow instanceof Date
    ? (nowOrOptions && !(nowOrOptions instanceof Date) ? nowOrOptions : maybeOptions)
    : maybeOptions;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  if (options?.admin && config?.adminSimulationEnabled) {
    return {
      isOpen: true,
      label: "Simulacao admin ativa",
      currentTime: time,
      simulation: true,
    };
  }
  const opensAt = config?.registrationOpensAt ? new Date(config.registrationOpensAt) : null;
  const closesAt = config?.registrationClosesAt ? new Date(config.registrationClosesAt) : null;
  if (opensAt || closesAt) {
    const opensOk = !opensAt || now >= opensAt;
    const closesOk = !closesAt || now <= closesAt;
    const isOpen = opensOk && closesOk;
    const label = !opensOk && opensAt
      ? `Abre em ${formatBrtDateTime(opensAt)} BRT`
      : closesOk && closesAt
        ? `Aberta ate ${formatBrtDateTime(closesAt)} BRT`
        : "Janela encerrada";
    return { isOpen, label, currentTime: time, simulation: false };
  }
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute;
  const opens = 14 * 60;
  const closes = 17 * 60;
  return {
    isOpen: total >= opens && total <= closes,
    label: total < opens ? "Abre hoje as 14:00 BRT" : total <= closes ? "Aberta ate 17:00 BRT" : "Fechada por hoje",
    currentTime: time,
    simulation: false,
  };
}

async function assertPlayerCanUseTicket(tx: Prisma.TransactionClient, playerId: string, ticketId: string) {
  const ticket = await tx.syncTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, ownerId: true, status: true, bannedUserAId: true, bannedUserBId: true },
  });
  if (!ticket || ticket.ownerId !== playerId) throw new Error("Ticket nao encontrado.");
  if (ticket.status !== "AVAILABLE") throw new Error("Ticket precisa estar disponivel.");
  if (ticket.bannedUserAId === playerId || ticket.bannedUserBId === playerId) {
    throw new Error("Voce esta banido pela origem deste ticket.");
  }
  const activeTeam = await tx.syncEventTeam.findFirst({
    where: {
      status: { in: ["OPEN", "COMPLETE"] },
      OR: [{ playerAId: playerId }, { playerBId: playerId }],
    },
    select: { id: true },
  });
  if (activeTeam) throw new Error("Voce ja esta em uma dupla ativa.");
  return ticket;
}

export async function createOpenSyncTeam(
  tx: Prisma.TransactionClient,
  playerId: string,
  ticketId: string,
  options: { adminBypass?: boolean } = {},
) {
  const config = await getSyncChallengeConfig(tx);
  if (!getSyncWindowState(config, new Date(), { admin: options.adminBypass }).isOpen) {
    throw new Error("A janela do Desafio Sincronizado nao esta aberta.");
  }
  await assertPlayerCanUseTicket(tx, playerId, ticketId);
  await tx.syncTicket.update({ where: { id: ticketId }, data: { status: "RESERVED" } });
  const team = await tx.syncEventTeam.create({
    data: { playerAId: playerId, ticketAId: ticketId, status: "OPEN" },
  });
  await tx.auditLog.create({
    data: { entityType: "SyncEventTeam", entityId: team.id, action: "OPEN_CREATED", after: { playerId, ticketId } },
  }).catch(() => null);
  return team;
}

export async function joinOpenSyncTeam(
  tx: Prisma.TransactionClient,
  playerId: string,
  teamId: string,
  ticketId: string,
  options: { adminBypass?: boolean } = {},
) {
  const config = await getSyncChallengeConfig(tx);
  if (!getSyncWindowState(config, new Date(), { admin: options.adminBypass }).isOpen) {
    throw new Error("A janela do Desafio Sincronizado nao esta aberta.");
  }
  await assertPlayerCanUseTicket(tx, playerId, ticketId);
  const team = await tx.syncEventTeam.findUnique({
    where: { id: teamId },
    include: { ticketA: { select: { bannedUserAId: true, bannedUserBId: true } } },
  });
  if (!team || team.status !== "OPEN" || team.playerBId) throw new Error("Dupla aberta nao encontrada.");
  if (team.playerAId === playerId) throw new Error("Voce ja e o criador desta dupla.");
  if (team.ticketA.bannedUserAId === playerId || team.ticketA.bannedUserBId === playerId) {
    throw new Error("Voce esta banido pela origem do ticket desta sala.");
  }
  await tx.syncTicket.update({ where: { id: ticketId }, data: { status: "RESERVED" } });
  const updated = await tx.syncEventTeam.update({
    where: { id: team.id },
    data: { playerBId: playerId, ticketBId: ticketId, status: "COMPLETE", completedAt: new Date() },
  });
  await tx.auditLog.create({
    data: { entityType: "SyncEventTeam", entityId: team.id, action: "JOINED", after: { playerId, ticketId } },
  }).catch(() => null);
  return updated;
}
