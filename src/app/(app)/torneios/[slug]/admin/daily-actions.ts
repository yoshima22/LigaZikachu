"use server";

import { EggType, MatchStatus, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/permissions";
import { addExp } from "@/lib/mascot";
import { prisma } from "@/lib/prisma";
import {
  finalizePayload,
  parseTournamentRewardConfig,
  tournamentDayRange,
  type TournamentBoxPayload,
} from "@/lib/tcg-tournament-rewards";

const closeDaySchema = z.object({
  tournamentWeekId: z.string().min(1),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topPlayerId: z.string().min(1).optional(),
  rafflePlayerId: z.string().min(1).optional(),
});

type RewardDraft = {
  playerId: string;
  kind: string;
  dedupeKey: string;
  title: string;
  description: string;
  matchId?: string;
  payload: TournamentBoxPayload;
};

function chance(value: number) {
  return Math.random() < value;
}

function giftDraft(input: Omit<RewardDraft, "payload"> & { payload: Omit<TournamentBoxPayload, "rewardLabel"> }): RewardDraft {
  return { ...input, payload: finalizePayload(input.payload) };
}

export async function closeTournamentDay(raw: z.infer<typeof closeDaySchema>) {
  const admin = await requireAdmin();
  const input = closeDaySchema.parse(raw);
  const { start, end } = tournamentDayRange(input.dateKey);

  const week = await prisma.tournamentWeek.findUnique({
    where: { id: input.tournamentWeekId },
    include: {
      tournament: { include: { registrations: { where: { status: "APPROVED" }, include: { player: true } } } },
      matches: {
        where: { scheduledAt: { gte: start, lte: end }, isBye: false },
        include: {
          playerA: true,
          playerB: true,
          enguicaCompletions: true,
        },
        orderBy: [{ scheduledAt: "asc" }, { roundLabel: "asc" }],
      },
      challenges: {
        where: { resolvedAt: { gte: start, lte: end }, badgeId: { not: null } },
      },
    },
  });
  if (!week) throw new Error("Semana nao encontrada.");
  const submissionIds = Array.from(new Set(week.matches.flatMap((match) => [match.playerADeckSubmissionId, match.playerBDeckSubmissionId].filter(Boolean) as string[])));
  const submissions = submissionIds.length > 0
    ? await prisma.deckSubmission.findMany({ where: { id: { in: submissionIds } } })
    : [];
  const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
  const config = parseTournamentRewardConfig(week.tournament.rewardConfig);
  if (!config) throw new Error("Este torneio nao usa fechamento diario de recompensas.");
  if (week.matches.length === 0) throw new Error("Nao existem partidas agendadas neste dia.");

  const unresolved = week.matches.filter((match) => match.status !== MatchStatus.CONFIRMED);
  if (unresolved.length > 0) {
    throw new Error(`Ainda existem ${unresolved.length} partida(s) sem resultado confirmado.`);
  }

  const existing = await prisma.tournamentDayClosure.findUnique({
    where: { tournamentWeekId_dateKey: { tournamentWeekId: week.id, dateKey: input.dateKey } },
  });
  if (existing) return { success: true, alreadyClosed: true, closureId: existing.id };

  const participantIds = Array.from(new Set(week.matches.flatMap((match) => [match.playerAId, match.playerBId].filter(Boolean) as string[])));
  const stats = participantIds.map((playerId) => {
    const matches = week.matches.filter((match) => match.playerAId === playerId || match.playerBId === playerId);
    return {
      playerId,
      wins: matches.filter((match) => match.winnerPlayerId === playerId).length,
      defendedPrizes: matches.filter((match) => match.winnerPlayerId === playerId).reduce((sum, match) => sum + match.winnerDefendedPrizes, 0),
      points: matches.reduce((sum, match) => sum + Number(match.playerAId === playerId ? match.rankingPointsA : match.rankingPointsB), 0),
    };
  }).sort((a, b) => b.wins - a.wins || b.defendedPrizes - a.defendedPrizes || b.points - a.points || a.playerId.localeCompare(b.playerId));

  const topPlayerId = input.topPlayerId && participantIds.includes(input.topPlayerId) ? input.topPlayerId : stats[0]?.playerId;
  const rafflePool = participantIds.filter((playerId) => playerId !== topPlayerId);
  const rafflePlayerId = input.rafflePlayerId && rafflePool.includes(input.rafflePlayerId)
    ? input.rafflePlayerId
    : rafflePool[Math.floor(Math.random() * rafflePool.length)];
  if (!topPlayerId || !rafflePlayerId) throw new Error("Nao foi possivel definir Top do Dia e Sorteio.");

  const origin = `liga-zikachu-3:${week.id}:${input.dateKey}`;
  const rewards: RewardDraft[] = [];
  for (const playerId of participantIds) {
    rewards.push(giftDraft({
      playerId, kind: "DAILY", dedupeKey: `daily:${playerId}`,
      title: `Caixa Diaria Johto - ${input.dateKey}`,
      description: "Participacao oficial validada no fechamento do dia.",
      payload: {
        rewardKind: "TOURNAMENT_BOX", origin,
        coins: config.daily.coins, food: config.daily.food, sweet: config.daily.sweet,
        eggs: [{ type: EggType.EVENT, quantity: config.daily.eventEggs }],
        shopItems: [{ type: "ZIKALOOT_TICKET", quantity: config.daily.lootTickets }],
      },
    }));
  }

  for (const match of week.matches) {
    if (!match.winnerPlayerId || !match.playerBId) continue;
    const loserId = match.winnerPlayerId === match.playerAId ? match.playerBId : match.playerAId;
    rewards.push(giftDraft({
      playerId: match.winnerPlayerId, kind: "WIN", dedupeKey: `win:${match.id}`, matchId: match.id,
      title: `Caixa de Vitoria - ${match.roundLabel ?? "Partida"}`,
      description: "Vitoria confirmada no fechamento oficial do dia.",
      payload: {
        rewardKind: "TOURNAMENT_BOX", origin, coins: config.win.coins, sweet: config.win.sweet,
        eggs: chance(config.win.eventEggChance) ? [{ type: EggType.EVENT, quantity: 1 }] : [],
        shopItems: [{ type: "MASCOT_BUFF_HAPPY", quantity: config.win.honeyCandy }],
      },
    }));
    rewards.push(giftDraft({
      playerId: loserId, kind: "LOSS", dedupeKey: `loss:${match.id}`, matchId: match.id,
      title: `Caixa de Derrota Honrada - ${match.roundLabel ?? "Partida"}`,
      description: "Participacao confirmada no fechamento oficial do dia.",
      payload: {
        rewardKind: "TOURNAMENT_BOX", origin, coins: config.loss.coins, food: config.loss.food,
        sweet: config.loss.sweet, creationDust: config.loss.creationDust,
      },
    }));
  }

  rewards.push(giftDraft({
    playerId: topPlayerId, kind: "TOP", dedupeKey: `top:${topPlayerId}`,
    title: `Caixa Top do Dia - ${input.dateKey}`,
    description: "Melhor desempenho validado pela organizacao.",
    payload: {
      rewardKind: "TOURNAMENT_BOX", origin, coins: config.top.coins, sweet: config.top.sweet,
      eggs: [
        { type: EggType.EVENT, quantity: config.top.eventEggs },
        ...(chance(config.top.labEggChance) ? [{ type: EggType.LAB, quantity: 1 }] : []),
      ],
      shopItems: [{ type: "ZIKALOOT_TICKET", quantity: config.top.lootTickets }],
    },
  }));
  rewards.push(giftDraft({
    playerId: rafflePlayerId, kind: "RAFFLE", dedupeKey: `raffle:${rafflePlayerId}`,
    title: `Caixa Sorteio da Liga - ${input.dateKey}`,
    description: "Sorteio realizado entre os participantes do dia, excluindo o Top do Dia.",
    payload: {
      rewardKind: "TOURNAMENT_BOX", origin, coins: config.raffle.coins, sweet: config.raffle.sweet,
      eggs: chance(config.raffle.specialEggChance) ? [{ type: EggType.SPECIAL, quantity: 1 }] : [],
    },
  }));

  const completionByPlayer = new Map(week.matches.flatMap((match) => match.enguicaCompletions).map((completion) => [completion.playerId, completion]));
  for (const completion of completionByPlayer.values()) {
    rewards.push(giftDraft({
      playerId: completion.playerId, kind: "ENGUICA", dedupeKey: `enguica:${completion.id}`, matchId: completion.matchId,
      title: `Caixa Enguica - ${week.enguicaContractTitle ?? "Contrato concluido"}`,
      description: "Contrato confirmado no fechamento oficial do dia.",
      payload: {
        rewardKind: "TOURNAMENT_BOX", origin, coins: config.enguica.coins, food: config.enguica.food,
        sweet: config.enguica.sweet, creationDust: config.enguica.creationDust,
        eggs: chance(config.enguica.rareEggChance) ? [{ type: EggType.RARE, quantity: 1 }] : [],
      },
    }));
  }

  const rewardedChallengeCategories = new Set<string>();
  for (const challenge of week.challenges) {
    const meta = challenge.metadata && typeof challenge.metadata === "object" && !Array.isArray(challenge.metadata)
      ? challenge.metadata as Record<string, unknown> : null;
    const challengerWon = meta?.challengerWon === true;
    const playerId = challengerWon ? challenge.challengerId : challenge.challengedId;
    const kind = challengerWon ? "BADGE" : "GUARDIAN";
    const categoryKey = `${playerId}:${kind}`;
    if (rewardedChallengeCategories.has(categoryKey)) continue;
    rewardedChallengeCategories.add(categoryKey);
    rewards.push(giftDraft({
      playerId, kind, dedupeKey: `${kind.toLowerCase()}:${challenge.id}`, matchId: challenge.matchId ?? undefined,
      title: challengerWon ? "Caixa de Insignia" : "Caixa de Guardiao",
      description: challengerWon ? "Insignia conquistada em Desafio Oficial." : "Insignia defendida em Desafio Oficial.",
      payload: challengerWon ? {
        rewardKind: "TOURNAMENT_BOX", origin, coins: config.badge.coins,
        creationDust: config.badge.creationDust,
        eggs: chance(config.badge.specialEggChance) ? [{ type: EggType.SPECIAL, quantity: 1 }] : [],
        shopItems: [{ type: "WEAKNESS_POLICY", quantity: config.badge.weaknessPolicy }],
      } : {
        rewardKind: "TOURNAMENT_BOX", origin, coins: config.guardian.coins,
        creationDust: config.guardian.creationDust,
        eggs: chance(config.guardian.specialEggChance) ? [{ type: EggType.SPECIAL, quantity: 1 }] : [],
        shopItems: [{ type: "MASCOT_BUFF_EXP", quantity: config.guardian.shockingVitamin }],
      },
    }));
  }

  const closure = await prisma.$transaction(async (tx) => {
    const created = await tx.tournamentDayClosure.create({
      data: {
        tournamentId: week.tournamentId, tournamentWeekId: week.id, dateKey: input.dateKey,
        topPlayerId, rafflePlayerId, closedById: admin.id,
        summary: { matches: week.matches.length, participants: participantIds.length, rewards: rewards.length },
      },
    });
    for (const reward of rewards) {
      const gift = await tx.playerGift.create({
        data: { playerId: reward.playerId, type: "CUSTOM", title: reward.title, description: reward.description, payload: reward.payload as unknown as Prisma.InputJsonValue },
      });
      await tx.tournamentDayReward.create({
        data: {
          closureId: created.id, playerId: reward.playerId, kind: reward.kind, dedupeKey: reward.dedupeKey,
          matchId: reward.matchId, giftId: gift.id, payload: reward.payload as unknown as Prisma.InputJsonValue,
        },
      });
    }
    for (const completion of completionByPlayer.values()) {
      await tx.tournamentEnguicaCompletion.updateMany({ where: { id: completion.id, rewardedAt: null }, data: { rewardedAt: new Date() } });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id, entityType: "tournament_day", entityId: created.id, action: "tournament_day.closed",
        after: { tournamentWeekId: week.id, dateKey: input.dateKey, topPlayerId, rafflePlayerId, rewards: rewards.length },
      },
    });
    return created;
  });

  let mascotMissionExp = 0;
  for (const match of week.matches) {
    for (const side of ["A", "B"] as const) {
      const playerId = side === "A" ? match.playerAId : match.playerBId;
      const submissionId = side === "A" ? match.playerADeckSubmissionId : match.playerBDeckSubmissionId;
      const submission = submissionId ? submissionById.get(submissionId) : null;
      if (!playerId || !submission?.mascotMissionValid || !submission.mascotMissionMascotId) continue;
      const exp = 500 + (match.winnerPlayerId === playerId ? 900 : 0);
      const dedupeKey = `mascot-mission:${match.id}:${playerId}`;
      const reserved = await prisma.tournamentDayReward.create({
        data: { closureId: closure.id, playerId, kind: "MASCOT_MISSION", dedupeKey, matchId: match.id, payload: { mascotId: submission.mascotMissionMascotId, exp } },
      }).catch(() => null);
      if (!reserved) continue;
      await addExp(submission.mascotMissionMascotId, exp, { ignoreBenchPenalty: true });
      mascotMissionExp += exp;
      await prisma.deckSubmission.update({
        where: { id: submission.id },
        data: { mascotMissionRewardedAt: new Date(), mascotMissionExpAwarded: { increment: exp } },
      });
    }

    if (!match.winnerPlayerId) continue;
    const winnerSubmissionId = match.winnerPlayerId === match.playerAId ? match.playerADeckSubmissionId : match.playerBDeckSubmissionId;
    const winnerSubmission = winnerSubmissionId ? submissionById.get(winnerSubmissionId) : null;
    if (!winnerSubmission?.gymBadgeId || winnerSubmission.gymBadgeValid !== true) continue;
    const progress = await prisma.badgeProgress.findUnique({
      where: { badgeId_playerId: { badgeId: winnerSubmission.gymBadgeId, playerId: match.winnerPlayerId } },
    });
    const current = progress?.points ?? 0;
    const next = current < 2 || match.winnerDefendedPrizes >= 3 ? Math.min(3, current + 1) : current;
    if (next > current) {
      await prisma.badgeProgress.upsert({
        where: { badgeId_playerId: { badgeId: winnerSubmission.gymBadgeId, playerId: match.winnerPlayerId } },
        update: { points: next, notes: `Progresso validado em ${input.dateKey}` },
        create: { badgeId: winnerSubmission.gymBadgeId, playerId: match.winnerPlayerId, points: next, notes: `Progresso validado em ${input.dateKey}` },
      });
    }
  }

  revalidatePath(`/torneios/${week.tournament.slug}`);
  revalidatePath(`/torneios/${week.tournament.slug}/admin`);
  revalidatePath(`/torneios/${week.tournament.slug}/semanas/${week.weekNumber}/partidas`);
  revalidatePath("/caixa-de-presentes");
  return { success: true, closureId: closure.id, rewards: rewards.length, mascotMissionExp, topPlayerId, rafflePlayerId };
}
