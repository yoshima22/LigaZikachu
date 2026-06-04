import { NextResponse } from "next/server";
import { Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/auth/permissions";

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

async function collectPlayerInventory(playerId: string) {
  const [
    wallet,
    walletTransactions,
    gifts,
    codeDistributions,
    inventory,
    stickers,
    savedDecks,
    registrations,
    deckSubmissions,
    matchesAsA,
    matchesAsB,
    confirmations,
    badges,
    achievements,
    mascots,
    eggs,
    foods,
    incubator,
    expeditions,
    zikaBets,
    zikaLootPicks
  ] = await Promise.all([
    prisma.zikaCoinWallet.findUnique({ where: { playerId }, select: { id: true, balance: true, totalEarned: true, totalSpent: true } }),
    prisma.zikaCoinTransaction.count({ where: { wallet: { playerId } } }),
    prisma.playerGift.count({ where: { playerId } }),
    prisma.codeDistribution.count({ where: { playerId } }),
    prisma.playerInventory.count({ where: { playerId } }),
    prisma.playerSticker.count({ where: { playerId } }),
    prisma.savedDeck.count({ where: { playerId } }),
    prisma.tournamentRegistration.count({ where: { playerId } }),
    prisma.deckSubmission.count({ where: { playerId } }),
    prisma.match.count({ where: { playerAId: playerId } }),
    prisma.match.count({ where: { playerBId: playerId } }),
    prisma.matchConfirmation.count({ where: { playerId } }),
    prisma.playerBadge.count({ where: { playerId } }),
    prisma.playerAchievement.count({ where: { playerId } }),
    prisma.mascot.count({ where: { playerId } }),
    prisma.mascotEgg.count({ where: { playerId } }),
    prisma.mascotFoodItem.count({ where: { playerId } }),
    prisma.mascotIncubator.findUnique({ where: { playerId }, select: { id: true, eggId: true, finishAt: true } }),
    prisma.mascotExpedition.count({ where: { mascot: { playerId } } }),
    prisma.zikaBet.count({ where: { playerId } }),
    prisma.zikaLootPick.count({ where: { playerId } })
  ]);

  return {
    wallet,
    walletTransactions,
    gifts,
    codeDistributions,
    inventory,
    stickers,
    savedDecks,
    registrations,
    deckSubmissions,
    matchesAsA,
    matchesAsB,
    confirmations,
    badges,
    achievements,
    mascots,
    eggs,
    foods,
    incubator,
    expeditions,
    zikaBets,
    zikaLootPicks
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const nick = typeof body.nick === "string" && body.nick.trim() ? body.nick.trim() : "Hitto23";
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Rodrigo";
  const apply = body.apply === true;
  const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  const player = await prisma.player.findFirst({
    where: {
      OR: [
        { ptcglNick: { equals: nick, mode: "insensitive" } },
        { displayName: { equals: name, mode: "insensitive" } }
      ]
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          status: true,
          createdAt: true
        }
      }
    }
  });

  if (!player?.user) {
    return NextResponse.json({ error: "Jogador ou usuario vinculado nao encontrado." }, { status: 404 });
  }

  const inventory = await collectPlayerInventory(player.id);
  const diagnostic = {
    playerId: player.id,
    displayName: player.displayName,
    ptcglNick: player.ptcglNick,
    currentUserId: player.user.id,
    currentEmail: maskEmail(player.user.email),
    currentRole: player.user.role,
    currentStatus: player.user.status,
    inventory
  };

  if (!apply) {
    return NextResponse.json({
      dryRun: true,
      message: "Diagnostico concluido. Nada foi alterado.",
      diagnostic
    });
  }

  if (!newEmail) {
    return NextResponse.json({ error: "Informe newEmail para aplicar o reparo.", diagnostic }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Informe password com pelo menos 8 caracteres.", diagnostic }, { status: 400 });
  }

  const oldUserId = player.user.id;
  const existingTarget = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existingTarget && existingTarget.id !== oldUserId) {
    return NextResponse.json({ error: "Ja existe outro usuario com esse email.", diagnostic }, { status: 409 });
  }

  const passwordHash = await hash(password, 10);
  const archivedOldEmail = `archived-${Date.now()}-${player.user.email}`.slice(0, 190).toLowerCase();

  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: oldUserId },
      data: {
        email: archivedOldEmail,
        status: UserStatus.SUSPENDED,
        passwordHash: null
      }
    });

    const newUser = await tx.user.create({
      data: {
        name: player.user.name ?? player.displayName,
        email: newEmail,
        image: player.user.image ?? player.avatarUrl,
        passwordHash,
        role: player.user.role as Role,
        status: UserStatus.ACTIVE,
        emailVerified: new Date()
      },
      select: { id: true, email: true }
    });

    await tx.player.update({
      where: { id: player.id },
      data: { userId: newUser.id }
    });

    const tutorialRows = await tx.userTutorialProgress.findMany({
      where: { userId: oldUserId },
      select: { pageId: true, completed: true, completedAt: true }
    });
    if (tutorialRows.length > 0) {
      await tx.userTutorialProgress.createMany({
        data: tutorialRows.map((row) => ({ ...row, userId: newUser.id })),
        skipDuplicates: true
      });
    }

    await tx.userFcmToken.deleteMany({ where: { userId: oldUserId } });
    await tx.passwordResetToken.updateMany({
      where: { userId: oldUserId, usedAt: null },
      data: { usedAt: new Date() }
    });

    return newUser;
  });

  return NextResponse.json({
    success: true,
    message: "Conta de login substituida. Dados do jogador foram preservados no mesmo playerId.",
    diagnostic,
    repaired: {
      playerId: player.id,
      oldUserId,
      newUserId: result.id,
      newEmail: maskEmail(result.email),
      oldUserArchivedAs: maskEmail(archivedOldEmail)
    }
  });
}
