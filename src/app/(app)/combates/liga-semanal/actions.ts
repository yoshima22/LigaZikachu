"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAppSession, getSessionPlayer } from "@/lib/session";
import { isAdmin } from "@/lib/auth/permissions";
import { WEEKLY_MODIFIERS, LEAGUE_ITEMS } from "./constants";
import { toLeagueMascot, runLeagueCombat } from "@/lib/league-combat";
import type { WeeklyModifier } from "./constants";
import { EggType, GiftType, ZikaCoinTxType } from "@prisma/client";

function createId() { return crypto.randomUUID(); }

function getCurrentWeekKey() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { weekStart: monday, weekEnd: friday };
}

function getTodayBrt() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const PATH = "/combates/liga-semanal";

// ── Read action (client refresh) ──────────────────────────────────────────

export async function getLeagueDataAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const { getLeaguePageData } = await import("./data");
  const data = await getLeaguePageData(player.id, player.displayName, isAdmin(session.user.role));
  return JSON.parse(JSON.stringify(data));
}

// ── Create league ─────────────────────────────────────────────────────────

export async function createLeagueAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  try {
    const weekKey = getCurrentWeekKey();
    const { weekStart, weekEnd } = getWeekBounds();

    const existing = await prisma.weeklyMascotLeague.findUnique({ where: { weekKey } });
    if (existing) return { error: `Liga ${weekKey} já existe.` };

    await prisma.$transaction(async (tx) => {
      const league = await tx.weeklyMascotLeague.create({
        data: {
          id: createId(),
          weekKey,
          weekStart,
          weekEnd,
          status: "REGISTRATION",
          updatedAt: new Date(),
        },
      });

      const allPlayers = await tx.player.findMany({
        where: { active: true },
        select: { id: true },
      });

      for (const p of allPlayers) {
        await tx.weeklyMascotLeagueParticipant.create({
          data: {
            id: createId(),
            leagueId: league.id,
            playerId: p.id,
            updatedAt: new Date(),
          },
        });
      }
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao criar liga: ${String(err).slice(0, 200)}. A migration SQL 011 foi aplicada?` };
  }
}

// ── Join league ───────────────────────────────────────────────────────────

export async function joinLeagueAction(leagueId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const league = await prisma.weeklyMascotLeague.findFirst({
    where: { id: leagueId, status: { in: ["REGISTRATION", "ACTIVE"] } },
  });
  if (!league) return { error: "Liga não encontrada ou encerrada" };

  const existing = await prisma.weeklyMascotLeagueParticipant.findFirst({
    where: { leagueId, playerId: player.id },
  });
  if (existing) return { error: "Você já participa desta liga" };

  await prisma.weeklyMascotLeagueParticipant.create({
    data: { id: createId(), leagueId, playerId: player.id, updatedAt: new Date() },
  });

  revalidatePath(PATH);
  return { success: true };
}

// ── Save daily team ───────────────────────────────────────────────────────

export async function saveDailyTeamAction(
  leagueId: string,
  battleSlot: number,
  mascotIds: string[],
  roles: Record<string, string>,
) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  if (mascotIds.length !== 6) return { error: "Selecione exatamente 6 mascotes." };
  if (battleSlot < 1 || battleSlot > 3) return { error: "Slot inválido." };

  try {
    const today = getTodayBrt();

    const resolvedMatch = await prisma.weeklyMascotLeagueMatch.findFirst({
      where: { leagueId, battleDate: today, battleSlot },
      select: { id: true },
    });
    if (resolvedMatch) return { error: "Este combate ja aconteceu e o time esta travado." };

    // Check no mascot is used in other slots today
    const otherTeams = await prisma.weeklyMascotLeagueDailyTeam.findMany({
      where: { leagueId, playerId: player.id, battleDate: today, battleSlot: { not: battleSlot } },
    });
    const usedIds = new Set(otherTeams.flatMap(t => (t.mascotIdsJson as string[]) ?? []));
    const conflict = mascotIds.find(id => usedIds.has(id));
    if (conflict) return { error: "Um mascote já está em outro time de hoje. Mascotes não podem repetir no mesmo dia." };

    // Verify mascots belong to player
    const owned = await prisma.mascot.findMany({
      where: { id: { in: mascotIds }, playerId: player.id },
      select: { id: true },
    });
    if (owned.length !== 6) return { error: "Algum mascote selecionado não pertence a você." };

    await prisma.weeklyMascotLeagueDailyTeam.upsert({
      where: {
        leagueId_playerId_battleDate_battleSlot: {
          leagueId, playerId: player.id, battleDate: today, battleSlot,
        },
      },
      create: {
        id: createId(),
        leagueId,
        playerId: player.id,
        battleDate: today,
        battleSlot,
        mascotIdsJson: mascotIds,
        rolesJson: roles,
        lockedAt: new Date(),
        updatedAt: new Date(),
      },
      update: {
        mascotIdsJson: mascotIds,
        rolesJson: roles,
        lockedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao salvar time: ${String(err).slice(0, 200)}` };
  }
}

// ── Set modifier ──────────────────────────────────────────────────────────

export async function setModifierAction(leagueId: string, modifierId: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  const mod = WEEKLY_MODIFIERS.find(m => m.id === modifierId);
  if (!mod) return { error: "Modificador inválido" };

  try {
    await prisma.weeklyMascotLeague.update({
      where: { id: leagueId },
      data: { modifierJson: mod as unknown as any, status: "ACTIVE", updatedAt: new Date() },
    });
    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro: ${String(err).slice(0, 200)}` };
  }
}

// ── Simulate round ────────────────────────────────────────────────────────

export async function simulateRoundAction(leagueId: string, battleSlot: number, automationSecret?: string) {
  const session = await getAppSession();
  const automated = Boolean(process.env.CRON_SECRET && automationSecret === process.env.CRON_SECRET);
  if (!automated && !session?.user) return { error: "Não autenticado" };
  if (!automated && !isAdmin(session!.user.role)) return { error: "Acesso restrito" };

  try {
  const league = await prisma.weeklyMascotLeague.findFirst({
    where: { id: leagueId, status: "ACTIVE" },
  });
  if (!league) return { error: "Liga não ativa" };

  const participants = await prisma.weeklyMascotLeagueParticipant.findMany({
    where: { leagueId },
    orderBy: [{ points: "desc" }, { wins: "desc" }],
  });

  if (participants.length < 2) return { error: "Precisa de pelo menos 2 participantes" };

  const today = getTodayBrt();
  const existingMatches = await prisma.weeklyMascotLeagueMatch.findMany({
    where: { leagueId, battleDate: today, battleSlot },
  });
  if (existingMatches.length > 0) return { error: `Slot ${battleSlot} de hoje já foi simulado` };

  const roundNumber = await prisma.weeklyMascotLeagueMatch.count({ where: { leagueId } }) + 1;
  const modifier = league.modifierJson as unknown as WeeklyModifier | null;

  // Swiss pairing: pair by proximity in standings
  const paired = new Set<string>();
  const pairings: Array<{ aId: string; bId: string | null }> = [];

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    if (paired.has(p.playerId)) continue;

    let opponent: typeof p | null = null;
    for (let j = i + 1; j < participants.length; j++) {
      if (!paired.has(participants[j].playerId)) {
        opponent = participants[j];
        break;
      }
    }

    if (opponent) {
      pairings.push({ aId: p.playerId, bId: opponent.playerId });
      paired.add(p.playerId);
      paired.add(opponent.playerId);
    } else {
      pairings.push({ aId: p.playerId, bId: null });
      paired.add(p.playerId);
    }
  }

  // Run all matches
  for (const pair of pairings) {
    if (!pair.bId) {
      // BYE
      await prisma.weeklyMascotLeagueMatch.create({
        data: {
          id: createId(),
          leagueId,
          roundNumber,
          battleDate: today,
          battleSlot,
          scheduledAt: new Date(),
          playerAId: pair.aId,
          status: "BYE",
          resolvedAt: new Date(),
        },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: pair.aId },
        data: { points: { increment: 3 }, byes: { increment: 1 }, updatedAt: new Date() },
      });
      continue;
    }

    // Load daily teams (manual) or fallback to auto-select
    async function loadTeam(playerId: string) {
      const dailyTeam = await prisma.weeklyMascotLeagueDailyTeam.findUnique({
        where: { leagueId_playerId_battleDate_battleSlot: { leagueId, playerId, battleDate: today, battleSlot } },
      });

      if (dailyTeam) {
        const ids = dailyTeam.mascotIdsJson as string[];
        const roles = (dailyTeam.rolesJson as Record<string, string>) ?? {};
        const mascots = await prisma.mascot.findMany({ where: { id: { in: ids }, playerId } });
        const ordered = ids.map(id => mascots.find(m => m.id === id)).filter(Boolean);
        return ordered.map((m, i) => toLeagueMascot(m!, i + 1, roles[m!.id]));
      }

      // Auto-fill: favorites first, then by level
      const favs = await prisma.mascot.findMany({
        where: { playerId, isFavorite: true },
        orderBy: { level: "desc" },
        take: 6,
      });
      if (favs.length >= 6) return favs.slice(0, 6).map((m, i) => toLeagueMascot(m, i + 1));

      const usedIds = new Set(favs.map(m => m.id));
      const rest = await prisma.mascot.findMany({
        where: { playerId, id: { notIn: [...usedIds] } },
        orderBy: { level: "desc" },
        take: 6 - favs.length,
      });
      const all = [...favs, ...rest];
      return all.map((m, i) => toLeagueMascot(m, i + 1));
    }

    // Load items for each player
    async function loadItems(playerId: string) {
      const battleItems = await prisma.weeklyMascotLeagueBattleItem.findMany({
        where: { leagueId, playerId, battleDate: today, battleSlot, consumedAt: null, refundedAt: null },
      });
      return battleItems.map(bi => LEAGUE_ITEMS.find(li => li.type === bi.effectType)).filter(Boolean) as typeof LEAGUE_ITEMS;
    }

    const [teamAMascots, teamBMascots] = await Promise.all([loadTeam(pair.aId), loadTeam(pair.bId!)]);

    if (teamAMascots.length < 6 || teamBMascots.length < 6) {
      const woPlayer = teamAMascots.length < 6 ? pair.aId : pair.bId!;
      const winPlayer = woPlayer === pair.aId ? pair.bId! : pair.aId;
      await prisma.weeklyMascotLeagueMatch.create({
        data: {
          id: createId(), leagueId, roundNumber, battleDate: today, battleSlot,
          scheduledAt: new Date(), playerAId: pair.aId, playerBId: pair.bId,
          winnerId: winPlayer, loserId: woPlayer, status: "WO", resolvedAt: new Date(),
        },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: winPlayer },
        data: { points: { increment: 3 }, wins: { increment: 1 }, updatedAt: new Date() },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: woPlayer },
        data: { woLosses: { increment: 1 }, updatedAt: new Date() },
      });
      continue;
    }

    const [itemsA, itemsB] = await Promise.all([loadItems(pair.aId), loadItems(pair.bId!)]);
    const result = runLeagueCombat(teamAMascots, teamBMascots, modifier, itemsA, itemsB);

    const winnerId = result.winner === "A" ? pair.aId : result.winner === "B" ? pair.bId : null;
    const loserId = result.winner === "A" ? pair.bId : result.winner === "B" ? pair.aId : null;

    await prisma.weeklyMascotLeagueMatch.create({
      data: {
        id: createId(), leagueId, roundNumber, battleDate: today, battleSlot,
        scheduledAt: new Date(), playerAId: pair.aId, playerBId: pair.bId,
        winnerId, loserId, isDraw: result.winner === "DRAW",
        playerASurvivors: result.teamASurvivors, playerBSurvivors: result.teamBSurvivors,
        playerADamageDealt: result.teamADamageDealt, playerBDamageDealt: result.teamBDamageDealt,
        playerADamageTaken: result.teamADamageTaken, playerBDamageTaken: result.teamBDamageTaken,
        resultJson: { winner: result.winner, rounds: result.rounds },
        replayJson: result.log as unknown as any,
        status: "RESOLVED", resolvedAt: new Date(),
      },
    });

    await prisma.weeklyMascotLeagueBattleItem.updateMany({
      where: { leagueId, battleDate: today, battleSlot, playerId: { in: [pair.aId, pair.bId!] }, consumedAt: null, refundedAt: null },
      data: { consumedAt: new Date() },
    });

    // Update participant stats
    if (result.winner === "DRAW") {
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: pair.aId },
        data: { points: { increment: 1 }, draws: { increment: 1 }, damageDealt: { increment: result.teamADamageDealt }, damageTaken: { increment: result.teamADamageTaken }, survivorsScore: { increment: result.teamASurvivors }, updatedAt: new Date() },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: pair.bId },
        data: { points: { increment: 1 }, draws: { increment: 1 }, damageDealt: { increment: result.teamBDamageDealt }, damageTaken: { increment: result.teamBDamageTaken }, survivorsScore: { increment: result.teamBSurvivors }, updatedAt: new Date() },
      });
    } else {
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: winnerId! },
        data: { points: { increment: 3 }, wins: { increment: 1 }, damageDealt: { increment: winnerId === pair.aId ? result.teamADamageDealt : result.teamBDamageDealt }, damageTaken: { increment: winnerId === pair.aId ? result.teamADamageTaken : result.teamBDamageTaken }, survivorsScore: { increment: winnerId === pair.aId ? result.teamASurvivors : result.teamBSurvivors }, updatedAt: new Date() },
      });
      await prisma.weeklyMascotLeagueParticipant.updateMany({
        where: { leagueId, playerId: loserId! },
        data: { losses: { increment: 1 }, damageDealt: { increment: loserId === pair.aId ? result.teamADamageDealt : result.teamBDamageDealt }, damageTaken: { increment: loserId === pair.aId ? result.teamADamageTaken : result.teamBDamageTaken }, survivorsScore: { increment: loserId === pair.aId ? result.teamASurvivors : result.teamBSurvivors }, updatedAt: new Date() },
      });
    }
  }

  revalidatePath(PATH);
  return { success: true, matches: pairings.length };
  } catch (err) {
    return { error: `Erro na simulação: ${String(err).slice(0, 200)}` };
  }
}

// ── Seed shop items ───────────────────────────────────────────────────────

export async function seedLeagueItemsAction() {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  if (!isAdmin(session.user.role)) return { error: "Acesso restrito" };

  try {
    const now = new Date();
    let created = 0;

    for (const item of LEAGUE_ITEMS) {
      const exists = await prisma.shopItem.findFirst({ where: { type: item.type as never } });
      if (!exists) {
        await prisma.shopItem.create({
          data: {
            id: createId(),
            type: item.type as never,
            name: item.name,
            description: item.description,
            price: item.price,
            active: false,
            createdAt: now,
            updatedAt: now,
          },
        });
        created++;
      }
    }

    revalidatePath(PATH);
    revalidatePath(PATH);
    return { success: true, created };
  } catch (err) {
    return { error: `Erro ao criar itens: ${String(err).slice(0, 200)}` };
  }
}

// ── Buy league item ───────────────────────────────────────────────────────

export async function buyLeagueItemAction(itemType: string) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Não autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador não encontrado" };

  const def = LEAGUE_ITEMS.find(i => i.type === itemType);
  if (!def) return { error: "Item inválido" };

  try {
    const shopItem = await prisma.shopItem.findFirst({ where: { type: itemType as never } });
    if (!shopItem) return { error: "Item não existe no banco. Execute o Seed primeiro." };

    const wallet = await prisma.zikaCoinWallet.findUnique({ where: { playerId: player.id } });
    if (!wallet || wallet.balance < def.price) {
      return { error: `ZikaCoins insuficientes. Você tem ${wallet?.balance ?? 0} ZC, precisa de ${def.price} ZC.` };
    }

    await prisma.$transaction(async (tx) => {
      await tx.zikaCoinWallet.update({
        where: { playerId: player.id },
        data: { balance: { decrement: def.price }, totalSpent: { increment: def.price }, updatedAt: new Date() },
      });
      await tx.playerInventory.upsert({
        where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } },
        create: { id: createId(), playerId: player.id, itemId: shopItem.id, quantity: 1, source: "LEAGUE_SHOP" },
        update: { quantity: { increment: 1 } },
      });
    });

    revalidatePath(PATH);
    return { success: true };
  } catch (err) {
    return { error: `Erro ao comprar: ${String(err).slice(0, 200)}` };
  }
}

export async function selectBattleItemsAction(leagueId: string, battleSlot: number, itemTypes: string[]) {
  const session = await getAppSession();
  if (!session?.user) return { error: "Nao autenticado" };
  const player = await getSessionPlayer(session.user.id);
  if (!player) return { error: "Jogador nao encontrado" };
  if (battleSlot < 1 || battleSlot > 3) return { error: "Combate invalido" };
  if (itemTypes.length > 2 || new Set(itemTypes).size !== itemTypes.length) return { error: "Escolha ate 2 itens diferentes" };
  if (itemTypes.some((type) => !LEAGUE_ITEMS.some((item) => item.type === type))) return { error: "Item invalido" };

  const battleDate = getTodayBrt();
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.weeklyMascotLeagueBattleItem.findMany({ where: { leagueId, playerId: player.id, battleDate, battleSlot, consumedAt: null } });
      for (const previous of existing) {
        const inventory = await tx.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: previous.itemId } } });
        if (inventory) await tx.playerInventory.update({ where: { id: inventory.id }, data: { quantity: { increment: 1 } } });
      }
      await tx.weeklyMascotLeagueBattleItem.deleteMany({ where: { leagueId, playerId: player.id, battleDate, battleSlot, consumedAt: null } });

      for (const type of itemTypes) {
        const definition = LEAGUE_ITEMS.find((item) => item.type === type)!;
        const shopItem = await tx.shopItem.findFirst({ where: { type: type as never }, select: { id: true } });
        if (!shopItem) throw new Error(`${definition.name} nao foi cadastrado`);
        const inventory = await tx.playerInventory.findUnique({ where: { playerId_itemId: { playerId: player.id, itemId: shopItem.id } } });
        if (!inventory || inventory.quantity < 1) throw new Error(`Voce nao possui ${definition.name}`);
        await tx.playerInventory.update({ where: { id: inventory.id }, data: { quantity: { decrement: 1 } } });
        await tx.weeklyMascotLeagueBattleItem.create({ data: { id: createId(), leagueId, playerId: player.id, itemId: shopItem.id, effectType: type, targetType: definition.targetType, battleDate, battleSlot } });
      }
    });
    revalidatePath(PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error instanceof Error ? error.message : error).slice(0, 160) };
  }
}

const WEEKLY_BOX_POOL = [
  { kind: "EGG", eggType: EggType.RARE, label: "Ovo Raro", weight: 34 },
  { kind: "EGG", eggType: EggType.EVENT, label: "Ovo de Evento", weight: 24 },
  { kind: "ITEM", itemType: "MASCOT_BUFF_LUCK", label: "Amuleto da Sorte", weight: 20 },
  { kind: "ITEM", itemType: "MASCOT_BUFF_EXP", label: "Vitamina Chocante", weight: 16 },
  { kind: "EGG", eggType: EggType.SPECIAL, label: "Ovo Especial", weight: 6 },
] as const;

function drawWeeklyBoxReward() {
  const roll = Math.random() * 100;
  let cursor = 0;
  return WEEKLY_BOX_POOL.find((reward) => (cursor += reward.weight) > roll) ?? WEEKLY_BOX_POOL[0];
}

function weeklyCoinsForRank(rank: number) {
  if (rank === 4) return 700;
  if (rank === 5) return 600;
  if (rank === 6) return 500;
  if (rank <= 10) return 400;
  if (rank <= 15) return 300;
  return 200;
}

export async function finalizeLeagueAction(leagueId: string, automationSecret?: string) {
  const session = await getAppSession();
  const automated = Boolean(process.env.CRON_SECRET && automationSecret === process.env.CRON_SECRET);
  if (!automated && (!session?.user || !isAdmin(session.user.role))) return { error: "Acesso restrito" };

  try {
    const participants = await prisma.weeklyMascotLeagueParticipant.findMany({
      where: { leagueId },
      orderBy: [{ points: "desc" }, { wins: "desc" }, { survivorsScore: "desc" }, { damageDealt: "desc" }],
    });
    if (!participants.length) return { error: "Liga sem participantes." };

    let granted = 0;
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < participants.length; index++) {
        const participant = participants[index];
        if (participant.rewardGranted) continue;
        const matchesPlayed = participant.wins + participant.losses + participant.draws + participant.woLosses + participant.byes;
        if (matchesPlayed === 0) continue;

        const rank = index + 1;
        const claimed = await tx.weeklyMascotLeagueParticipant.updateMany({
          where: { id: participant.id, rewardGranted: false },
          data: { finalRank: rank, rewardGranted: true },
        });
        if (claimed.count === 0) continue;
        const boxItems = rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0;
        await tx.playerGift.create({
          data: {
            playerId: participant.playerId,
            type: GiftType.CUSTOM,
            title: "Liga Semanal: Ovo de Evento",
            description: `Premio de participacao valida - ${rank}o lugar.`,
            payload: { rewardKind: "MASCOT_EGG", eggType: EggType.EVENT, origin: `liga-semanal:${leagueId}` },
          },
        });

        for (let boxIndex = 0; boxIndex < boxItems; boxIndex++) {
          const reward = drawWeeklyBoxReward();
          await tx.playerGift.create({
            data: {
              playerId: participant.playerId,
              type: GiftType.CUSTOM,
              title: `Caixa Surpresa: ${reward.label}`,
              description: `Conteudo da caixa do ${rank}o lugar da Liga Semanal.`,
              payload: reward.kind === "EGG"
                ? { rewardKind: "MASCOT_EGG", eggType: reward.eggType, origin: `liga-semanal-caixa:${leagueId}` }
                : { rewardKind: "MASCOT_BUFF", buffType: reward.itemType, quantity: 1 },
            },
          });
        }

        if (rank > 3) {
          const coins = weeklyCoinsForRank(rank);
          const wallet = await tx.zikaCoinWallet.upsert({ where: { playerId: participant.playerId }, create: { playerId: participant.playerId }, update: {} });
          await tx.zikaCoinTransaction.create({
            data: { walletId: wallet.id, type: ZikaCoinTxType.PARTICIPATION_REWARD, amount: coins, balanceBefore: wallet.balance, balanceAfter: wallet.balance + coins, description: `Liga Semanal - ${rank}o lugar` },
          });
          await tx.zikaCoinWallet.update({ where: { id: wallet.id }, data: { balance: { increment: coins }, totalEarned: { increment: coins } } });
        }

        granted++;
      }
      await tx.weeklyMascotLeague.update({ where: { id: leagueId }, data: { status: "FINISHED", championPlayerId: participants[0].playerId } });
    });

    revalidatePath(PATH);
    revalidatePath("/caixa-de-presentes");
    return { success: true, granted };
  } catch (error) {
    return { error: `Falha ao encerrar: ${String(error).slice(0, 180)}` };
  }
}

export async function runWeeklyLeagueAutomation(automationSecret: string, nowIso?: string) {
  if (!process.env.CRON_SECRET || automationSecret !== process.env.CRON_SECRET) return { error: "Acesso restrito" };

  const now = nowIso ? new Date(nowIso) : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = value("weekday");
  const minuteOfDay = Number(value("hour")) * 60 + Number(value("minute"));
  if (!new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]).has(weekday)) return { success: true, skipped: "weekend" };

  const weekKey = getCurrentWeekKey();
  let league = await prisma.weeklyMascotLeague.findUnique({ where: { weekKey } });
  if (!league) {
    const { weekStart, weekEnd } = getWeekBounds();
    league = await prisma.$transaction(async (tx) => {
      const created = await tx.weeklyMascotLeague.create({ data: { id: createId(), weekKey, weekStart, weekEnd, status: "REGISTRATION", updatedAt: now } });
      const players = await tx.player.findMany({ where: { active: true }, select: { id: true } });
      if (players.length) await tx.weeklyMascotLeagueParticipant.createMany({ data: players.map((player) => ({ id: createId(), leagueId: created.id, playerId: player.id, updatedAt: now })), skipDuplicates: true });
      return created;
    });
  }
  if (league.status === "FINISHED") return { success: true, skipped: "finished" };

  const battleDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const storedModifier = (league.modifierJson ?? {}) as Record<string, unknown>;
  if (storedModifier.dailyDate !== battleDate) {
    const history = Array.isArray(storedModifier.dailyHistory) ? storedModifier.dailyHistory.filter((id): id is string => typeof id === "string") : [];
    const available = WEEKLY_MODIFIERS.filter((modifier) => !history.includes(modifier.id));
    const pool = available.length ? available : WEEKLY_MODIFIERS;
    const seed = [...battleDate].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const modifier = pool[seed % pool.length];
    const dailyHistory = [...history, modifier.id].slice(-5);
    league = await prisma.weeklyMascotLeague.update({
      where: { id: league.id },
      data: { status: "ACTIVE", modifierJson: { ...modifier, dailyDate: battleDate, dailyHistory }, updatedAt: now },
    });
  } else if (league.status === "REGISTRATION") {
    league = await prisma.weeklyMascotLeague.update({ where: { id: league.id }, data: { status: "ACTIVE" } });
  }

  let dueSlots = [
    { slot: 1, minute: 20 * 60 },
    { slot: 2, minute: 20 * 60 + 10 },
    { slot: 3, minute: 20 * 60 + 20 },
  ].filter((entry) => minuteOfDay >= entry.minute);

  if (dueSlots.length) {
    const completedSlots = await prisma.weeklyMascotLeagueMatch.findMany({
      where: { leagueId: league.id, battleDate, battleSlot: { in: dueSlots.map((entry) => entry.slot) } },
      select: { battleSlot: true },
      distinct: ["battleSlot"],
    });
    const completed = new Set(completedSlots.map((match) => match.battleSlot));
    dueSlots = dueSlots.filter((entry) => !completed.has(entry.slot));
  }

  if (dueSlots.length) {
    const participants = await prisma.weeklyMascotLeagueParticipant.findMany({ where: { leagueId: league.id }, select: { playerId: true } });
    const playerIds = participants.map((participant) => participant.playerId);
    const [existingTeams, mascots] = await Promise.all([
      prisma.weeklyMascotLeagueDailyTeam.findMany({ where: { leagueId: league.id, battleDate, playerId: { in: playerIds } }, select: { playerId: true, battleSlot: true, mascotIdsJson: true } }),
      prisma.mascot.findMany({ where: { playerId: { in: playerIds } }, select: { id: true, playerId: true, isFavorite: true, level: true }, orderBy: [{ isFavorite: "desc" }, { level: "desc" }] }),
    ]);
    const teamKey = new Set(existingTeams.map((team) => `${team.playerId}:${team.battleSlot}`));
    const usedByPlayer = new Map<string, Set<string>>();
    for (const team of existingTeams) {
      const used = usedByPlayer.get(team.playerId) ?? new Set<string>();
      for (const id of (team.mascotIdsJson as string[])) used.add(id);
      usedByPlayer.set(team.playerId, used);
    }
    const mascotsByPlayer = new Map<string, typeof mascots>();
    for (const mascot of mascots) mascotsByPlayer.set(mascot.playerId, [...(mascotsByPlayer.get(mascot.playerId) ?? []), mascot]);

    await prisma.$transaction(async (tx) => {
      for (const participant of participants) {
        const used = usedByPlayer.get(participant.playerId) ?? new Set<string>();
        for (const { slot } of dueSlots) {
          if (teamKey.has(`${participant.playerId}:${slot}`)) continue;
          const selected = (mascotsByPlayer.get(participant.playerId) ?? []).filter((mascot) => !used.has(mascot.id)).slice(0, 6);
          for (const mascot of selected) used.add(mascot.id);
          await tx.weeklyMascotLeagueDailyTeam.create({ data: { id: createId(), leagueId: league!.id, playerId: participant.playerId, battleDate, battleSlot: slot, source: "AUTO_FAVORITE", mascotIdsJson: selected.map((mascot) => mascot.id), rolesJson: {}, lockedAt: now, updatedAt: now } });
        }
      }
    });
  }

  const results = [];
  for (const { slot } of dueSlots) results.push({ slot, result: await simulateRoundAction(league.id, slot, automationSecret) });

  let finalized: unknown = null;
  if (weekday === "Fri" && minuteOfDay >= 20 * 60 + 30) finalized = await finalizeLeagueAction(league.id, automationSecret);
  return { success: true, leagueId: league.id, battleDate, modifier: (league.modifierJson as Record<string, unknown>)?.id, results, finalized };
}
