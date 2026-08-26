"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, getSessionUser } from "@/lib/auth/permissions";
import { getSessionPlayer } from "@/lib/session";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { MatchStatus, ResultSource, Role, TournamentFormat, ZikaCoinTxType, type Prisma } from "@prisma/client";
import { creditCoins } from "@/lib/zikacoins";
import { autoSaveWeekNarrative, autoSaveTournamentNarrative } from "@/lib/narrative";
import { addExp, applyMatchResultToMascot, battleMascots } from "@/lib/mascot";
import { rewardEquippedMascot } from "@/lib/mascot";
import { maybeDropSyncTicket } from "@/lib/sync-challenge";
import { isDeckRegistrationLocked } from "@/lib/decks";
import { drawEnguicaContract, ENGUICA_BOX_REWARD_LABEL } from "@/lib/tcg-enguica-contracts";
import { parseTournamentRewardConfig } from "@/lib/tcg-tournament-rewards";
import { computeTournamentRanking } from "@/lib/ranking";
import { announceTournamentDispute, announceTournamentResult } from "@/lib/tournament-ticker";
import { parseBetConfig } from "@/lib/zikabet";

const MATCH_WIN_COINS  = 180;
const MATCH_LOSS_COINS = 120;
const MASCOT_MISSION_PARTICIPATION_EXP = 150;
const MASCOT_MISSION_WIN_EXP = 300;

type EnguicaMatchContext = {
  id: string;
  playerAId: string;
  playerBId: string | null;
  tournamentWeekId: string | null;
  tournamentWeek: {
    id: string;
    status: string;
    enguicaContractKey: string | null;
    enguicaContractTitle: string | null;
    tournament: { enguicaContractsEnabled: boolean };
  } | null;
};

async function recordEnguicaCompletion(
  tx: Prisma.TransactionClient,
  match: EnguicaMatchContext,
  playerId: string,
  completed: boolean,
) {
  if (!completed) return;
  if (!match.playerBId || ![match.playerAId, match.playerBId].includes(playerId)) {
    throw new Error("Apenas participantes podem declarar o Contrato do Enguiça.");
  }
  const week = match.tournamentWeek;
  if (!week?.tournament.enguicaContractsEnabled || !week.enguicaContractKey) {
    throw new Error("Nenhum Contrato do Enguiça foi revelado para esta semana.");
  }
  if (week.status === "CLOSED") throw new Error("Esta semana já foi encerrada.");

  await tx.tournamentEnguicaCompletion.upsert({
    where: { tournamentWeekId_playerId: { tournamentWeekId: week.id, playerId } },
    update: {
      matchId: match.id,
      contractKey: week.enguicaContractKey,
      completedAt: new Date(),
    },
    create: {
      tournamentWeekId: week.id,
      playerId,
      matchId: match.id,
      contractKey: week.enguicaContractKey,
    },
  });
}

async function awardEnguicaBoxesAtWeekClose(weekId: string) {
  const completions = await prisma.tournamentEnguicaCompletion.findMany({
    where: {
      tournamentWeekId: weekId,
      rewardedAt: null,
      match: { status: MatchStatus.CONFIRMED },
    },
    include: {
      tournamentWeek: { select: { enguicaContractTitle: true } },
    },
  });

  let rewardedPlayers = 0;
  let ticketWinners = 0;
  for (const completion of completions) {
    const ticketAwarded = Math.random() < 0.05;
    const result = await prisma.$transaction(async (tx) => {
      const reserved = await tx.tournamentEnguicaCompletion.updateMany({
        where: { id: completion.id, rewardedAt: null },
        data: { rewardedAt: new Date() },
      });
      if (reserved.count === 0) return false;

      const gift = await tx.playerGift.create({
        data: {
          playerId: completion.playerId,
          type: "CUSTOM",
          title: `Caixa Enguiça — ${completion.tournamentWeek.enguicaContractTitle ?? "Contrato concluído"}`,
          description: "Contrato validado no encerramento oficial do dia. Abra a caixa para receber as recompensas.",
          payload: {
            rewardKind: "ENGUICA_BOX",
            rewardLabel: ENGUICA_BOX_REWARD_LABEL,
            coins: 150,
            food: 1,
            sweet: 1,
            creationDust: 3,
            ticketAwarded,
            contractKey: completion.contractKey,
          },
        },
      });
      await tx.tournamentEnguicaCompletion.update({
        where: { id: completion.id },
        data: { giftId: gift.id },
      });
      return true;
    });
    if (result) {
      rewardedPlayers++;
      if (ticketAwarded) ticketWinners++;
    }
  }
  return { rewardedPlayers, ticketWinners };
}

async function awardMascotMissionExpAtWeekClose(weekId: string) {
  const [submissions, matches] = await Promise.all([
    prisma.deckSubmission.findMany({
      where: {
        tournamentWeekId: weekId,
        mascotMissionValid: true,
        mascotMissionMascotId: { not: null },
        mascotMissionRewardedAt: null,
      },
      select: {
        id: true,
        playerId: true,
        mascotMissionMascotId: true,
      },
    }),
    prisma.match.findMany({
      where: { tournamentWeekId: weekId, status: MatchStatus.CONFIRMED, playerBId: { not: null } },
      select: {
        id: true,
        playerAId: true,
        playerBId: true,
        winnerPlayerId: true,
        playerADeckSubmissionId: true,
        playerBDeckSubmissionId: true,
      },
    }),
  ]);

  let rewardedMascots = 0;
  let totalExp = 0;
  for (const submission of submissions) {
    const linkedMatches = matches.filter((match) =>
      (match.playerAId === submission.playerId && match.playerADeckSubmissionId === submission.id)
      || (match.playerBId === submission.playerId && match.playerBDeckSubmissionId === submission.id),
    );
    if (linkedMatches.length === 0 || !submission.mascotMissionMascotId) continue;

    const wins = linkedMatches.filter((match) => match.winnerPlayerId === submission.playerId).length;
    const exp = linkedMatches.length * MASCOT_MISSION_PARTICIPATION_EXP
      + wins * MASCOT_MISSION_WIN_EXP;
    const claimed = await prisma.deckSubmission.updateMany({
      where: { id: submission.id, mascotMissionRewardedAt: null },
      data: { mascotMissionRewardedAt: new Date(), mascotMissionExpAwarded: exp },
    });
    if (claimed.count === 0) continue;

    try {
      await addExp(submission.mascotMissionMascotId, exp, { ignoreBenchPenalty: true });
      await prisma.mascotEvent.create({
        data: {
          mascotId: submission.mascotMissionMascotId,
          emoji: "🎴",
          description: `Missão de Mascote encerrada: +${exp} EXP (${linkedMatches.length} participação(ões) e ${wins} vitória(s)).`,
        },
      }).catch(() => null);
      rewardedMascots++;
      totalExp += exp;
    } catch (error) {
      await prisma.deckSubmission.updateMany({
        where: { id: submission.id, mascotMissionExpAwarded: exp },
        data: { mascotMissionRewardedAt: null, mascotMissionExpAwarded: 0 },
      });
      console.error("[MascotMission:week-close]", submission.id, error);
    }
  }

  return { rewardedMascots, totalExp };
}

/** Credita ZikaCoins ao vencedor e perdedor de uma partida confirmada */
async function awardMatchCoins(
  tx: Prisma.TransactionClient,
  match: {
    id: string;
    playerAId: string;
    playerBId: string | null;
    winnerPlayerId: string | null;
    tournamentWeekId?: string | null;
    tournamentWeek?: { id?: string; tournamentId: string; tournament?: { rewardConfig: Prisma.JsonValue | null } } | null;
  }
) {
  if (!match.winnerPlayerId || !match.playerBId) return;
  if (parseTournamentRewardConfig(match.tournamentWeek?.tournament?.rewardConfig)) return;

  const loserId = match.winnerPlayerId === match.playerAId ? match.playerBId : match.playerAId;
  const existingRewards = await tx.zikaCoinTransaction.findMany({
    where: {
      matchId: match.id,
      type: { in: [ZikaCoinTxType.MATCH_WIN_REWARD, ZikaCoinTxType.MATCH_LOSS_REWARD] },
      status: "COMPLETED",
    },
    select: { type: true, wallet: { select: { playerId: true } } },
  });
  const hasReward = (playerId: string, type: ZikaCoinTxType) =>
    existingRewards.some((reward) => reward.wallet.playerId === playerId && reward.type === type);
  const tournamentId = match.tournamentWeek?.tournamentId ?? null;
  const tournamentWeekId = match.tournamentWeekId ?? match.tournamentWeek?.id ?? null;

  if (!hasReward(match.winnerPlayerId, ZikaCoinTxType.MATCH_WIN_REWARD)) {
    await creditCoins(tx, {
      playerId: match.winnerPlayerId,
      type: ZikaCoinTxType.MATCH_WIN_REWARD,
      amount: MATCH_WIN_COINS,
      matchId: match.id,
      tournamentId: tournamentId ?? undefined,
      tournamentWeekId: tournamentWeekId ?? undefined,
      description: `Vitoria na partida - +${MATCH_WIN_COINS} ZC`,
    });
  }
  if (!hasReward(loserId, ZikaCoinTxType.MATCH_LOSS_REWARD)) {
    await creditCoins(tx, {
      playerId: loserId,
      type: ZikaCoinTxType.MATCH_LOSS_REWARD,
      amount: MATCH_LOSS_COINS,
      matchId: match.id,
      tournamentId: tournamentId ?? undefined,
      tournamentWeekId: tournamentWeekId ?? undefined,
      description: `Participacao na partida - +${MATCH_LOSS_COINS} ZC`,
    });
  }
  await maybeDropSyncTicket(tx, match.winnerPlayerId, "tcg-match-win").catch(() => null);
}

async function rewardMascotsForConfirmedMatch(match: {
  playerAId: string;
  playerBId: string | null;
  winnerPlayerId: string | null;
}) {
  if (!match.playerBId || !match.winnerPlayerId) return;

  await Promise.all([
    rewardEquippedMascot(match.playerAId, "MATCH_PLAYED"),
    rewardEquippedMascot(match.playerBId, "MATCH_PLAYED"),
    rewardEquippedMascot(match.winnerPlayerId, "MATCH_WIN"),
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
    scheduledAt?: Date;
    betsEnabled?: boolean;
  }> = [];

  const n = players.length;
  const maxRounds = 3;

  const bonusRule = week.bonusRule && typeof week.bonusRule === "object" && !Array.isArray(week.bonusRule)
    ? week.bonusRule as Record<string, unknown>
    : null;
  const fixedMatchups = Array.isArray(bonusRule?.fixedMatchups)
    ? bonusRule.fixedMatchups as Array<Record<string, unknown>>
    : [];

  if (fixedMatchups.length > 0) {
    const registrationIds = new Set(registrations.map((registration) => registration.playerId));
    const ranking = await computeTournamentRanking(tournamentId);
    const rankToPlayerId = new Map(ranking.map((entry, index) => [index + 1, entry.playerId]));
    const resolvePlayer = (entry: Record<string, unknown>, side: "A" | "B") => {
      const fixedId = typeof entry[`player${side}Id`] === "string" ? String(entry[`player${side}Id`]) : null;
      const rank = Number(entry[`player${side}Rank`] ?? 0);
      const playerId = fixedId || rankToPlayerId.get(rank) || null;
      if (!playerId || !registrationIds.has(playerId)) throw new Error(`Nao foi possivel resolver o participante ${side} do Jogo ${entry.game ?? "?"}.`);
      return playerId;
    };
    for (const entry of fixedMatchups) {
      const dayOffset = Math.max(0, Number(entry.dayOffset ?? 0));
      const scheduledAt = new Date(week.startDate);
      scheduledAt.setUTCDate(scheduledAt.getUTCDate() + dayOffset);
      matches.push({
        playerAId: resolvePlayer(entry, "A"),
        playerBId: resolvePlayer(entry, "B"),
        roundLabel: String(entry.label ?? `Jogo ${entry.game ?? matches.length + 1}`),
        tournamentWeekId: week.id,
        createdById: admin.id,
        scheduledAt,
      });
    }
  } else if (week.mode === "DUPLAS_SINCRONIZADAS" && n >= 8) {
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
    // Grafo regular: todos recebem exatamente a quantidade configurada,
    // sem BYE persistido e sem repetir o mesmo confronto.
    const requested = week.tournament.format === TournamentFormat.IN_PERSON
      ? (week.tournament.matchesPerPlayer ?? Math.min(3, n - 1))
      : Math.min(3, n - 1);
    const matchesPerPlayer = Math.min(requested, n - 1);

    if (matchesPerPlayer < 1) throw new Error("Quantidade de partidas por jogador precisa ser maior que zero");
    if ((n * matchesPerPlayer) % 2 !== 0) {
      throw new Error(`Com ${n} jogadores, escolha uma quantidade par de partidas por jogador para evitar BYE.`);
    }

    const pairKeys = new Set<string>();
    const addPair = (aIndex: number, bIndex: number) => {
      const a = players[aIndex];
      const b = players[bIndex];
      if (!a || !b || a.id === b.id) return;
      const key = [a.id, b.id].sort().join(":");
      if (pairKeys.has(key)) return;
      pairKeys.add(key);
      matches.push({
        playerAId: a.id,
        playerBId: b.id,
        roundLabel: `Rodada ${matches.length + 1}`,
        tournamentWeekId: week.id,
        createdById: admin.id,
      });
    };

    for (let distance = 1; distance <= Math.floor(matchesPerPlayer / 2); distance++) {
      for (let i = 0; i < n; i++) addPair(i, (i + distance) % n);
    }

    if (matchesPerPlayer % 2 === 1) {
      if (n % 2 !== 0) throw new Error("Numero impar de jogadores exige quantidade par de partidas por jogador.");
      for (let i = 0; i < n / 2; i++) addPair(i, i + n / 2);
    }
  }

  await prisma.match.createMany({
    data: matches.map((m) => ({
      ...m,
      betsEnabled: parseBetConfig(week.tournament.betConfig).enabled,
      scheduledAt: m.scheduledAt ?? week.startDate,
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
  enguicaContractCompleted: z.boolean().default(false),
  opponentGymBadgeValid: z.boolean().optional(),
});

function gymValidationWasReviewedByAdmin(value: Prisma.JsonValue | null): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && "reviewedById" in value);
}

async function registerOpponentGymReview(
  tx: Prisma.TransactionClient,
  input: { submissionId: string | null; valid: boolean | undefined; reporterPlayerId: string; matchId: string },
) {
  if (!input.submissionId || input.valid === undefined) return;
  const submission = await tx.deckSubmission.findUnique({
    where: { id: input.submissionId },
    select: { id: true, gymBadgeId: true, gymBadge: { select: { name: true } }, gymBadgeValidation: true },
  });
  if (!submission?.gymBadgeId || gymValidationWasReviewedByAdmin(submission.gymBadgeValidation)) return;
  await tx.deckSubmission.update({
    where: { id: submission.id },
    data: {
      gymBadgeValid: input.valid,
      gymBadgeValidation: {
        status: input.valid ? "VALID" : "INVALID",
        source: "PLAYER_CONFIRMATION",
        badgeName: submission.gymBadge?.name ?? null,
        reporterPlayerId: input.reporterPlayerId,
        matchId: input.matchId,
        reportedAt: new Date().toISOString(),
      },
    },
  });
}

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

  const { matchId, winnerId, winnerDefendedPrizes, notes, enguicaContractCompleted, opponentGymBadgeValid } = reportResultSchema.parse(input);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { playerA: true, playerB: true, tournamentWeek: { include: { tournament: true } } },
  });

  if (!match) throw new Error("Partida nao encontrada");
  if (!match.playerBId) throw new Error("Partida sem adversario");
  if (match.status !== MatchStatus.PENDING_CONFIRMATION) throw new Error("Partida ja foi reportada");

  const player = await getSessionPlayer(user.id);
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
  const reporterPlayerId = player.id;
  const opponentPlayerId = reporterPlayerId === match.playerAId ? match.playerBId : match.playerAId;

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
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
    if (isPlayer) {
      await recordEnguicaCompletion(tx, match, player.id, enguicaContractCompleted);
      await registerOpponentGymReview(tx, {
        submissionId: player.id === match.playerAId ? match.playerBDeckSubmissionId : match.playerADeckSubmissionId,
        valid: opponentGymBadgeValid,
        reporterPlayerId: player.id,
        matchId,
      });
    }
    // O resultado e o estado de confirmação precisam nascer juntos. Antes estas
    // confirmações eram gravadas depois da transação; qualquer falha de UI ou de
    // anúncio podia deixar um resultado salvo pela metade.
    if (!isInPerson) {
      await tx.matchConfirmation.upsert({
        where: { matchId_playerId: { matchId, playerId: reporterPlayerId } },
        update: { status: "CONFIRMED", confirmedAt: now },
        create: { matchId, playerId: reporterPlayerId, status: "CONFIRMED", confirmedAt: now },
      });
      await tx.matchConfirmation.upsert({
        where: { matchId_playerId: { matchId, playerId: opponentPlayerId } },
        update: { status: "PENDING", confirmedAt: null },
        create: { matchId, playerId: opponentPlayerId, status: "PENDING" },
      });
    }
  });

  // O megafone é complementar: uma indisponibilidade nele nunca pode fazer a
  // interface dizer que o registro principal falhou depois de já ter sido salvo.
  await announceTournamentResult(match, winnerId, match.playerAId, "REGISTERED").catch((error) => {
    console.error("[TournamentResult] Resultado salvo, mas o anúncio falhou", { matchId, error });
  });

  if (isInPerson) {
    // Partida presencial já confirmada — credita ZikaCoins imediatamente
    const matchForCoins = {
      id: matchId,
      playerAId: match.playerAId,
      playerBId: match.playerBId,
      winnerPlayerId: winnerId,
      tournamentWeekId: match.tournamentWeekId,
      tournamentWeek: match.tournamentWeek
        ? { id: match.tournamentWeek.id, tournamentId: match.tournamentWeek.tournamentId, tournament: { rewardConfig: match.tournamentWeek.tournament.rewardConfig } }
        : null,
    };
    try {
      await prisma.$transaction(async (tx) => { await awardMatchCoins(tx, matchForCoins); });
    } catch { /* ignora erros de moedas para não bloquear o resultado */ }
    await rewardMascotsForConfirmedMatch(matchForCoins).catch(() => {});

    revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/semanas/${match.tournamentWeek?.weekNumber}/partidas`);
    revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/ranking`);
    revalidatePath("/ranking"); revalidateTag("ranking");
    revalidatePath("/dashboard");
    return { success: true, confirmed: true };
  }

  revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/semanas/${match.tournamentWeek?.weekNumber}/partidas`);

  return { success: true };
}

export async function chooseMatchDeck(input: z.infer<typeof deckChoiceSchema>) {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado");

  const { matchId, deckSubmissionId, applyToWeek } = deckChoiceSchema.parse(input);
  const player = await getSessionPlayer(user.id);
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
      playerA: { select: { displayName: true } },
      playerB: { select: { displayName: true } },
      tournamentWeek: { include: { tournament: true } },
      confirmations: true,
    },
  });
  if (!match?.playerBId || !match.tournamentWeek) throw new Error("Partida nao encontrada");
  const playerBId = match.playerBId;
  if (winnerId !== match.playerAId && winnerId !== match.playerBId) throw new Error("Vencedor invalido");

  const player = await getSessionPlayer(user.id);
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

  if (isInPerson && match.status !== MatchStatus.CONFIRMED) {
    await rewardMascotsForConfirmedMatch({
      playerAId: match.playerAId,
      playerBId: match.playerBId,
      winnerPlayerId: winnerId,
    }).catch(() => {});
  }

  await announceTournamentResult(match, winnerId, match.playerAId, "CORRECTED");

  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`);
  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/ranking`);
  revalidatePath("/ranking");
  revalidatePath("/dashboard");
  return { success: true };
}
const confirmResultSchema = z.object({
  matchId: z.string().min(1),
  enguicaContractCompleted: z.boolean().default(false),
  opponentGymBadgeValid: z.boolean().optional(),
});

const updateMatchScheduleSchema = z.object({
  matchId: z.string().min(1),
  scheduledAt: z.string().datetime(),
});

export async function updateMatchSchedule(input: z.infer<typeof updateMatchScheduleSchema>): Promise<{ success?: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Não autenticado." };
  const parsed = updateMatchScheduleSchema.safeParse(input);
  if (!parsed.success) return { error: "Data e horário inválidos." };
  const { matchId, scheduledAt: scheduledAtIso } = parsed.data;
  const scheduledAt = new Date(scheduledAtIso);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournamentWeek: { include: { tournament: { select: { slug: true } } } } },
  });
  if (!match?.tournamentWeek) return { error: "Partida ou semana não encontrada." };
  if (match.status === MatchStatus.CANCELED) return { error: "Uma partida cancelada não pode ser reagendada." };

  const player = await getSessionPlayer(user.id);
  const admin = user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
  const participant = Boolean(player && (match.playerAId === player.id || match.playerBId === player.id));
  if (!admin && !participant) return { error: "Apenas os participantes ou um administrador podem alterar este horário." };

  // Sem janela de início/fim: define-se apenas o horário de início da partida.
  await prisma.$transaction(async (tx) => {
    await tx.match.update({ where: { id: matchId }, data: { scheduledAt } });
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        entityType: "match",
        entityId: matchId,
        action: "match.schedule.updated",
        before: { scheduledAt: match.scheduledAt?.toISOString() ?? null },
        after: { scheduledAt: scheduledAt.toISOString() },
      },
    });
  });

  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`);
  return { success: true };
}

export async function confirmMatchResult(input: z.infer<typeof confirmResultSchema>) {
  const user = await getSessionUser();
  if (!user) throw new Error("Nao autenticado");

  const { matchId, enguicaContractCompleted, opponentGymBadgeValid } = confirmResultSchema.parse(input);

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

  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador nao encontrado");

  const participantIds = [match.playerAId, match.playerBId];
  if (!participantIds.includes(player.id)) throw new Error("Voce nao participa desta partida");

  const now = new Date();
  const confirmations = await prisma.$transaction(async (tx) => {
    await recordEnguicaCompletion(tx, match, player.id, enguicaContractCompleted);
    await registerOpponentGymReview(tx, {
      submissionId: player.id === match.playerAId ? match.playerBDeckSubmissionId : match.playerADeckSubmissionId,
      valid: opponentGymBadgeValid,
      reporterPlayerId: player.id,
      matchId,
    });
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
    await rewardMascotsForConfirmedMatch(match).catch(() => {});
  }

  revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/semanas/${match.tournamentWeek?.weekNumber}/partidas`);
  revalidatePath(`/torneios/${match.tournamentWeek?.tournament.slug}/ranking`);
  revalidatePath("/ranking");
  revalidatePath("/dashboard");

  // Narrativa + mascote em background
  const weekIdForNarrative = match.tournamentWeekId;
  const winnerPlayerId = match.winnerPlayerId;
  const loserPlayerId  = winnerPlayerId === match.playerAId ? match.playerBId : match.playerAId;
  after(async () => {
    if (weekIdForNarrative) {
      await autoSaveWeekNarrative(weekIdForNarrative).catch(() => {});
    }
    // Aplica resultado da partida nos mascotes de cada jogador
    if (winnerPlayerId) {
      const [winnerPlayer, loserPlayer] = await Promise.all([
        prisma.player.findUnique({ where: { id: winnerPlayerId }, select: { id: true } }),
        loserPlayerId ? prisma.player.findUnique({ where: { id: loserPlayerId }, select: { id: true } }) : null,
      ]);
      if (winnerPlayer) await applyMatchResultToMascot(winnerPlayer.id, true).catch(() => {});
      if (loserPlayer)  await applyMatchResultToMascot(loserPlayer.id, false).catch(() => {});

      // Batalha automática entre mascotes equipados dos dois treinadores
      if (winnerPlayer && loserPlayer) {
        const [mascotA, mascotB] = await Promise.all([
          prisma.mascot.findFirst({ where: { playerId: winnerPlayer.id, isEquipped: true }, select: { id: true } }),
          prisma.mascot.findFirst({ where: { playerId: loserPlayer.id,  isEquipped: true }, select: { id: true } }),
        ]);
        if (mascotA && mascotB) {
          await battleMascots(mascotA.id, mascotB.id).catch(() => {});
        }
      }
    }
  });

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

  const player = await getSessionPlayer(user.id);
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

  await announceTournamentDispute(match);

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
    include: {
      playerA: { select: { displayName: true } },
      playerB: { select: { displayName: true } },
      tournamentWeek: { include: { tournament: true } },
    },
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

  if (match.status !== MatchStatus.CONFIRMED) {
    await rewardMascotsForConfirmedMatch({
      playerAId: match.playerAId,
      playerBId: match.playerBId,
      winnerPlayerId: winnerId,
    }).catch(() => {});
  }


  await announceTournamentResult(match, winnerId, match.playerAId, "CORRECTED");

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

  // A missão é liquidada somente no encerramento oficial do dia. O marcador na
  // inscrição evita EXP duplicada caso o admin execute o fechamento novamente.
  const usesDailyClose = Boolean(parseTournamentRewardConfig(week.tournament.rewardConfig));
  const mascotMissionRewards = week.tournament.mascotMissionEnabled && !usesDailyClose
    ? await awardMascotMissionExpAtWeekClose(week.id)
    : { rewardedMascots: 0, totalExp: 0 };
  const enguicaContractRewards = week.tournament.enguicaContractsEnabled && week.enguicaContractKey && !usesDailyClose
    ? await awardEnguicaBoxesAtWeekClose(week.id)
    : { rewardedPlayers: 0, ticketWinners: 0 };

  // Liquidar apostas da ZikaBet deste dia
  const { settleDayBets } = await import("@/app/(app)/zikabet/actions");
  await settleDayBets(week.id, admin.id);

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      entityType: "tournament_week",
      entityId: week.id,
      action: "week.closed",
      after: { mascotMissionRewards, enguicaContractRewards },
    },
  });

  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}`);
  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}/partidas`);
  revalidatePath(`/torneios/${week.tournament.slug}`);
  revalidatePath("/zikabet");
  revalidatePath("/caixa-de-presentes");

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

  return { success: true, mascotMissionRewards, enguicaContractRewards };
}

export async function revealEnguicaContract(tournamentId: string, weekNumber: number) {
  const admin = await requireAdmin();
  const week = await prisma.tournamentWeek.findUnique({
    where: { tournamentId_weekNumber: { tournamentId, weekNumber } },
    include: {
      tournament: {
        include: {
          registrations: {
            where: { status: "APPROVED" },
            select: { playerId: true, player: { select: { displayName: true } } },
          },
        },
      },
      deckSubmissions: { select: { playerId: true } },
    },
  });
  if (!week) throw new Error("Semana não encontrada.");
  if (!week.tournament.enguicaContractsEnabled) {
    throw new Error("Os Contratos do Professor Enguiça não estão habilitados neste campeonato.");
  }
  if (week.enguicaContractKey) return { success: true, contractKey: week.enguicaContractKey };
  if (!isDeckRegistrationLocked(week)) {
    throw new Error("O contrato só pode ser revelado depois do bloqueio das listas.");
  }

  const submittedPlayers = new Set(week.deckSubmissions.map((submission) => submission.playerId));
  const missingPlayers = week.tournament.registrations
    .filter((registration) => !submittedPlayers.has(registration.playerId))
    .map((registration) => registration.player.displayName);
  if (missingPlayers.length > 0) {
    throw new Error(`Ainda faltam listas de: ${missingPlayers.join(", ")}.`);
  }

  const previousWeek = await prisma.tournamentWeek.findFirst({
    where: { tournamentId, weekNumber: { lt: weekNumber }, enguicaContractKey: { not: null } },
    orderBy: { weekNumber: "desc" },
    select: { enguicaContractKey: true },
  });
  const contract = drawEnguicaContract(previousWeek?.enguicaContractKey);
  const revealedAt = new Date();
  const updated = await prisma.tournamentWeek.updateMany({
    where: { id: week.id, enguicaContractKey: null },
    data: {
      enguicaContractKey: contract.key,
      enguicaContractTitle: contract.title,
      enguicaContractDescription: contract.description,
      enguicaContractRevealedAt: revealedAt,
    },
  });
  if (updated.count === 1) {
    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        entityType: "tournament_week",
        entityId: week.id,
        action: "enguica_contract.revealed",
        after: { contractKey: contract.key, title: contract.title, revealedAt: revealedAt.toISOString() },
      },
    });
  }

  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}`);
  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}/partidas`);
  return { success: true, contractKey: contract.key };
}

// Admin: marca/desmarca a conclusão do contrato de UM jogador específico da
// partida (cada jogador tem a sua). Desmarcar só é possível antes de o prêmio
// ter sido pago (rewardedAt nulo).
export async function adminSetEnguicaCompletion(matchId: string, playerId: string, completed: boolean) {
  const admin = await requireAdmin();
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournamentWeek: { include: { tournament: true } } },
  });
  if (!match?.tournamentWeek) throw new Error("Partida não encontrada.");
  if (![match.playerAId, match.playerBId].includes(playerId)) throw new Error("Jogador não participa desta partida.");
  await prisma.$transaction(async (tx) => {
    if (completed) {
      await recordEnguicaCompletion(tx, match, playerId, true);
    } else {
      const removed = await tx.tournamentEnguicaCompletion.deleteMany({
        where: { tournamentWeekId: match.tournamentWeek!.id, matchId, playerId, rewardedAt: null },
      });
      if (removed.count === 0) {
        const rewarded = await tx.tournamentEnguicaCompletion.findFirst({
          where: { tournamentWeekId: match.tournamentWeek!.id, matchId, playerId, rewardedAt: { not: null } },
          select: { id: true },
        });
        if (rewarded) throw new Error("Esta conclusão já recebeu recompensa e não pode mais ser desmarcada.");
      }
    }
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id, entityType: "match", entityId: matchId,
        action: completed ? "enguica_contract.admin_marked" : "enguica_contract.admin_unmarked",
        after: { playerId, completed },
      },
    });
  });
  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`);
  return { success: true };
}

export async function declareEnguicaContractCompletion(matchId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Não autenticado.");
  const player = await getSessionPlayer(user.id);
  if (!player) throw new Error("Jogador não encontrado.");
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { tournamentWeek: { include: { tournament: true } } },
  });
  if (!match?.tournamentWeek) throw new Error("Partida não encontrada.");
  if (match.status !== MatchStatus.PENDING_CONFIRMATION && match.status !== MatchStatus.CONFIRMED) {
    throw new Error("O contrato só pode ser registrado em uma partida válida.");
  }
  await prisma.$transaction(async (tx) => {
    await recordEnguicaCompletion(tx, match, player.id, true);
  });
  revalidatePath(`/torneios/${match.tournamentWeek.tournament.slug}/semanas/${match.tournamentWeek.weekNumber}/partidas`);
  return { success: true };
}

// ── Admin: confirmar todos os resultados reportados da semana ─────────────────

export async function confirmAllWeekResults(
  tournamentId: string,
  weekNumber: number
): Promise<{ confirmed: number; skipped: number; error?: string }> {
  try {
    const admin = await requireAdmin();

    const week = await prisma.tournamentWeek.findUnique({
      where: { tournamentId_weekNumber: { tournamentId, weekNumber } },
      include: { tournament: true }
    });
    if (!week) return { confirmed: 0, skipped: 0, error: "Semana não encontrada." };

    // Busca partidas com resultado reportado mas ainda pendentes de confirmação
    const pending = await prisma.match.findMany({
      where: {
        tournamentWeekId: week.id,
        status: "PENDING_CONFIRMATION",
        winnerPlayerId: { not: null },
        playerBId:      { not: null },
      },
      include: { tournamentWeek: { include: { tournament: true } } }
    });

    let confirmed = 0;
    let skipped   = 0;

    for (const match of pending) {
      try {
        if (!match.winnerPlayerId || !match.playerBId) { skipped++; continue; }

        const multiplier = match.tournamentWeek ? Number(match.tournamentWeek.multiplier) : 1;
        const winPoints  = 3 * multiplier;
        const loserId    = match.winnerPlayerId === match.playerAId ? match.playerBId : match.playerAId;

        await prisma.$transaction(async (tx) => {
          await tx.match.update({
            where: { id: match.id },
            data: {
              status:          "CONFIRMED",
              confirmedById:   admin.id,
              confirmedAt:     new Date(),
              rankingPointsA:  match.winnerPlayerId === match.playerAId ? winPoints : 0,
              rankingPointsB:  match.winnerPlayerId === match.playerBId ? winPoints : 0,
              resultSource:    "ADMIN_ADJUSTMENT",
            }
          });

          // ZikaCoins: vencedor +50, perdedor +35
          await creditCoins(tx, {
            playerId:    match.winnerPlayerId!,
            type:        ZikaCoinTxType.MATCH_WIN_REWARD,
            amount:      MATCH_WIN_COINS,
            matchId:     match.id,
            tournamentId,
            tournamentWeekId: week.id,
            description: `Vitória validada — +${MATCH_WIN_COINS} ZC`
          });
          await creditCoins(tx, {
            playerId:    loserId,
            type:        ZikaCoinTxType.MATCH_LOSS_REWARD,
            amount:      MATCH_LOSS_COINS,
            matchId:     match.id,
            tournamentId,
            tournamentWeekId: week.id,
            description: `Participação validada — +${MATCH_LOSS_COINS} ZC`
          });

          await tx.auditLog.create({
            data: {
              actorUserId: admin.id,
              entityType:  "match",
              entityId:    match.id,
              action:      "match.admin_bulk_confirmed",
              after:       { winnerPlayerId: match.winnerPlayerId, weekNumber },
            }
          });
        });

        // Efeito no mascote (fire-and-forget)
        after(async () => {
          const [winner, loser] = await Promise.all([
            prisma.player.findUnique({ where: { id: match.winnerPlayerId! }, select: { id: true } }),
            prisma.player.findUnique({ where: { id: loserId },               select: { id: true } }),
          ]);
          if (winner) { const { applyMatchResultToMascot } = await import("@/lib/mascot"); await applyMatchResultToMascot(winner.id, true).catch(() => {}); }
          if (loser)  { const { applyMatchResultToMascot } = await import("@/lib/mascot"); await applyMatchResultToMascot(loser.id, false).catch(() => {}); }
        });

        confirmed++;
      } catch { skipped++; }
    }

    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}`);
    revalidatePath(`/torneios/${week.tournament.slug}/semanas/${weekNumber}/partidas`);
    revalidatePath(`/torneios/${week.tournament.slug}/ranking`);
    revalidatePath("/ranking"); revalidateTag("ranking");
    revalidatePath("/dashboard");

    return { confirmed, skipped };
  } catch (err) {
    return { confirmed: 0, skipped: 0, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}
