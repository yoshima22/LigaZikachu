"use server";

import {
  EggType,
  MatchStatus,
  type Prisma,
  TournamentPostseasonStage,
  TournamentPostseasonStatus,
  WeekMode,
  WeekStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { computeTournamentRanking } from "@/lib/ranking";
import { JOHTO_POSTSEASON_CONFIG, parsePostseasonConfig } from "@/lib/tournament-postseason";

function refresh(slug: string) {
  revalidatePath(`/torneios/${slug}`);
  revalidatePath(`/torneios/${slug}/admin`);
  revalidatePath(`/torneios/${slug}/semanas/9`);
  revalidatePath(`/torneios/${slug}/semanas/9/partidas`);
}

export async function setPostseasonEnabled(tournamentId: string, enabled: boolean) {
  const admin = await requireAdmin();
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true, postseasonConfig: true } });
  if (!tournament) throw new Error("Torneio não encontrado.");
  await prisma.$transaction([
    prisma.tournament.update({
      where: { id: tournamentId },
      data: { postseasonEnabled: enabled, postseasonConfig: tournament.postseasonConfig ?? JOHTO_POSTSEASON_CONFIG },
    }),
    prisma.auditLog.create({
      data: { actorUserId: admin.id, entityType: "tournament", entityId: tournamentId, action: "postseason.toggled", after: { enabled } },
    }),
  ]);
  refresh(tournament.slug);
  return { success: true };
}

export async function initializePostseason(tournamentId: string) {
  const admin = await requireAdmin();
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { weeks: { orderBy: { weekNumber: "asc" } }, postseasonEntries: true },
  });
  if (!tournament) throw new Error("Torneio não encontrado.");
  if (!tournament.postseasonEnabled) throw new Error("Ative a fase final antes de montar as chaves.");
  if (tournament.postseasonEntries.length > 0) throw new Error("A fase final já foi montada.");
  const regularWeeks = tournament.weeks.filter((week) => week.weekNumber <= 8);
  if (regularWeeks.length < 8 || regularWeeks.some((week) => week.status !== WeekStatus.CLOSED)) {
    throw new Error("Feche as oito semanas da fase regular antes de montar as chaves.");
  }

  const ranking = await computeTournamentRanking(tournament.id);
  if (ranking.length < 11) throw new Error("A fase final exige onze jogadores classificados.");
  const config = parsePostseasonConfig(tournament.postseasonConfig);
  const baseDate = new Date((tournament.endDate ?? regularWeeks[7].endDate).getTime() + 24 * 60 * 60 * 1000);
  const endDate = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000);

  const finalWeek = await prisma.tournamentWeek.upsert({
    where: { tournamentId_weekNumber: { tournamentId: tournament.id, weekNumber: 9 } },
    update: { label: "Fase Final — Johto", mode: WeekMode.BATALHA_FINAL, status: WeekStatus.OPEN, startDate: baseDate, endDate, bonusRule: { postseason: true } },
    create: { tournamentId: tournament.id, weekNumber: 9, label: "Fase Final — Johto", mode: WeekMode.BATALHA_FINAL, status: WeekStatus.OPEN, startDate: baseDate, endDate, bonusRule: { postseason: true } },
  });

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < 11; index++) {
      const seed = index + 1;
      const stage = seed <= 4 ? TournamentPostseasonStage.TITLE_SURVIVAL : TournamentPostseasonStage.CUP_JOHTO;
      const lives = seed <= 4 ? Number(config.title.initialLives[String(seed)] ?? 1) : 1;
      await tx.tournamentPostseasonEntry.create({
        data: { tournamentId: tournament.id, playerId: ranking[index].playerId, stage, seed, initialLives: lives, lives },
      });
    }

    const createMatch = (playerAId: string, playerBId: string, stage: TournamentPostseasonStage, slot: string, label: string) => tx.match.create({
      data: {
        seasonId: tournament.seasonId, tournamentWeekId: finalWeek.id, playerAId, playerBId,
        scheduledAt: baseDate, roundLabel: label, tableLabel: slot, bestOf: 1,
        status: MatchStatus.PENDING_CONFIRMATION, topOfDayEligible: false, createdById: admin.id,
        postseasonStage: stage, postseasonRound: 1, postseasonSlot: slot,
      },
    });
    await createMatch(ranking[0].playerId, ranking[3].playerId, TournamentPostseasonStage.TITLE_SURVIVAL, "TITLE_R1_A", "Sobrevivência — 1º × 4º");
    await createMatch(ranking[1].playerId, ranking[2].playerId, TournamentPostseasonStage.TITLE_SURVIVAL, "TITLE_R1_B", "Sobrevivência — 2º × 3º");
    await createMatch(ranking[7].playerId, ranking[8].playerId, TournamentPostseasonStage.CUP_JOHTO, "CUP_A", "Copa — 8º × 9º");
    await createMatch(ranking[5].playerId, ranking[10].playerId, TournamentPostseasonStage.CUP_JOHTO, "CUP_B", "Copa — 6º × 11º");
    await createMatch(ranking[6].playerId, ranking[9].playerId, TournamentPostseasonStage.CUP_JOHTO, "CUP_C", "Copa — 7º × 10º");
    await tx.auditLog.create({ data: { actorUserId: admin.id, entityType: "tournament", entityId: tournament.id, action: "postseason.initialized", after: { players: 11, finalWeekId: finalWeek.id } } });
  });
  refresh(tournament.slug);
  return { success: true };
}

async function createPostseasonMatch(input: {
  tournamentId: string; finalWeekId: string; seasonId: string | null; createdById: string;
  playerAId: string; playerBId: string; stage: TournamentPostseasonStage; round: number; slot: string; label: string;
}) {
  return prisma.match.create({
    data: {
      seasonId: input.seasonId, tournamentWeekId: input.finalWeekId,
      playerAId: input.playerAId, playerBId: input.playerBId,
      scheduledAt: new Date(), roundLabel: input.label, tableLabel: input.slot, bestOf: 1,
      status: MatchStatus.PENDING_CONFIRMATION, topOfDayEligible: false, createdById: input.createdById,
      postseasonStage: input.stage, postseasonRound: input.round, postseasonSlot: input.slot,
    },
  });
}

export async function advancePostseason(tournamentId: string, rawStage: "TITLE_SURVIVAL" | "CUP_JOHTO") {
  const admin = await requireAdmin();
  const stage = rawStage as TournamentPostseasonStage;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { weeks: { where: { weekNumber: 9 }, take: 1 }, postseasonEntries: { include: { player: true } } },
  });
  if (!tournament?.postseasonEnabled || !tournament.weeks[0]) throw new Error("Fase final não inicializada.");
  const matches = await prisma.match.findMany({
    where: { tournamentWeekId: tournament.weeks[0].id, postseasonStage: stage },
    orderBy: [{ postseasonRound: "asc" }, { postseasonSlot: "asc" }],
  });
  const pendingRound = matches.find((match) => !match.postseasonProcessedAt)?.postseasonRound;
  if (!pendingRound) throw new Error("Não há rodada pendente para avançar.");
  const roundMatches = matches.filter((match) => match.postseasonRound === pendingRound);
  if (roundMatches.some((match) => match.status !== MatchStatus.CONFIRMED || !match.winnerPlayerId)) {
    throw new Error("Confirme todos os resultados desta rodada antes de avançar.");
  }

  await prisma.$transaction(async (tx) => {
    for (const match of roundMatches) {
      if (match.postseasonProcessedAt) continue;
      const loserId = match.loserPlayerId ?? (match.winnerPlayerId === match.playerAId ? match.playerBId : match.playerAId);
      if (!loserId) continue;
      const loser = await tx.tournamentPostseasonEntry.findUniqueOrThrow({ where: { tournamentId_playerId: { tournamentId, playerId: loserId } } });
      const lives = Math.max(0, loser.lives - 1);
      await tx.tournamentPostseasonEntry.update({
        where: { id: loser.id },
        data: {
          lives,
          ...(lives === 0 ? { status: TournamentPostseasonStatus.ELIMINATED, eliminatedRound: pendingRound } : {}),
          ...(stage === TournamentPostseasonStage.CUP_JOHTO && pendingRound === 1 ? { resultLabel: "ELIMINADO_PRIMEIRA_RODADA" } : {}),
          ...(stage === TournamentPostseasonStage.CUP_JOHTO && pendingRound === 2 ? { resultLabel: loser.seed === 5 ? "QUINTO_SEMIFINALISTA" : "SEMIFINALISTA_COPA" } : {}),
          ...(stage === TournamentPostseasonStage.CUP_JOHTO && pendingRound === 3 ? { resultLabel: "VICE_COPA" } : {}),
        },
      });
      await tx.match.update({ where: { id: match.id }, data: { postseasonProcessedAt: new Date() } });
    }
  });

  const entries = await prisma.tournamentPostseasonEntry.findMany({ where: { tournamentId, stage }, orderBy: { seed: "asc" } });
  const active = entries.filter((entry) => entry.status === TournamentPostseasonStatus.ACTIVE && entry.lives > 0);
  const nextRound = pendingRound + 1;

  if (stage === TournamentPostseasonStage.TITLE_SURVIVAL) {
    if (active.length === 1) {
      const ordered = [...entries].sort((a, b) => {
        if (a.id === active[0].id) return -1;
        if (b.id === active[0].id) return 1;
        return (b.eliminatedRound ?? 0) - (a.eliminatedRound ?? 0) || a.seed - b.seed;
      });
      await prisma.$transaction(ordered.map((entry, index) => prisma.tournamentPostseasonEntry.update({
        where: { id: entry.id },
        data: { finalPlacement: index + 1, resultLabel: ["CAMPEAO_LIGA", "VICE_LIGA", "TERCEIRO_LUGAR", "QUARTO_LUGAR"][index], status: index === 0 ? TournamentPostseasonStatus.CHAMPION : TournamentPostseasonStatus.ELIMINATED },
      })));
    } else {
      let playing = [...active].sort((a, b) => b.lives - a.lives || a.seed - b.seed);
      if (playing.length === 3) {
        const bye = playing.find((entry) => entry.lastByeRound !== pendingRound) ?? playing[0];
        await prisma.tournamentPostseasonEntry.update({ where: { id: bye.id }, data: { byeCount: { increment: 1 }, lastByeRound: nextRound } });
        playing = playing.filter((entry) => entry.id !== bye.id);
      }
      const pairs = playing.length === 4 ? [[playing[0], playing[3]], [playing[1], playing[2]]] : [[playing[0], playing[1]]];
      for (const [index, pair] of pairs.entries()) {
        await createPostseasonMatch({ tournamentId, finalWeekId: tournament.weeks[0].id, seasonId: tournament.seasonId, createdById: admin.id, playerAId: pair[0].playerId, playerBId: pair[1].playerId, stage, round: nextRound, slot: `TITLE_R${nextRound}_${index + 1}`, label: `Sobrevivência — rodada ${nextRound}` });
      }
    }
  } else if (pendingRound === 1) {
    const winner = (slot: string) => roundMatches.find((match) => match.postseasonSlot === slot)?.winnerPlayerId;
    const seedFive = entries.find((entry) => entry.seed === 5)?.playerId;
    if (!seedFive || !winner("CUP_A") || !winner("CUP_B") || !winner("CUP_C")) throw new Error("Resultados incompletos na primeira rodada da Copa.");
    await createPostseasonMatch({ tournamentId, finalWeekId: tournament.weeks[0].id, seasonId: tournament.seasonId, createdById: admin.id, playerAId: seedFive, playerBId: winner("CUP_A")!, stage, round: 2, slot: "CUP_SF1", label: "Copa — Semifinal 1" });
    await createPostseasonMatch({ tournamentId, finalWeekId: tournament.weeks[0].id, seasonId: tournament.seasonId, createdById: admin.id, playerAId: winner("CUP_B")!, playerBId: winner("CUP_C")!, stage, round: 2, slot: "CUP_SF2", label: "Copa — Semifinal 2" });
  } else if (pendingRound === 2) {
    await createPostseasonMatch({ tournamentId, finalWeekId: tournament.weeks[0].id, seasonId: tournament.seasonId, createdById: admin.id, playerAId: roundMatches[0].winnerPlayerId!, playerBId: roundMatches[1].winnerPlayerId!, stage, round: 3, slot: "CUP_FINAL", label: "Copa Johto — Final" });
  } else {
    const championId = roundMatches[0].winnerPlayerId!;
    await prisma.tournamentPostseasonEntry.update({ where: { tournamentId_playerId: { tournamentId, playerId: championId } }, data: { status: TournamentPostseasonStatus.CHAMPION, resultLabel: "CAMPEAO_COPA" } });
  }

  await prisma.auditLog.create({ data: { actorUserId: admin.id, entityType: "tournament", entityId: tournamentId, action: "postseason.advanced", after: { stage, processedRound: pendingRound } } });
  refresh(tournament.slug);
  return { success: true };
}

export async function adjustPostseasonLives(entryId: string, lives: number) {
  const admin = await requireAdmin();
  if (!Number.isInteger(lives) || lives < 0 || lives > 9) throw new Error("Informe de 0 a 9 vidas.");
  const entry = await prisma.tournamentPostseasonEntry.findUnique({ where: { id: entryId }, include: { tournament: { select: { id: true, slug: true } } } });
  if (!entry) throw new Error("Participante não encontrado.");
  await prisma.$transaction([
    prisma.tournamentPostseasonEntry.update({ where: { id: entry.id }, data: { lives, status: lives === 0 ? TournamentPostseasonStatus.ELIMINATED : TournamentPostseasonStatus.ACTIVE, ...(lives > 0 ? { eliminatedRound: null } : {}) } }),
    prisma.auditLog.create({ data: { actorUserId: admin.id, entityType: "tournament", entityId: entry.tournamentId, action: "postseason.lives_adjusted", before: { lives: entry.lives }, after: { lives, playerId: entry.playerId } } }),
  ]);
  refresh(entry.tournament.slug);
  return { success: true };
}

export async function setPostseasonMatchState(matchId: string, state: "DRAFT" | "PENDING_CONFIRMATION" | "DISPUTED" | "CANCELED") {
  const admin = await requireAdmin();
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { tournamentWeek: { include: { tournament: { select: { id: true, slug: true } } } } } });
  if (!match?.postseasonStage || !match.tournamentWeek?.tournament) throw new Error("Partida da fase final não encontrada.");
  if (match.postseasonProcessedAt) throw new Error("Uma partida já processada não pode mudar de estado.");
  await prisma.$transaction([
    prisma.match.update({
      where: { id: match.id },
      data: {
        status: state,
        ...(state === "DRAFT" || state === "PENDING_CONFIRMATION" || state === "CANCELED" ? {
          winnerPlayerId: null, loserPlayerId: null, playerAWins: 0, playerBWins: 0,
          winnerDefendedPrizes: 0, rankingPointsA: 0, rankingPointsB: 0,
          reportedById: null, confirmedById: null, reportedAt: null, confirmedAt: null,
        } : {}),
      },
    }),
    prisma.auditLog.create({ data: { actorUserId: admin.id, entityType: "match", entityId: match.id, action: "postseason.match_state_changed", before: { status: match.status }, after: { status: state } } }),
  ]);
  refresh(match.tournamentWeek.tournament.slug);
  return { success: true };
}

export async function resetPostseason(tournamentId: string) {
  const admin = await requireAdmin();
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId }, include: { weeks: { where: { weekNumber: 9 }, select: { id: true } }, postseasonEntries: { select: { rewardedAt: true } } } });
  if (!tournament) throw new Error("Torneio não encontrado.");
  if (tournament.postseasonEntries.some((entry) => entry.rewardedAt)) throw new Error("Não é possível reiniciar depois que a premiação final foi distribuída.");
  await prisma.$transaction(async (tx) => {
    if (tournament.weeks[0]) await tx.match.deleteMany({ where: { tournamentWeekId: tournament.weeks[0].id, postseasonStage: { not: null } } });
    await tx.tournamentPostseasonEntry.deleteMany({ where: { tournamentId } });
    if (tournament.weeks[0]) await tx.tournamentWeek.delete({ where: { id: tournament.weeks[0].id } });
    await tx.auditLog.create({ data: { actorUserId: admin.id, entityType: "tournament", entityId: tournamentId, action: "postseason.reset" } });
  });
  refresh(tournament.slug);
  return { success: true };
}

export async function distributePostseasonRewards(tournamentId: string) {
  const admin = await requireAdmin();
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { postseasonEntries: true },
  });
  if (!tournament?.postseasonEnabled) throw new Error("Fase final não encontrada.");
  const titleChampion = tournament.postseasonEntries.find((entry) => entry.stage === TournamentPostseasonStage.TITLE_SURVIVAL && entry.status === TournamentPostseasonStatus.CHAMPION);
  const cupChampion = tournament.postseasonEntries.find((entry) => entry.stage === TournamentPostseasonStage.CUP_JOHTO && entry.status === TournamentPostseasonStatus.CHAMPION);
  if (!titleChampion || !cupChampion) throw new Error("Conclua a Chave Z e a Copa Johto antes de distribuir a premiação final.");
  const config = parsePostseasonConfig(tournament.postseasonConfig);
  const pendingEntries = tournament.postseasonEntries.filter((entry) => !entry.rewardedAt);
  if (pendingEntries.length === 0) return { success: true, alreadyDistributed: true };

  await prisma.$transaction(async (tx) => {
    for (const entry of pendingEntries) {
      const placement = entry.stage === TournamentPostseasonStage.TITLE_SURVIVAL ? entry.finalPlacement : entry.seed;
      const coins = Number(config.finalRewards.zcByPlacement[String(placement ?? 0)] ?? 0);
      const eggs: Array<{ type: EggType; quantity: number }> = [{ type: EggType.RARE, quantity: config.finalRewards.participationEggs.rare }];
      if (entry.finalPlacement === 1) eggs.push({ type: EggType.LAB, quantity: config.finalRewards.champion.lab }, { type: EggType.SPECIAL, quantity: config.finalRewards.champion.special }, { type: EggType.EVENT, quantity: config.finalRewards.champion.event });
      if (entry.finalPlacement === 2) eggs.push({ type: EggType.LAB, quantity: config.finalRewards.runnerUp.lab }, { type: EggType.SPECIAL, quantity: config.finalRewards.runnerUp.special }, { type: EggType.EVENT, quantity: config.finalRewards.runnerUp.event });
      if (entry.finalPlacement === 3) eggs.push({ type: EggType.LAB, quantity: config.finalRewards.third.lab }, { type: EggType.SPECIAL, quantity: config.finalRewards.third.special }, { type: EggType.EVENT, quantity: config.finalRewards.third.event });
      if (entry.finalPlacement === 4) eggs.push({ type: EggType.LAB, quantity: config.finalRewards.fourth.lab }, { type: EggType.EVENT, quantity: config.finalRewards.fourth.event }, { type: EggType.RARE, quantity: config.finalRewards.fourth.rare });
      const payload = {
        rewardKind: "TOURNAMENT_BOX",
        rewardLabel: `Premiação final Johto${coins > 0 ? ` · ${coins} ZC` : ""}`,
        origin: `postseason:${tournament.id}`,
        coins,
        eggs,
      } satisfies Record<string, unknown>;
      await tx.playerGift.create({
        data: {
          playerId: entry.playerId,
          type: "CUSTOM",
          title: entry.finalPlacement ? `${entry.finalPlacement}º lugar — Liga Zikachu` : "Participação — Liga Zikachu: Rumo a Johto",
          description: "Premiação final validada pela organização. Cosméticos e lotes temáticos são administrados separadamente.",
          payload: payload as Prisma.InputJsonValue,
        },
      });
      await tx.tournamentPostseasonEntry.update({ where: { id: entry.id }, data: { rewardedAt: new Date() } });
    }
    await tx.auditLog.create({ data: { actorUserId: admin.id, entityType: "tournament", entityId: tournament.id, action: "postseason.rewards_distributed", after: { players: pendingEntries.length } } });
  });
  refresh(tournament.slug);
  revalidatePath("/caixa-de-presentes");
  return { success: true, players: pendingEntries.length };
}
