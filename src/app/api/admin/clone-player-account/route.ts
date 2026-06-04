import { NextResponse } from "next/server";
import { Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";

const COPY_GROUPS = new Set([
  "wallet",
  "inventory",
  "album",
  "mascots",
  "gifts",
  "codes",
  "tournaments",
  "decks",
  "achievements",
  "badges",
  "zikaloot",
  "zikabet"
]);

function normalizeGroups(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map(String).filter((group) => COPY_GROUPS.has(group));
}

function cloneNick(nick: string | null, fallback: string) {
  const base = (nick || fallback).replace(/\s+/g, "").slice(0, 44) || "Clone";
  return `${base}-clone`;
}

async function getCounts(playerId: string) {
  const [
    wallet,
    walletTransactions,
    inventory,
    stickers,
    mascots,
    eggs,
    foods,
    gifts,
    codes,
    registrations,
    decks,
    savedDecks,
    achievements,
    badges,
    zikaloot,
    zikabet,
    matchesA,
    matchesB,
    confirmations
  ] = await Promise.all([
    prisma.zikaCoinWallet.findUnique({ where: { playerId }, select: { balance: true, totalEarned: true, totalSpent: true } }),
    prisma.zikaCoinTransaction.count({ where: { wallet: { playerId } } }),
    prisma.playerInventory.count({ where: { playerId } }),
    prisma.playerSticker.count({ where: { playerId } }),
    prisma.mascot.count({ where: { playerId } }),
    prisma.mascotEgg.count({ where: { playerId } }),
    prisma.mascotFoodItem.count({ where: { playerId } }),
    prisma.playerGift.count({ where: { playerId } }),
    prisma.codeDistribution.count({ where: { playerId } }),
    prisma.tournamentRegistration.count({ where: { playerId } }),
    prisma.deckSubmission.count({ where: { playerId } }),
    prisma.savedDeck.count({ where: { playerId } }),
    prisma.playerAchievement.count({ where: { playerId } }),
    prisma.playerBadge.count({ where: { playerId } }),
    prisma.zikaLootPick.count({ where: { playerId } }),
    prisma.zikaBet.count({ where: { playerId } }),
    prisma.match.count({ where: { playerAId: playerId } }),
    prisma.match.count({ where: { playerBId: playerId } }),
    prisma.matchConfirmation.count({ where: { playerId } })
  ]);

  return {
    wallet,
    walletTransactions,
    inventory,
    stickers,
    mascots,
    eggs,
    foods,
    gifts,
    codes,
    registrations,
    decks,
    savedDecks,
    achievements,
    badges,
    zikaloot,
    zikabet,
    officialMatchRefs: {
      playerA: matchesA,
      playerB: matchesB,
      confirmations
    }
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const sourceNick = typeof body.sourceNick === "string" ? body.sourceNick.trim() : "Hitto23";
  const sourceName = typeof body.sourceName === "string" ? body.sourceName.trim() : "Rodrigo";
  const targetEmail = typeof body.targetEmail === "string" ? body.targetEmail.trim().toLowerCase() : "";
  const targetPassword = typeof body.targetPassword === "string" ? body.targetPassword : "";
  const targetDisplayName = typeof body.targetDisplayName === "string" && body.targetDisplayName.trim()
    ? body.targetDisplayName.trim()
    : `${sourceName} Clone`;
  const groups = normalizeGroups(body.groups);
  const apply = body.apply === true;

  const source = await prisma.player.findFirst({
    where: {
      OR: [
        { ptcglNick: { equals: sourceNick, mode: "insensitive" } },
        { displayName: { equals: sourceName, mode: "insensitive" } }
      ]
    },
    include: { user: true }
  });

  if (!source?.user) {
    return NextResponse.json({ error: "Jogador origem ou usuario origem nao encontrado." }, { status: 404 });
  }

  const sourceCounts = await getCounts(source.id);

  if (!apply) {
    return NextResponse.json({
      dryRun: true,
      message: "Diagnostico concluido. Nada foi alterado.",
      source: {
        playerId: source.id,
        userId: source.userId,
        displayName: source.displayName,
        ptcglNick: source.ptcglNick,
        email: source.user.email,
        status: source.user.status,
        counts: sourceCounts
      },
      requestedGroups: groups,
      availableGroups: [...COPY_GROUPS],
      note: "Partidas oficiais nao sao duplicadas para evitar pontuacao dobrada. Inscricoes/decks podem ser copiados em tournaments/decks."
    });
  }

  if (!targetEmail) {
    return NextResponse.json({ error: "Informe targetEmail." }, { status: 400 });
  }
  if (targetPassword.length < 8) {
    return NextResponse.json({ error: "Informe targetPassword com pelo menos 8 caracteres." }, { status: 400 });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (existingEmail) {
    return NextResponse.json({ error: "Ja existe usuario com targetEmail." }, { status: 409 });
  }

  const passwordHash = await hash(targetPassword, 10);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: targetDisplayName,
        email: targetEmail,
        image: source.user.image,
        passwordHash,
        role: source.user.role as Role,
        status: UserStatus.ACTIVE,
        emailVerified: new Date()
      }
    });

    const player = await tx.player.create({
      data: {
        userId: user.id,
        displayName: targetDisplayName,
        ptcglNick: cloneNick(source.ptcglNick, targetDisplayName),
        popId: source.popId,
        avatarUrl: source.avatarUrl,
        active: true,
        notes: `Clone laboratorio de ${source.displayName} (${source.id}) criado para depuracao.`
      }
    });

    const copied: Record<string, number> = {};

    if (groups.includes("wallet")) {
      const wallet = await tx.zikaCoinWallet.findUnique({ where: { playerId: source.id } });
      if (wallet) {
        const newWallet = await tx.zikaCoinWallet.create({
          data: {
            playerId: player.id,
            balance: wallet.balance,
            totalEarned: wallet.totalEarned,
            totalSpent: wallet.totalSpent
          }
        });
        const transactions = await tx.zikaCoinTransaction.findMany({ where: { walletId: wallet.id } });
        if (transactions.length) {
          await tx.zikaCoinTransaction.createMany({
            data: transactions.map((item) => ({
              walletId: newWallet.id,
              type: item.type,
              amount: item.amount,
              balanceBefore: item.balanceBefore,
              balanceAfter: item.balanceAfter,
              description: `[clone] ${item.description ?? ""}`.trim(),
              tournamentId: item.tournamentId,
              tournamentWeekId: item.tournamentWeekId,
              matchId: item.matchId,
              adminId: item.adminId,
              status: item.status,
              createdAt: item.createdAt
            }))
          });
        }
        copied.wallet = 1;
        copied.walletTransactions = transactions.length;
      }
    }

    if (groups.includes("inventory")) {
      const rows = await tx.playerInventory.findMany({ where: { playerId: source.id } });
      if (rows.length) {
        await tx.playerInventory.createMany({
          data: rows.map((item) => ({
            playerId: player.id,
            itemId: item.itemId,
            equipped: item.equipped,
            quantity: item.quantity,
            purchasedAt: item.purchasedAt
          })),
          skipDuplicates: true
        });
      }
      copied.inventory = rows.length;
    }

    if (groups.includes("album")) {
      const rows = await tx.playerSticker.findMany({ where: { playerId: source.id } });
      if (rows.length) {
        await tx.playerSticker.createMany({
          data: rows.map((item) => ({
            playerId: player.id,
            cardId: item.cardId,
            quantity: item.quantity,
            isFavorite: item.isFavorite,
            firstObtained: item.firstObtained
          })),
          skipDuplicates: true
        });
      }
      copied.album = rows.length;
    }

    if (groups.includes("gifts")) {
      const rows = await tx.playerGift.findMany({ where: { playerId: source.id } });
      if (rows.length) {
        await tx.playerGift.createMany({
          data: rows.map((item) => ({
            playerId: player.id,
            type: item.type,
            title: item.title,
            description: item.description,
            payload: item.payload ?? undefined,
            status: item.status,
            claimedAt: item.claimedAt,
            expiresAt: item.expiresAt,
            createdAt: item.createdAt
          }))
        });
      }
      copied.gifts = rows.length;
    }

    if (groups.includes("tournaments")) {
      const rows = await tx.tournamentRegistration.findMany({ where: { playerId: source.id } });
      if (rows.length) {
        await tx.tournamentRegistration.createMany({
          data: rows.map((item) => ({
            tournamentId: item.tournamentId,
            playerId: player.id,
            status: item.status,
            registeredAt: item.registeredAt,
            decidedAt: item.decidedAt,
            decidedById: item.decidedById
          })),
          skipDuplicates: true
        });
      }
      copied.tournaments = rows.length;
    }

    if (groups.includes("decks")) {
      const deckRows = await tx.deckSubmission.findMany({ where: { playerId: source.id } });
      for (const item of deckRows) {
        await tx.deckSubmission.create({
          data: {
            seasonId: item.seasonId,
            weekId: item.weekId,
            tournamentId: item.tournamentId,
            tournamentWeekId: item.tournamentWeekId,
            playerId: player.id,
            deckNumber: item.deckNumber,
            deckName: item.deckName,
            deckList: item.deckList,
            archetype: item.archetype,
            submittedAt: item.submittedAt,
            editedAt: item.editedAt,
            deadlineAt: item.deadlineAt,
            status: item.status,
            approvedById: item.approvedById,
            approvedAt: item.approvedAt,
            rejectionReason: item.rejectionReason,
            isLate: item.isLate
          }
        }).catch(() => null);
      }
      const savedRows = await tx.savedDeck.findMany({ where: { playerId: source.id } });
      if (savedRows.length) {
        await tx.savedDeck.createMany({
          data: savedRows.map((item) => ({
            playerId: player.id,
            name: item.name,
            archetype: item.archetype,
            deckList: item.deckList,
            isPublic: item.isPublic,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
          }))
        });
      }
      copied.deckSubmissions = deckRows.length;
      copied.savedDecks = savedRows.length;
    }

    if (groups.includes("achievements")) {
      const rows = await tx.playerAchievement.findMany({ where: { playerId: source.id } });
      if (rows.length) {
        await tx.playerAchievement.createMany({
          data: rows.map((item) => ({
            achievementId: item.achievementId,
            playerId: player.id,
            seasonId: item.seasonId,
            awardedById: item.awardedById,
            awardedAt: item.awardedAt,
            notes: item.notes,
            pointsAwarded: item.pointsAwarded,
            progress: item.progress,
            timesUnlocked: item.timesUnlocked,
            isHighlighted: item.isHighlighted,
            weekId: item.weekId
          })),
          skipDuplicates: true
        });
      }
      copied.achievements = rows.length;
    }

    if (groups.includes("badges")) {
      const rows = await tx.playerBadge.findMany({ where: { playerId: source.id } });
      if (rows.length) {
        await tx.playerBadge.createMany({
          data: rows.map((item) => ({
            badgeId: item.badgeId,
            playerId: player.id,
            awardedById: item.awardedById,
            awardedAt: item.awardedAt
          })),
          skipDuplicates: true
        });
      }
      copied.badges = rows.length;
    }

    if (groups.includes("zikaloot")) {
      const rows = await tx.zikaLootPick.findMany({ where: { playerId: source.id } });
      copied.zikaloot = 0;
      for (const item of rows) {
        const created = await tx.zikaLootPick.create({
          data: {
            lootId: item.lootId,
            playerId: player.id,
            number: item.number,
            pickedAt: item.pickedAt
          }
        }).catch(() => null);
        if (created) copied.zikaloot += 1;
      }
    }

    if (groups.includes("zikabet")) {
      const rows = await tx.zikaBet.findMany({ where: { playerId: source.id } });
      copied.zikabet = 0;
      for (const item of rows) {
        const created = await tx.zikaBet.create({
          data: {
            playerId: player.id,
            matchId: item.matchId,
            betOnPlayerId: item.betOnPlayerId,
            amount: item.amount,
            odds: item.odds,
            potentialReturn: item.potentialReturn,
            status: item.status,
            placedAt: item.placedAt,
            settledAt: item.settledAt
          }
        }).catch(() => null);
        if (created) copied.zikabet += 1;
      }
    }

    if (groups.includes("mascots")) {
      const mascotMap = new Map<string, string>();
      const mascotRows = await tx.mascot.findMany({ where: { playerId: source.id } });
      for (const item of mascotRows) {
        const created = await tx.mascot.create({
          data: {
            playerId: player.id,
            pokemonId: item.pokemonId,
            nickname: item.nickname,
            level: item.level,
            exp: item.exp,
            happiness: item.happiness,
            mood: item.mood,
            personality: item.personality,
            isEquipped: item.isEquipped,
            statForce: item.statForce,
            statAgility: item.statAgility,
            statCharisma: item.statCharisma,
            statInstinct: item.statInstinct,
            statVitality: item.statVitality,
            battleWins: item.battleWins,
            battleLosses: item.battleLosses,
            hatchedAt: item.hatchedAt,
            lastInteractedAt: item.lastInteractedAt,
            lastFedAt: item.lastFedAt
          }
        });
        mascotMap.set(item.id, created.id);
      }

      const events = await tx.mascotEvent.findMany({ where: { mascotId: { in: [...mascotMap.keys()] } } });
      if (events.length) {
        await tx.mascotEvent.createMany({
          data: events.flatMap((event) => {
            const mascotId = mascotMap.get(event.mascotId);
            return mascotId ? [{ mascotId, emoji: event.emoji, description: event.description, createdAt: event.createdAt }] : [];
          })
        });
      }

      const buffs = await tx.mascotBuff.findMany({ where: { mascotId: { in: [...mascotMap.keys()] } } });
      if (buffs.length) {
        await tx.mascotBuff.createMany({
          data: buffs.flatMap((buff) => {
            const mascotId = mascotMap.get(buff.mascotId);
            return mascotId ? [{ mascotId, type: buff.type, expiresAt: buff.expiresAt, createdAt: buff.createdAt }] : [];
          })
        });
      }

      const relations = await tx.mascotRelation.findMany({ where: { mascotAId: { in: [...mascotMap.keys()] }, mascotBId: { in: [...mascotMap.keys()] } } });
      for (const relation of relations) {
        const mascotAId = mascotMap.get(relation.mascotAId);
        const mascotBId = mascotMap.get(relation.mascotBId);
        if (!mascotAId || !mascotBId) continue;
        await tx.mascotRelation.create({
          data: { mascotAId, mascotBId, type: relation.type, wins: relation.wins, losses: relation.losses, createdAt: relation.createdAt }
        }).catch(() => null);
      }

      const eggs = await tx.mascotEgg.findMany({ where: { playerId: source.id } });
      const eggMap = new Map<string, string>();
      for (const egg of eggs) {
        const created = await tx.mascotEgg.create({
          data: { playerId: player.id, type: egg.type, obtainedAt: egg.obtainedAt, origin: egg.origin }
        });
        eggMap.set(egg.id, created.id);
      }

      const foods = await tx.mascotFoodItem.findMany({ where: { playerId: source.id } });
      if (foods.length) {
        await tx.mascotFoodItem.createMany({
          data: foods.map((food) => ({ playerId: player.id, type: food.type, quantity: food.quantity })),
          skipDuplicates: true
        });
      }

      const incubator = await tx.mascotIncubator.findUnique({ where: { playerId: source.id } });
      if (incubator) {
        const eggId = eggMap.get(incubator.eggId);
        if (eggId) {
          await tx.mascotIncubator.create({
            data: {
              playerId: player.id,
              eggId,
              startedAt: incubator.startedAt,
              finishAt: incubator.finishAt,
              hatched: incubator.hatched
            }
          }).catch(() => null);
        }
      }

      copied.mascots = mascotRows.length;
      copied.mascotEvents = events.length;
      copied.mascotBuffs = buffs.length;
      copied.mascotRelations = relations.length;
      copied.eggs = eggs.length;
      copied.foods = foods.length;
      copied.incubator = incubator ? 1 : 0;
    }

    return { userId: user.id, playerId: player.id, email: user.email, displayName: player.displayName, ptcglNick: player.ptcglNick, copied };
  });

  return NextResponse.json({
    success: true,
    clone: result,
    source: { playerId: source.id, userId: source.userId, displayName: source.displayName, ptcglNick: source.ptcglNick },
    groups
  });
}
