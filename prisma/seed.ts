import {
  PrismaClient,
  Role,
  SeasonStatus,
  UserStatus,
  WeekStatus,
  MatchStatus,
  ConfirmationStatus,
  DeckSubmissionStatus,
  BoosterCodeStatus,
  DistributionReason,
  DistributionStatus
} from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();
const isDirectExecution =
  process.argv[1]?.endsWith("prisma/seed.ts") || process.argv[1]?.endsWith("prisma\\seed.ts");

const rankingConfig = {
  version: "1.0.0",
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  byePoints: 3,
  topOfDayBonus: 1,
  boosterImpactsRanking: false,
  tiebreakers: ["points", "strengthOfSchedule", "headToHead", "wins", "byeCount"]
};

export async function main() {
  const passwordHash = await hash("LigaZikachu123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@ligazikachu.com" },
    update: {
      name: "Admin Liga Zikachu",
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash
    },
    create: {
      name: "Admin Liga Zikachu",
      email: "admin@ligazikachu.com",
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
      player: {
        create: {
          displayName: "Admin Liga Zikachu",
          ptcglNick: "AdminZika"
        }
      }
    },
    include: {
      player: true
    }
  });

  const playerSeeds = [
    { name: "Luiz", email: "luiz@ligazikachu.com", nick: "LuizZika" },
    { name: "Rodrigo", email: "rodrigo@ligazikachu.com", nick: "RodTCGL" },
    { name: "Moisés", email: "moises@ligazikachu.com", nick: "MoisesTCGL" },
    { name: "Erick", email: "erick@ligazikachu.com", nick: "ErickTCGL" },
    { name: "Cristian", email: "cristian@ligazikachu.com", nick: "CristianTCGL" },
    { name: "Nakaima", email: "nakaima@ligazikachu.com", nick: "NakaimaTCGL" }
  ];

  const players = [];

  for (const entry of playerSeeds) {
    const user = await prisma.user.upsert({
      where: { email: entry.email },
      update: {
        name: entry.name,
        role: Role.PLAYER,
        status: UserStatus.ACTIVE,
        passwordHash
      },
      create: {
        name: entry.name,
        email: entry.email,
        role: Role.PLAYER,
        status: UserStatus.ACTIVE,
        passwordHash,
        player: {
          create: {
            displayName: entry.name,
            ptcglNick: entry.nick
          }
        }
      },
      include: {
        player: true
      }
    });

    if (!user.player) {
      throw new Error(`Player não criado para ${entry.name}`);
    }

    players.push(user.player);
  }

  const season = await prisma.season.upsert({
    where: { slug: "liga-zikachu-temporada-1" },
    update: {
      status: SeasonStatus.ACTIVE,
      rankingConfig
    },
    create: {
      name: "Liga Zikachu - Temporada 1",
      slug: "liga-zikachu-temporada-1",
      description: "Temporada inicial para smoke tests e validação de fluxo.",
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      endDate: new Date("2026-07-31T23:59:59.000Z"),
      status: SeasonStatus.ACTIVE,
      rankingConfig,
      topOfDayConfig: {
        bonusPoints: 1,
        period: "weekly",
        criteria: ["wins", "gameDiff", "adminDecision"]
      },
      createdById: admin.id
    }
  });

  for (const [index, player] of players.entries()) {
    await prisma.seasonPlayer.upsert({
      where: {
        seasonId_playerId: {
          seasonId: season.id,
          playerId: player.id
        }
      },
      update: {
        seed: index + 1,
        isActive: true
      },
      create: {
        seasonId: season.id,
        playerId: player.id,
        seed: index + 1,
        initialPoints: 0
      }
    });
  }

  const weeks = [
    {
      number: 1,
      startsAt: new Date("2026-05-04T00:00:00.000Z"),
      endsAt: new Date("2026-05-10T23:59:59.000Z"),
      lockAt: new Date("2026-05-08T21:00:00.000Z"),
      multiplier: 1
    },
    {
      number: 2,
      startsAt: new Date("2026-05-11T00:00:00.000Z"),
      endsAt: new Date("2026-05-17T23:59:59.000Z"),
      lockAt: new Date("2026-05-15T21:00:00.000Z"),
      multiplier: 1.25
    },
    {
      number: 3,
      startsAt: new Date("2026-05-18T00:00:00.000Z"),
      endsAt: new Date("2026-05-24T23:59:59.000Z"),
      lockAt: new Date("2026-05-22T21:00:00.000Z"),
      multiplier: 1.5
    }
  ];

  const persistedWeeks = [];

  for (const entry of weeks) {
    const week = await prisma.week.upsert({
      where: {
        seasonId_number: {
          seasonId: season.id,
          number: entry.number
        }
      },
      update: {
        startsAt: entry.startsAt,
        endsAt: entry.endsAt,
        lockAt: entry.lockAt,
        multiplier: entry.multiplier,
        status: WeekStatus.OPEN
      },
      create: {
        seasonId: season.id,
        number: entry.number,
        label: `Semana ${entry.number}`,
        startsAt: entry.startsAt,
        endsAt: entry.endsAt,
        lockAt: entry.lockAt,
        multiplier: entry.multiplier,
        status: WeekStatus.OPEN
      }
    });

    persistedWeeks.push(week);
  }

  const byName = Object.fromEntries(players.map((player) => [player.displayName, player]));

  const sampleMatches = [
    {
      week: persistedWeeks[0],
      a: byName["Luiz"],
      b: byName["Rodrigo"],
      playerAWins: 2,
      playerBWins: 1,
      status: MatchStatus.CONFIRMED,
      confirmationStatus: ConfirmationStatus.CONFIRMED,
      winner: byName["Luiz"],
      loser: byName["Rodrigo"],
      pointsA: 3,
      pointsB: 0
    },
    {
      week: persistedWeeks[0],
      a: byName["Moisés"],
      b: byName["Erick"],
      playerAWins: 2,
      playerBWins: 0,
      status: MatchStatus.PENDING_CONFIRMATION,
      confirmationStatus: ConfirmationStatus.PENDING,
      winner: byName["Moisés"],
      loser: byName["Erick"],
      pointsA: 3,
      pointsB: 0
    },
    {
      week: persistedWeeks[1],
      a: byName["Cristian"],
      b: byName["Nakaima"],
      playerAWins: 1,
      playerBWins: 2,
      status: MatchStatus.DISPUTED,
      confirmationStatus: ConfirmationStatus.REJECTED,
      winner: byName["Nakaima"],
      loser: byName["Cristian"],
      pointsA: 0,
      pointsB: 3
    }
  ];

  for (const entry of sampleMatches) {
    const existingMatch = await prisma.match.findFirst({
      where: {
        seasonId: season.id,
        weekId: entry.week.id,
        playerAId: entry.a.id,
        playerBId: entry.b.id
      }
    });

    const match = existingMatch
      ? await prisma.match.update({
          where: { id: existingMatch.id },
          data: {
            playedAt: entry.week.startsAt,
            bestOf: 3,
            playerAWins: entry.playerAWins,
            playerBWins: entry.playerBWins,
            winnerPlayerId: entry.winner.id,
            loserPlayerId: entry.loser.id,
            status: entry.status,
            rankingPointsA: entry.pointsA,
            rankingPointsB: entry.pointsB,
            topOfDayEligible: true,
            createdById: admin.id
          }
        })
      : await prisma.match.create({
          data: {
            seasonId: season.id,
            weekId: entry.week.id,
            playerAId: entry.a.id,
            playerBId: entry.b.id,
            playedAt: entry.week.startsAt,
            bestOf: 3,
            playerAWins: entry.playerAWins,
            playerBWins: entry.playerBWins,
            winnerPlayerId: entry.winner.id,
            loserPlayerId: entry.loser.id,
            status: entry.status,
            rankingPointsA: entry.pointsA,
            rankingPointsB: entry.pointsB,
            topOfDayEligible: true,
            createdById: admin.id
          }
        });

    for (const playerId of [entry.a.id, entry.b.id]) {
      await prisma.matchConfirmation.upsert({
        where: {
          matchId_playerId: {
            matchId: match.id,
            playerId
          }
        },
        update: {
          status: entry.confirmationStatus,
          confirmedAt: entry.confirmationStatus === ConfirmationStatus.CONFIRMED ? new Date() : null
        },
        create: {
          matchId: match.id,
          playerId,
          status: entry.confirmationStatus,
          confirmedAt: entry.confirmationStatus === ConfirmationStatus.CONFIRMED ? new Date() : null
        }
      });
    }

    if (entry.status === MatchStatus.DISPUTED) {
      const existingChallenge = await prisma.challenge.findFirst({
        where: {
          matchId: match.id
        }
      });

      if (!existingChallenge) {
        await prisma.challenge.create({
          data: {
            seasonId: season.id,
            weekId: entry.week.id,
            matchId: match.id,
            challengerId: entry.a.id,
            challengedId: entry.b.id,
            openedById: admin.id,
            status: "UNDER_REVIEW",
            reason: "Divergência no placar informado."
          }
        });
      }
    }
  }

  await prisma.deckSubmission.createMany({
    data: [
      {
        seasonId: season.id,
        weekId: persistedWeeks[0].id,
        playerId: byName["Luiz"].id,
        deckName: "Charizard ex",
        deckList: "4 Charmander\n2 Charmeleon\n3 Charizard ex\n4 Rare Candy",
        archetype: "Charizard ex",
        deadlineAt: persistedWeeks[0].lockAt ?? persistedWeeks[0].endsAt,
        status: DeckSubmissionStatus.APPROVED,
        approvedById: admin.id,
        approvedAt: new Date(),
        isLate: false
      },
      {
        seasonId: season.id,
        weekId: persistedWeeks[1].id,
        playerId: byName["Rodrigo"].id,
        deckName: "Gardevoir ex",
        deckList: "4 Ralts\n3 Kirlia\n2 Gardevoir ex",
        archetype: "Gardevoir ex",
        deadlineAt: persistedWeeks[1].lockAt ?? persistedWeeks[1].endsAt,
        status: DeckSubmissionStatus.SUBMITTED,
        isLate: true
      }
    ],
    skipDuplicates: true
  });

  const boosterCodes = [
    { code: "LIGA-ZIKA-001", status: BoosterCodeStatus.ASSIGNED },
    { code: "LIGA-ZIKA-002", status: BoosterCodeStatus.REDEEMED },
    { code: "LIGA-ZIKA-003", status: BoosterCodeStatus.INVALIDATED },
    { code: "LIGA-ZIKA-004", status: BoosterCodeStatus.AVAILABLE },
    { code: "LIGA-ZIKA-005", status: BoosterCodeStatus.AVAILABLE },
    { code: "LIGA-ZIKA-006", status: BoosterCodeStatus.AVAILABLE },
    { code: "LIGA-ZIKA-007", status: BoosterCodeStatus.AVAILABLE },
    { code: "LIGA-ZIKA-008", status: BoosterCodeStatus.AVAILABLE }
  ];

  for (const entry of boosterCodes) {
    const code = await prisma.boosterCode.upsert({
      where: { code: entry.code },
      update: {
        status: entry.status
      },
      create: {
        seasonId: season.id,
        code: entry.code,
        sourceBatch: "seed-batch-01",
        rewardLabel: "Reward Seed",
        status: entry.status,
        createdById: admin.id
      }
    });

    if (entry.status === BoosterCodeStatus.ASSIGNED || entry.status === BoosterCodeStatus.REDEEMED) {
      await prisma.codeDistribution.upsert({
        where: { boosterCodeId: code.id },
        update: {
          playerId: byName["Luiz"].id,
          seasonId: season.id,
          status: entry.status === BoosterCodeStatus.REDEEMED ? DistributionStatus.REDEEMED : DistributionStatus.ASSIGNED
        },
        create: {
          boosterCodeId: code.id,
          seasonId: season.id,
          playerId: byName["Luiz"].id,
          assignedById: admin.id,
          reason: DistributionReason.TOP_OF_DAY,
          status: entry.status === BoosterCodeStatus.REDEEMED ? DistributionStatus.REDEEMED : DistributionStatus.ASSIGNED,
          redeemedAt: entry.status === BoosterCodeStatus.REDEEMED ? new Date() : null
        }
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      entityType: "seed",
      entityId: season.id,
      action: "seed.executed",
      after: {
        season: season.slug,
        players: playerSeeds.map((entry) => entry.name),
        weeks: weeks.length,
        codes: boosterCodes.length
      }
    }
  });
}

export async function disconnectSeedPrisma() {
  await prisma.$disconnect();
}

if (isDirectExecution) {
  main()
    .then(async () => {
      await disconnectSeedPrisma();
    })
    .catch(async (error) => {
      console.error(error);
      await disconnectSeedPrisma();
      process.exit(1);
    });
}
