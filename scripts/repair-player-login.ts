/**
 * Repara uma conta de login sem recriar os dados do jogador.
 *
 * Uso seguro:
 *   npx tsx scripts/repair-player-login.ts --nick Hitto23 --name Rodrigo
 *
 * Aplicar:
 *   npx tsx scripts/repair-player-login.ts --nick Hitto23 --name Rodrigo --new-email rodrigo.reparado@ligazikachu.com --password "NovaSenha123" --apply
 *
 * A maioria dos dados da Liga Zikachu pertence ao Player, nao ao User:
 * mascotes, inventario, figurinhas, carteira, partidas, inscricoes,
 * decks, presentes e codigos. Por isso o reparo cria um User novo e
 * religa o Player existente a ele, preservando o playerId.
 */

import { PrismaClient, Role, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function asString(value: string | boolean | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

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
    mascotCounts,
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
    mascots: mascotCounts,
    eggs,
    foods,
    incubator,
    expeditions,
    zikaBets,
    zikaLootPicks
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const nick = asString(args.nick) || "Hitto23";
  const name = asString(args.name) || "Rodrigo";
  const apply = args.apply === true;
  const newEmail = asString(args["new-email"]);
  const password = asString(args.password);

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

  if (!player) {
    throw new Error(`Jogador nao encontrado para nick=${nick} ou nome=${name}.`);
  }
  if (!player.user) {
    throw new Error(`Jogador ${player.displayName} nao tem User vinculado.`);
  }

  const inventory = await collectPlayerInventory(player.id);
  const targetEmail = newEmail || `${player.ptcglNick ?? player.displayName}.${Date.now()}@login-repair.ligazikachu.local`.toLowerCase();

  console.log("=== Diagnostico do jogador ===");
  console.log({
    playerId: player.id,
    displayName: player.displayName,
    ptcglNick: player.ptcglNick,
    currentUserId: player.user.id,
    currentEmail: maskEmail(player.user.email),
    currentRole: player.user.role,
    currentStatus: player.user.status,
    targetEmail: maskEmail(targetEmail),
    apply
  });
  console.log("=== Dados preservados no playerId ===");
  console.log(inventory);

  if (!apply) {
    console.log("\nDry-run concluido. Nada foi alterado.");
    console.log("Para aplicar, rode novamente com --apply --new-email EMAIL --password SENHA.");
    return;
  }

  if (!newEmail) throw new Error("Informe --new-email para aplicar o reparo.");
  if (password.length < 8) throw new Error("Informe --password com pelo menos 8 caracteres.");

  const existingTarget = await prisma.user.findUnique({ where: { email: targetEmail.toLowerCase() } });
  if (existingTarget) {
    throw new Error(`Ja existe um usuario com o email ${targetEmail}. Escolha outro email.`);
  }

  const passwordHash = await hash(password, 10);
  const oldUserId = player.user.id;
  const archivedOldEmail = `archived-${Date.now()}-${player.user.email}`.slice(0, 190);

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name: player.user.name ?? player.displayName,
        email: targetEmail.toLowerCase(),
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

    await tx.user.update({
      where: { id: oldUserId },
      data: {
        email: archivedOldEmail.toLowerCase(),
        status: UserStatus.SUSPENDED,
        passwordHash: null
      }
    });

    await tx.userTutorialProgress.createMany({
      data: await tx.userTutorialProgress.findMany({
        where: { userId: oldUserId },
        select: { pageId: true, completed: true, completedAt: true }
      }).then((rows) => rows.map((row) => ({ ...row, userId: newUser.id }))),
      skipDuplicates: true
    });

    await tx.userFcmToken.deleteMany({ where: { userId: oldUserId } });
    await tx.passwordResetToken.updateMany({
      where: { userId: oldUserId, usedAt: null },
      data: { usedAt: new Date() }
    });

    return newUser;
  });

  console.log("\nReparo aplicado com sucesso.");
  console.log({
    playerId: player.id,
    oldUserId,
    newUserId: result.id,
    newEmail: maskEmail(result.email),
    oldUserArchivedAs: maskEmail(archivedOldEmail)
  });
}

main()
  .catch((error) => {
    console.error("\nFalha no reparo:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
