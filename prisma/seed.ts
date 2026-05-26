import {
  PrismaClient,
  Role,
  SeasonStatus,
  TournamentStatus,
  WeekMode,
  UserStatus,
  WeekStatus,
  MatchStatus,
  ConfirmationStatus,
  DeckSubmissionStatus,
  BoosterCodeStatus,
  DistributionReason,
  DistributionStatus,
  RegistrationStatus
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

// Configuração do ranking da 2ª edição (MD1, sem empates)
const rankingConfig2a = {
  version: "2.0.0",
  format: "MD1",
  winPoints: 3,
  drawPoints: 0,
  lossPoints: 0,
  byePoints: 3,
  topOfDayBonus: 0,
  boosterImpactsRanking: false,
  tiebreakers: ["wins", "wo_count_asc", "defended_badges", "opponent_win_rate"],
  badgePoints: 3,
  achievementPoints: { bronze: 5, silver: 7, gold: 10 }
};

// Definição das 8 semanas da 2ª edição
const weekDefs = [
  {
    weekNumber: 1,
    label: "Semana 1 — Padrão",
    mode: WeekMode.PADRAO,
    multiplier: 1,
    bonusRule: null,
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-06-07T23:59:59.000Z"),
    lockAt: new Date("2026-06-05T21:00:00.000Z"),
    notes: "Abertura da 2ª edição. Sem restrições de deck."
  },
  {
    weekNumber: 2,
    label: "Semana 2 — GLC",
    mode: WeekMode.GLC,
    multiplier: 1,
    bonusRule: {
      extraPointsPerWin: 1,
      badgeProgress: true,
      officialBadgeDuel: false,
      description: "Monotipo escolhido, energias mistas livres. +1pt extra por vitória."
    },
    startDate: new Date("2026-06-08T00:00:00.000Z"),
    endDate: new Date("2026-06-14T23:59:59.000Z"),
    lockAt: new Date("2026-06-12T21:00:00.000Z"),
    notes: "Gym Leader Challenge. GLC dá +1 progresso de insígnia mas não é duelo oficial."
  },
  {
    weekNumber: 3,
    label: "Semana 3 — Padrão",
    mode: WeekMode.PADRAO,
    multiplier: 1,
    bonusRule: null,
    startDate: new Date("2026-06-15T00:00:00.000Z"),
    endDate: new Date("2026-06-21T23:59:59.000Z"),
    lockAt: new Date("2026-06-19T21:00:00.000Z"),
    notes: "Rodada livre."
  },
  {
    weekNumber: 4,
    label: "Semana 4 — Duplas Sincronizadas",
    mode: WeekMode.DUPLAS_SINCRONIZADAS,
    multiplier: 1,
    bonusRule: {
      pairingRule: "rank_mirror",
      pairs: [
        { positions: [1, 8] },
        { positions: [2, 7] },
        { positions: [3, 6] }
      ],
      mirrorPosition: 4,
      winnerTeamBonus: 3,
      description: "Pareamento: 1º com 8º, 2º com 7º, 3º com 6º. 4º joga Dupla Espelho. Time vencedor +3pt cada."
    },
    startDate: new Date("2026-06-22T00:00:00.000Z"),
    endDate: new Date("2026-06-28T23:59:59.000Z"),
    lockAt: new Date("2026-06-26T21:00:00.000Z"),
    notes: "Duplas sincronizadas por ranking."
  },
  {
    weekNumber: 5,
    label: "Semana 5 — Pontuação Dobrada",
    mode: WeekMode.PONTUACAO_DOBRADA,
    multiplier: 2,
    bonusRule: {
      winPoints: 6,
      badgesDouble: false,
      achievementsDouble: false,
      description: "Vitórias valem 6 pontos. Insígnias e conquistas NÃO dobram."
    },
    startDate: new Date("2026-06-29T00:00:00.000Z"),
    endDate: new Date("2026-07-05T23:59:59.000Z"),
    lockAt: new Date("2026-07-03T21:00:00.000Z"),
    notes: "Pontuação de vitória dobrada nesta semana."
  },
  {
    weekNumber: 6,
    label: "Semana 6 — Construtor Misterioso",
    mode: WeekMode.CONSTRUTOR_MISTERIOSO,
    multiplier: 1,
    bonusRule: {
      decksToSubmit: 3,
      opponentChooses: true,
      extraPointsPerWin: 1,
      description: "Cada jogador prepara 3 decks; adversário escolhe qual você usa. +1pt por vitória."
    },
    startDate: new Date("2026-07-06T00:00:00.000Z"),
    endDate: new Date("2026-07-12T23:59:59.000Z"),
    lockAt: new Date("2026-07-10T21:00:00.000Z"),
    notes: "Envie 3 decks antes do prazo. Adversário escolhe qual você usa."
  },
  {
    weekNumber: 7,
    label: "Semana 7 — Guerra de Times",
    mode: WeekMode.GUERRA_DE_TIMES,
    multiplier: 1,
    bonusRule: {
      teamA: [1, 3, 5, 7],
      teamB: [2, 4, 6],
      winCondition: "avg_points",
      winnerTeamBonus: 2,
      description: "Time A: posições 1,3,5,7. Time B: 2,4,6. Vence pela média de pontos. Time vencedor +2pt cada."
    },
    startDate: new Date("2026-07-13T00:00:00.000Z"),
    endDate: new Date("2026-07-19T23:59:59.000Z"),
    lockAt: new Date("2026-07-17T21:00:00.000Z"),
    notes: "Disputa entre dois times formados por posição no ranking."
  },
  {
    weekNumber: 8,
    label: "Semana 8 — Batalha Final",
    mode: WeekMode.BATALHA_FINAL,
    multiplier: 1,
    bonusRule: {
      positionBonus: [
        { positions: [1, 2], bonusPerWin: 1 },
        { positions: [3, 4], bonusPerWin: 2 },
        { positions: [5, 6], bonusPerWin: 3 },
        { positions: [7, 8], bonusPerWin: 4 }
      ],
      description: "Bônus por posição inicial: 1-2 = +1pt/vitória; 3-4 = +2pt; 5-6 = +3pt; 7-8 = +4pt."
    },
    startDate: new Date("2026-07-20T00:00:00.000Z"),
    endDate: new Date("2026-07-26T23:59:59.000Z"),
    lockAt: new Date("2026-07-24T21:00:00.000Z"),
    notes: "Rodada final com bônus progressivo por posição de ranking."
  }
];

export async function main() {
  const passwordHash = await hash("LigaZikachu123", 10);

  // ─── Admin ───────────────────────────────────────────────────────────────────
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
    include: { player: true }
  });

  // ─── Players ─────────────────────────────────────────────────────────────────
  const playerSeeds = [
    { name: "Luiz", email: "luiz@ligazikachu.com", nick: "LuizZika" },
    { name: "Rodrigo", email: "rodrigo@ligazikachu.com", nick: "RodTCGL" },
    { name: "Moisés", email: "moises@ligazikachu.com", nick: "MoisesTCGL" },
    { name: "Erick", email: "erick@ligazikachu.com", nick: "ErickTCGL" },
    { name: "Cristian", email: "cristian@ligazikachu.com", nick: "CristianTCGL" },
    { name: "Nakaima", email: "nakaima@ligazikachu.com", nick: "NakaimaTCGL" }
  ];

  const players: Array<{ id: string; displayName: string; ptcglNick: string | null; userId: string; whatsapp: string | null; active: boolean; notes: string | null; createdAt: Date; updatedAt: Date }> = [];

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
      include: { player: true }
    });

    if (!user.player) throw new Error(`Player não criado para ${entry.name}`);
    players.push(user.player);
  }

  // ─── Season legada (Temporada 1) ─────────────────────────────────────────────
  const season = await prisma.season.upsert({
    where: { slug: "liga-zikachu-temporada-1" },
    update: { status: SeasonStatus.ACTIVE, rankingConfig },
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
      where: { seasonId_playerId: { seasonId: season.id, playerId: player.id } },
      update: { seed: index + 1, isActive: true },
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
      where: { seasonId_number: { seasonId: season.id, number: entry.number } },
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

  // ─── Sample matches (season legada) ──────────────────────────────────────────
  const byName = Object.fromEntries(players.map((p) => [p.displayName, p]));

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
        where: { matchId_playerId: { matchId: match.id, playerId } },
        update: {
          status: entry.confirmationStatus,
          confirmedAt:
            entry.confirmationStatus === ConfirmationStatus.CONFIRMED ? new Date() : null
        },
        create: {
          matchId: match.id,
          playerId,
          status: entry.confirmationStatus,
          confirmedAt:
            entry.confirmationStatus === ConfirmationStatus.CONFIRMED ? new Date() : null
        }
      });
    }

    if (entry.status === MatchStatus.DISPUTED) {
      const existingChallenge = await prisma.challenge.findFirst({
        where: { matchId: match.id }
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

  // ─── Deck submissions ────────────────────────────────────────────────────────
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

  // ─── Booster codes ───────────────────────────────────────────────────────────
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
      update: { status: entry.status },
      create: {
        seasonId: season.id,
        code: entry.code,
        sourceBatch: "seed-batch-01",
        rewardLabel: "Reward Seed",
        status: entry.status,
        createdById: admin.id
      }
    });

    if (
      entry.status === BoosterCodeStatus.ASSIGNED ||
      entry.status === BoosterCodeStatus.REDEEMED
    ) {
      await prisma.codeDistribution.upsert({
        where: { boosterCodeId: code.id },
        update: {
          playerId: byName["Luiz"].id,
          seasonId: season.id,
          status:
            entry.status === BoosterCodeStatus.REDEEMED
              ? DistributionStatus.REDEEMED
              : DistributionStatus.ASSIGNED
        },
        create: {
          boosterCodeId: code.id,
          seasonId: season.id,
          playerId: byName["Luiz"].id,
          assignedById: admin.id,
          reason: DistributionReason.TOP_OF_DAY,
          status:
            entry.status === BoosterCodeStatus.REDEEMED
              ? DistributionStatus.REDEEMED
              : DistributionStatus.ASSIGNED,
          redeemedAt: entry.status === BoosterCodeStatus.REDEEMED ? new Date() : null
        }
      });
    }
  }

  // ─── Torneio: 2ª Edição — Desafio das Insígnias Fantasmagóricas ──────────────
  const tournament = await prisma.tournament.upsert({
    where: { slug: "2a-edicao-insignias-fantasmagoricas" },
    update: {
      status: TournamentStatus.REGISTRATION_OPEN,
      rankingConfig: rankingConfig2a,
      seasonId: season.id
    },
    create: {
      name: "2ª Edição: Desafio das Insígnias Fantasmagóricas",
      slug: "2a-edicao-insignias-fantasmagoricas",
      edition: "2a-edicao",
      description:
        "O grande retorno da Liga Zikachu! 8 semanas de batalhas, insígnias Kanto, conquistas e modos especiais. Prepare seus decks e mostre que você é o melhor Treinador.",
      status: TournamentStatus.REGISTRATION_OPEN,
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-07-26T23:59:59.000Z"),
      seasonId: season.id,
      maxPlayers: 8,
      registrationOpensAt: new Date("2026-05-20T00:00:00.000Z"),
      registrationClosesAt: new Date("2026-05-31T23:59:59.000Z"),
      rankingConfig: rankingConfig2a,
      themeMetadata: {
        primaryColor: "#735797",
        accentColor: "#FFCB05",
        badge: "ghost",
        edition: 2
      },
      createdById: admin.id
    }
  });

  // ─── Semanas do torneio ──────────────────────────────────────────────────────
  for (const wk of weekDefs) {
    await prisma.tournamentWeek.upsert({
      where: {
        tournamentId_weekNumber: {
          tournamentId: tournament.id,
          weekNumber: wk.weekNumber
        }
      },
      update: {
        label: wk.label,
        mode: wk.mode,
        multiplier: wk.multiplier,
        bonusRule: wk.bonusRule ?? undefined,
        startDate: wk.startDate,
        endDate: wk.endDate,
        lockAt: wk.lockAt,
        deckLockAt: wk.lockAt,
        notes: wk.notes
      },
      create: {
        tournamentId: tournament.id,
        weekNumber: wk.weekNumber,
        label: wk.label,
        mode: wk.mode,
        multiplier: wk.multiplier,
        bonusRule: wk.bonusRule ?? undefined,
        startDate: wk.startDate,
        endDate: wk.endDate,
        lockAt: wk.lockAt,
        deckLockAt: wk.lockAt,
        notes: wk.notes
      }
    });
  }

  // ─── Inscrições dos 6 jogadores na 2ª edição ────────────────────────────────
  for (const player of players) {
    await prisma.tournamentRegistration.upsert({
      where: {
        tournamentId_playerId: {
          tournamentId: tournament.id,
          playerId: player.id
        }
      },
      update: {
        status: RegistrationStatus.APPROVED,
        decidedAt: new Date(),
        decidedById: admin.id
      },
      create: {
        tournamentId: tournament.id,
        playerId: player.id,
        status: RegistrationStatus.APPROVED,
        decidedAt: new Date(),
        decidedById: admin.id
      }
    });
  }

  // ─── Audit log do seed ───────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      entityType: "seed",
      entityId: tournament.id,
      action: "seed.executed",
      after: {
        season: season.slug,
        tournament: tournament.slug,
        players: playerSeeds.map((e) => e.name),
        weeks: weeks.length,
        tournamentWeeks: weekDefs.length,
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
