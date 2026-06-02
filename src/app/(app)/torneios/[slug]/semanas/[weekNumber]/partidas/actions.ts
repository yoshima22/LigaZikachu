"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, getSessionUser } from "@/lib/auth/permissions";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { MatchStatus, ResultSource, Role, TournamentFormat, type Prisma } from "@prisma/client";
import { creditCoins } from "@/lib/zikacoins";
import { autoSaveWeekNarrative, autoSaveTournamentNarrative } from "@/lib/narrative";

const MATCH_WIN_COINS  = 35;
const MATCH_LOSS_COINS = 25;

/** Credita ZikaCoins ao vencedor e perdedor de uma partida confirmada */
async function awardMatchCoins(
  tx: Prisma.TransactionClient,
  match: { id: string; playerAId: string; playerBId: string | null; winnerPlayerId: string | null; tournamentWeek?: { tournamentId: string } | null }
) {
  if (!match.winnerPlayerId || !match.playerBId) return; // bye ou sem resultado

  const loserId = match.winnerPlayerId === match.playerAId ? match.playerBId : match.playerAId;

  await Promise.all([
    creditCoins(tx, {
      playerId: match.winnerPlayerId,
      type: "MATCH_WIN_REWARD",
      amount: MATCH_WIN_COINS,
      matchId: match.id,
      description: `Vitória na partida — +${MATCH_WIN_COINS} ZC`
    }),
    creditCoins(tx, {
      playerId: loserId,
      type: "MATCH_LOSS_REWARD",
      amount: MATCH_LOSS_COINS,
      matchId: match.id,
      description: `Participação na partida — +${MATCH_LOSS_COINS} ZC`
    })
  ]);
}

const generateMatchupsSchema = z.object({
  tournamentId: z.string().min(1),
  weekNumber: z.coerce.number().int().min(1).max(8),
});

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function generateMatchups(input: z.infer<typeof generateMatchupsSchema>) {
  const admin = await requireAdmin();
  const { tournamentId, weekNumber } = generateMatchupsSchema.parse(input);

  const week = await prisma.tournamentWeek.findUnique({
    where: { tournamentId_weekNumber: { tournamentId, weekNumber } },
    include: { tournament: true },
  });

  if (!week) throw new Error("Semana não encontrada");
  if (week.status !== "PLANNED" && week.status !== "OPEN") {
    throw new Error("Semana precisa estar em PLANNED ou OPEN para gerar confrontos");
  }

  const existingMatches = await prisma.match.count({
    where: { tournamentWeekId: week.id },
  });
  if (existingMatches > 0) {
    throw new Error("Confrontos já foram gerados para esta semana");
  }

  const registrations = await prisma.tournamentRegistration.findMany({
    where: { tournamentId, status: "APPROVED" },
    include: { player: true },
  });

  if (registrations.length < 2) {
    throw new Error("Precisa de pelo menos 2 jogadores inscritos");
  }

  const players = shuffleArray(registrations.map((r) => r.player));
  const matches: Array<{
    playerAId: string;
    playerBId: string;
    roundLabel: string;
    tournamentWeekId: string;
    createdById: string;
  }> = [];

  const n = players.length;
  const maxRounds = 3;

  if (week.mode === "DUPLAS_SINCRONIZADAS" && n >= 8) {
    // Semana 4: Duplas Sincronizadas
    // Pareamento: 1+8, 2+7, 3+6; 4o joga solo (Dupla Espelho)
    const sorted = [...players];
    const pairs = [
      [sorted[0], sorted[7]],
      [sorted[1], sorted[6]],
      [sorted[2], sorted[5]],
    ];
    const mirror = sorted[3];

    for (let round = 1; round <= maxRounds; round++) {
      for (const [p1, p2] of pairs) {
        if (p1 && p2) {
          matches.push({
            playerAId: p1.id,
            playerBId: p2.id,
            roundLabel: `Rodada ${round} — Dupla`,
            tournamentWeekId: week.id,
            createdById: admin.id,
          });
        }
      }
      // 4o colocado joga solo (3 partidas contra oponentes aleatorios do pool)
      if (mirror) {
        const opponents = shuffleArray(players.filter((p) => p.id !== mirror.id)).slice(0, 3);
        for (const opp of opponents) {
          matches.push({
            playerAId: mirror.id,
            playerBId: opp.id,
            roundLabel: `Rodada ${round} — Dupla Espelho`,
            tournamentWeekId: week.id,
            createdById: admin.id,
          });
        }
      }
    }
  } else if (week.mode === "GUERRA_DE_TIMES" && n >= 6) {
    // Semana 7: Guerra de Times
    // Time A: posicoes 1,3,5,7; Time B: 2,4,6,8
    const teamA = players.filter((_, i) => i % 2 === 0);
    const teamB = players.filter((_, i) => i % 2 === 1);

    for (let round = 1; round <= maxRounds; round++) {
      const shuffledA = shuffleArray(teamA);
      const shuffledB = shuffleArray(teamB);
      const pairCount = Math.min(shuffledA.length, shuffledB.length);
      for (let i = 0; i < pairCount; i++) {
        matches.push({
          playerAId: shuffledA[i].id,
          playerBId: shuffledB[i].id,
          roundLabel: `Rodada ${round} — Guerra de Times`,
          tournamentWeekId: week.id,
          createdById: admin.id,
        });
      }
    }
  } else {
    // Padrao: round-robin aleatorio, 3 partidas por jogador
    for (let round = 1; round <= maxRounds; round++) {
      const shuffled = shuffleArray(players);
      const used = new Set<string>();
      for (let i = 0; i < shuffled.length; i++) {
        if (used.has(shuffled[i].id)) continue;
        for (let j = i + 1; j < shuffled.length; j++) {
          if (used.has(shuffled[j].id)) continue;
          matches.push({
            playerAId: shuffled[i].id,
            playerBId: shuffled[j].id,
            roundLabel: `Rodada ${round}`,
            tournamentWeekId: week.id,
            createdById: admin.id,
          });
          used.add(shuffled[i].id);
          used.add(shuffled[j].id);
          break;
        }
      }
    }
  }

  await prisma.match.createMany({
    data: matches.map((m) => ({
      ...m,
      status: "PENDING_CONFIRMATION",
      bestOf: 1,
    })),
  });

  await prisma.tournamentWeek.update({
    where: { id: week.id },
    data: { status: "OPEN" },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      entityType: "tournament_week",
      entityId: week.id,
      action: "matchups.generated",
      after: { tournamentId, weekNumber, matchCount: matches.length },
    },
  });

  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}`);
  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}/partidas`);

  return { success: true, matchCount: matches.length };
}

const reportResultSchema = z.object({
  matchId: z.string().min(1),
  winnerId: z.string().min(1),
  winnerDefendedPrizes: z.coerce.number().int().min(0).max(99).default(0),
  notes: z.string().optional(),
});

const deckChoiceSchema = z.object({
  matchId: z.string().min(1),
  deckSubmissionId: z.string().min(1),
  applyToWeek: z.boolean().default(false),
});

const correctResultSchema = z.object({
  matchId: z.string().min(1),
  winnerId: z.string().min(1),
  winnerDefendedPrizes: z.coerce.number().int().min(0).max(99).default(0),
  notes: z.string().optional(),
});

function getMatchPoints(match: { playerAId: string; playerBId: string | null; tournamentWeek: { multiplier: unknown } | null }, winnerId: string) {
  const multiplier = match.tournamentWeek ? Number(match.tournamentWeek.multiplier) : 1;
  const winPoints = 3 * multiplier;

  return {
    rankingPointsA: winnerId === match.playerAId ? winPoints : 0,
    rankingPointsB: winnerId === match.playerBId ? winPoints : 0,
  };
}

export async function reportMatchResult(input: z.infer<typeof reportResultSchema>) {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado");

  const { matchId, winnerId, winnerDefendedPrizes, notes } = reportResultSchema.parse(input);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { playerA: true, playerB: true, tournamentWeek: { include: { tournament: true } } },
  });

  if (!match) throw new Error("Partida nao encontrada");
  if (!match.playerBId) throw new Error("Partida sem adversario");
  if (match.status !== MatchStatus.PENDING_CONFIRMATION) throw new Error("Partida ja foi reportada");

  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) throw new Error("Jogador nao encontrado");

  const isPlayer = match.playerAId === player.id || match.playerBId === player.id;
  const isInPerson = match.tournamentWeek?.tournament.format === TournamentFormat.IN_PERSON;
  const registeredInTournament = isInPerson
    ? await prisma.tournamentRegistration.findUnique({
        where: {
          tournamentId_playerId: {
            tournamentId: match.tournamentWeek!.tournamentId,
            playerId: player.id
          }
        },
        select: { status: true }
      })
    : null;
  const canReportInPerson =
    isInPerson &&
    (user.role === Role.ADMIN ||
      user.role === Role.SUPER_ADMIN ||
      match.tournamentWeek?.tournament.createdById === user.id ||
      registeredInTournament?.status === "APPROVED");

  if (!isPlayer && !canReportInPerson) throw new Error("Voce nao pode reportar esta partida");
  if (winnerId !== match.playerAId && winnerId !== match.playerBId) throw new Error("Vencedor invalido");

  const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId;
  const week = match.tournamentWeek;
  const multiplier = week ? Number(week.multiplier) : 1;
  const winPoints = 3 * multiplier;
  const now = new Date();

  await prisma.match.update({
    where: { id: matchId },
    data: {
      winnerPlayerId: winnerId,
      loserPlayerId: loserId,
      playerAWins: winnerId === match.playerAId ? 1 : 0,
      playerBWins: winnerId === match.playerBId ? 1 : 0,
      winnerDefendedPrizes,
      status: isInPerson ? MatchStatus.CONFIRMED : MatchStatus.PENDING_CONFIRMATION,
      reportedById: user.id,
      reportedAt: now,
      confirmedById: isInPerson ? user.id : null,
      confirmedAt: isInPerson ? now : null,
      rankingPointsA: isInPerson && winnerId === match.playerAId ? winPoints : 0,
      rankingPointsB: isInPerson && winnerId === match.playerBId ? winPoints : 0,
      resultSource: isInPerson ? ResultSource.MANUAL : undefined,
      notes: notes || null,
    },
  });

  if (isInPerson) {
    // Partida presencial já confirmada — credita ZikaCoins imediatamente
    const matchForCoins = { id: matchId, playerAId: match.playerAId, playerBId: match.playerBId, winnerPlayerId: winnerId };
    try {
      await prisma.$transaction(async (tx) => { await awardMatchCoins(tx, matchForCoins); });
    } catch { /* ignora erros de moedas para não bloquear o resultado */ }

    revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/semanas/${match.tournamentWeek?.weekNumber}/partidas`);
    revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/ranking`);
    revalidatePath("/ranking");
    revalidatePath("/dashboard");
    return { success: true, confirmed: true };
  }

  const reporterPlayerId = player.id;
  const opponentPlayerId = reporterPlayerId === match.playerAId ? match.playerBId : match.playerAId;

  await prisma.matchConfirmation.upsert({
    where: { matchId_playerId: { matchId, playerId: reporterPlayerId } },
    update: { status: "CONFIRMED", confirmedAt: now },
    create: { matchId, playerId: reporterPlayerId, status: "CONFIRMED", confirmedAt: now },
  });
  await prisma.matchConfirmation.upsert({
    where: { matchId_playerId: { matchId, playerId: opponentPlayerId } },
    update: { status: "PENDING", confirmedAt: null },
    create: { matchId, playerId: opponentPlayerId, status: "PENDING" },
  });

  revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/semanas/${match.tournamentWeek?.weekNumber}/partidas`);

  return { success: true };
}

export async function chooseMatchDeck(input: z.infer<typeof deckChoiceSchema>) {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado");

  const { matchId, deckSubmissionId, applyToWeek } = deckChoiceSchema.parse(input);
  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) throw new Error("Jogador nao encontrado");

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournamentWeek: { include: { tournament: true } } },
  });
  if (!match?.tournamentWeek) throw new Error("Partida nao encontrada");
  const tournamentWeekId = match.tournamentWeek.id;

  const side =
    match.playerAId === player.id ? "A" : match.playerBId === player.id ? "B" : null;
  if (!side) throw new Error("Voce nao participa desta partida");

  const deck = await prisma.deckSubmission.findUnique({
    where: { id: deckSubmissionId },
    select: { id: true, playerId: true, tournamentWeekId: true, deckName: true },
  });
  if (!deck || deck.playerId !== player.id || deck.tournamentWeekId !== match.tournamentWeekId) {
    throw new Error("Deck invalido para esta partida");
  }

  if (applyToWeek) {
    await prisma.$transaction([
      prisma.match.updateMany({
        where: {
          tournamentWeekId,
          playerAId: player.id,
          status: { not: MatchStatus.CANCELED },
        },
        data: { playerADeckSubmissionId: deck.id },
      }),
      prisma.match.updateMany({
        where: {
          tournamentWeekId,
          playerBId: player.id,
          status: { not: MatchStatus.CANCELED },
        },
        data: { playerBDeckSubmissionId: deck.id },
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          entityType: "tournamentWeek",
          entityId: tournamentWeekId,
          action: "match_deck_choice.applied_to_week",
          after: { playerId: player.id, deckSubmissionId: deck.id, deckName: deck.deckName },
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.match.update({
        where: { id: match.id },
        data: side === "A" ? { playerADeckSubmissionId: deck.id } : { playerBDeckSubmissionId: deck.id },
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          entityType: "match",
          entityId: match.id,
          action: "match_deck_choice.updated",
          after: { playerId: player.id, deckSubmissionId: deck.id, deckName: deck.deckName },
        },
      }),
    ]);
  }

  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`);
  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}`);
  return { success: true };
}

export async function correctMatchResult(input: z.infer<typeof correctResultSchema>) {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado");

  const { matchId, winnerId, winnerDefendedPrizes, notes } = correctResultSchema.parse(input);
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      tournamentWeek: { include: { tournament: true } },
      confirmations: true,
    },
  });
  if (!match?.playerBId || !match.tournamentWeek) throw new Error("Partida nao encontrada");
  const playerBId = match.playerBId;
  if (winnerId !== match.playerAId && winnerId !== match.playerBId) throw new Error("Vencedor invalido");

  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  const isParticipant = !!player && (match.playerAId === player.id || match.playerBId === player.id);
  const canCorrect =
    user.role === Role.ADMIN ||
    user.role === Role.SUPER_ADMIN ||
    match.tournamentWeek.tournament.createdById === user.id ||
    isParticipant;
  if (!canCorrect) throw new Error("Voce nao pode corrigir esta partida");

  const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId;
  const points = getMatchPoints(match, winnerId);
  const isInPerson = match.tournamentWeek.tournament.format === TournamentFormat.IN_PERSON;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        winnerPlayerId: winnerId,
        loserPlayerId: loserId,
        playerAWins: winnerId === match.playerAId ? 1 : 0,
        playerBWins: winnerId === match.playerBId ? 1 : 0,
        winnerDefendedPrizes,
        rankingPointsA: points.rankingPointsA,
        rankingPointsB: points.rankingPointsB,
        status: isInPerson ? MatchStatus.CONFIRMED : MatchStatus.PENDING_CONFIRMATION,
        resultSource: ResultSource.ADMIN_ADJUSTMENT,
        reportedById: user.id,
        reportedAt: now,
        confirmedById: isInPerson ? user.id : null,
        confirmedAt: isInPerson ? now : null,
        notes: notes || match.notes,
      },
    });

    if (!isInPerson) {
      await tx.matchConfirmation.deleteMany({ where: { matchId: match.id } });
      if (player) {
        const opponentPlayerId = player.id === match.playerAId ? playerBId : match.playerAId;
        await tx.matchConfirmation.createMany({
          data: [
            { matchId: match.id, playerId: player.id, status: "CONFIRMED", confirmedAt: now },
            { matchId: match.id, playerId: opponentPlayerId, status: "PENDING" },
          ],
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "match",
        entityId: match.id,
        action: "match.result_corrected",
        before: {
          winnerPlayerId: match.winnerPlayerId,
          winnerDefendedPrizes: match.winnerDefendedPrizes,
          status: match.status,
        },
        after: { winnerPlayerId: winnerId, winnerDefendedPrizes },
      },
    });
  });

  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`);
  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/ranking`);
  revalidatePath("/ranking");
  revalidatePath("/dashboard");
  return { success: true };
}
const confirmResultSchema = z.object({
  matchId: z.string().min(1),
});

export async function confirmMatchResult(input: z.infer<typeof confirmResultSchema>) {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado");

  const { matchId } = confirmResultSchema.parse(input);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      playerA: true,
      playerB: true,
      confirmations: true,
      tournamentWeek: { include: { tournament: true } }
    },
  });

  if (!match) throw new Error("Partida nao encontrada");
  if (!match.playerBId) throw new Error("Partida sem adversario");
  if (!match.winnerPlayerId) throw new Error("Nenhum resultado foi reportado para esta partida");
  if (match.status !== "PENDING_CONFIRMATION") throw new Error("Esta partida nao esta pendente de confirmacao");

  const player = await prisma.player.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!player) throw new Error("Jogador nao encontrado");

  const participantIds = [match.playerAId, match.playerBId];
  if (!participantIds.includes(player.id)) throw new Error("Voce nao participa desta partida");

  const now = new Date();
  const confirmations = await prisma.$transaction(async (tx) => {
    await tx.matchConfirmation.upsert({
      where: { matchId_playerId: { matchId, playerId: player.id } },
      update: { status: "CONFIRMED", confirmedAt: now },
      create: { matchId, playerId: player.id, status: "CONFIRMED", confirmedAt: now },
    });

    return tx.matchConfirmation.findMany({
      where: { matchId, playerId: { in: participantIds } },
    });
  });

  const confirmedPlayerIds = new Set(
    confirmations
      .filter((confirmation) => confirmation.status === "CONFIRMED")
      .map((confirmation) => confirmation.playerId)
  );
  const allConfirmed = participantIds.every((participantId) => confirmedPlayerIds.has(participantId));

  if (allConfirmed) {
    const points = getMatchPoints(match, match.winnerPlayerId);
    const lossPoints = 0;

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: "CONFIRMED",
          confirmedById: user.id,
          confirmedAt: now,
          rankingPointsA: match.winnerPlayerId === match.playerAId ? points.rankingPointsA : lossPoints,
          rankingPointsB: match.winnerPlayerId === match.playerBId ? points.rankingPointsB : lossPoints,
        },
      });
      // Credita ZikaCoins: vencedor +35 ZC, perdedor +25 ZC
      await awardMatchCoins(tx, match);
    });
  }

  revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/semanas/${match.tournamentWeek?.weekNumber}/partidas`);
  revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/ranking`);
  revalidatePath("/ranking");
  revalidatePath("/dashboard");

  // Regenera narrativa da semana em background após cada confirmação
  const weekIdForNarrative = match.tournamentWeekId;
  if (weekIdForNarrative) {
    after(async () => {
      await autoSaveWeekNarrative(weekIdForNarrative).catch(err =>
        console.error("[AutoNarrative:week]", err)
      );
    });
  }

  return { success: true, confirmed: allConfirmed };
}

const disputeSchema = z.object({
  matchId: z.string().min(1),
  reason: z.string().min(1),
});

export async function disputeMatchResult(input: z.infer<typeof disputeSchema>) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado");

  const { matchId, reason } = disputeSchema.parse(input);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { playerA: true, playerB: true, tournamentWeek: { include: { tournament: true } } },
  });

  if (!match) throw new Error("Partida não encontrada");
  if (!match.playerBId) throw new Error("Partida sem adversário");

  const player = await prisma.player.findUnique({ where: { userId: user.id } });
  if (!player) throw new Error("Jogador não encontrado");

  const isPlayer = match.playerAId === player.id || match.playerBId === player.id;
  if (!isPlayer) throw new Error("Você não participa desta partida");

  await prisma.match.update({
    where: { id: matchId },
    data: { status: "DISPUTED", notes: reason },
  });

  await prisma.matchConfirmation.upsert({
    where: { matchId_playerId: { matchId, playerId: player.id } },
    update: { status: "REJECTED" },
    create: { matchId, playerId: player.id, status: "REJECTED" },
  });

  revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/semanas/${match.tournamentWeek?.weekNumber}/partidas`);

  return { success: true };
}

const adminResolveSchema = z.object({
  matchId: z.string().min(1),
  winnerId: z.string().min(1),
  winnerDefendedPrizes: z.coerce.number().int().min(0).max(99).default(0),
  notes: z.string().optional(),
});

export async function adminResolveMatch(input: z.infer<typeof adminResolveSchema>) {
  const admin = await requireAdmin();
  const { matchId, winnerId, winnerDefendedPrizes, notes } = adminResolveSchema.parse(input);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournamentWeek: { include: { tournament: true } } },
  });

  if (!match) throw new Error("Partida não encontrada");

  if (winnerId !== match.playerAId && winnerId !== match.playerBId) {
    throw new Error("Vencedor inválido");
  }

  const loserId = winnerId === match.playerAId ? match.playerBId : match.playerAId;
  const week = match.tournamentWeek;
  const multiplier = week ? Number(week.multiplier) : 1;
  const winPoints = 3 * multiplier;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      winnerPlayerId: winnerId,
      loserPlayerId: loserId,
      playerAWins: winnerId === match.playerAId ? 1 : 0,
      playerBWins: winnerId === match.playerBId ? 1 : 0,
      winnerDefendedPrizes,
      status: "CONFIRMED",
      resultSource: "ADMIN_ADJUSTMENT",
      rankingPointsA: winnerId === match.playerAId ? winPoints : 0,
      rankingPointsB: winnerId === match.playerBId ? winPoints : 0,
      notes: notes || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      entityType: "match",
      entityId: matchId,
      action: "match.admin_resolved",
      after: { winnerId, winnerDefendedPrizes, notes },
    },
  });

  revalidatePath(`/torneios/${week?.tournament.slug}/semanas/${week?.weekNumber}/partidas`);

  return { success: true };
}

export async function closeWeek(tournamentId: string, weekNumber: number) {
  const admin = await requireAdmin();

  const week = await prisma.tournamentWeek.findUnique({
    where: { tournamentId_weekNumber: { tournamentId, weekNumber } },
    include: { tournament: true },
  });

  if (!week) throw new Error("Semana não encontrada");

  await prisma.tournamentWeek.update({
    where: { id: week.id },
    data: { status: "CLOSED" },
  });

  // Liquidar apostas da ZikaBet deste dia
  const { settleDayBets } = await import("@/app/(app)/zikabet/actions");
  await settleDayBets(week.id, admin.id);

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      entityType: "tournament_week",
      entityId: week.id,
      action: "week.closed",
    },
  });

  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}`);
  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}/partidas`);
  revalidatePath(`/torneios/${week.tournament.slug}`);
  revalidatePath("/zikabet");

  // Ao encerrar a semana: regenera narrativa da semana + análise geral do torneio
  const narrativeWeekId = week.id;
  const narrativeTournamentId = week.tournament.id;
  const narrativeSlug = week.tournament.slug;
  after(async () => {
    await Promise.all([
      autoSaveWeekNarrative(narrativeWeekId).catch(err => console.error("[AutoNarrative:week:close]", err)),
      autoSaveTournamentNarrative(narrativeTournamentId, narrativeSlug).catch(err => console.error("[AutoNarrative:tournament:close]", err)),
    ]);
  });

  return { success: true };
}
