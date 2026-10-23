"use server";

import {
  MatchStatus,
  type Prisma,
  ResultSource,
  TournamentPostseasonStage,
  TournamentPostseasonStatus,
  WeekMode,
  WeekStatus,
} from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { getJohtoPrize, JOHTO_BOXES, JOHTO_PLACEMENTS, johtoPlacementFromResult } from "@/lib/johto-reward-boxes";
import { signalRealtime } from "@/lib/realtime-signal";
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

  // Marca as partidas da rodada como processadas. A perda de vida na Chave Z é
  // aplicada explicitamente na Final (série por vidas), não por rodada.
  await prisma.$transaction(async (tx) => {
    for (const match of roundMatches) {
      if (!match.postseasonProcessedAt) await tx.match.update({ where: { id: match.id }, data: { postseasonProcessedAt: new Date() } });
    }
  });

  const finalWeekId = tournament.weeks[0].id;
  const entries = await prisma.tournamentPostseasonEntry.findMany({ where: { tournamentId, stage }, orderBy: { seed: "asc" } });
  const seedOf = new Map(entries.map((e) => [e.playerId, e.seed]));
  const loserOf = (m: (typeof roundMatches)[number]) => m.loserPlayerId ?? (m.winnerPlayerId === m.playerAId ? m.playerBId : m.playerAId);
  const bySlot = (slot: string) => roundMatches.find((m) => m.postseasonSlot === slot);
  const mk = (playerAId: string, playerBId: string, round: number, slot: string, label: string) =>
    createPostseasonMatch({ tournamentId, finalWeekId, seasonId: tournament.seasonId, createdById: admin.id, playerAId, playerBId, stage, round, slot, label });

  if (stage === TournamentPostseasonStage.TITLE_SURVIVAL) {
    // Top 4: R1 (1º×4º, 2º×3º). Os 2 perdedores disputam o 3º lugar em JOGO ÚNICO
    // (vencedor 3º, perdedor 4º). Os 2 vencedores jogam a Final levando as vidas
    // restantes: cada derrota tira 1 vida e quem ZERAR fica em 2º, o outro em 1º
    // — assim o seed melhor (mais vidas) tem mais fôlego na final.
    const setEntry = (playerId: string, data: Prisma.TournamentPostseasonEntryUpdateInput) =>
      prisma.tournamentPostseasonEntry.update({ where: { tournamentId_playerId: { tournamentId, playerId } }, data });
    if (pendingRound === 1) {
      const a = bySlot("TITLE_R1_A"); const b = bySlot("TITLE_R1_B");
      if (!a?.winnerPlayerId || !b?.winnerPlayerId) throw new Error("Confirme os dois jogos da 1ª rodada da Chave Z antes de avançar.");
      await mk(loserOf(a)!, loserOf(b)!, 2, "TITLE_THIRD", "Disputa de 3º lugar");
      await mk(a.winnerPlayerId, b.winnerPlayerId, 2, "TITLE_FINAL", "Final — 1º e 2º lugar");
    } else {
      const third = bySlot("TITLE_THIRD");
      const fin = bySlot("TITLE_FINAL");
      const ops: ReturnType<typeof setEntry>[] = [];
      if (third) {
        if (!third.winnerPlayerId) throw new Error("Confirme a Disputa de 3º lugar antes de avançar.");
        ops.push(setEntry(third.winnerPlayerId, { finalPlacement: 3, resultLabel: "TERCEIRO_LUGAR", status: TournamentPostseasonStatus.ELIMINATED, eliminatedRound: pendingRound }));
        ops.push(setEntry(loserOf(third)!, { finalPlacement: 4, resultLabel: "QUARTO_LUGAR", status: TournamentPostseasonStatus.ELIMINATED, eliminatedRound: pendingRound }));
      }
      let finalContinues = false;
      if (fin) {
        if (!fin.winnerPlayerId) throw new Error("Confirme a Final antes de avançar.");
        const finalLoserId = loserOf(fin)!;
        const loserEntry = entries.find((e) => e.playerId === finalLoserId)!;
        const newLives = Math.max(0, loserEntry.lives - 1);
        ops.push(setEntry(finalLoserId, { lives: newLives }));
        if (newLives === 0) {
          ops.push(setEntry(fin.winnerPlayerId, { finalPlacement: 1, resultLabel: "CAMPEAO_LIGA", status: TournamentPostseasonStatus.CHAMPION, eliminatedRound: null }));
          ops.push(setEntry(finalLoserId, { finalPlacement: 2, resultLabel: "VICE_LIGA", status: TournamentPostseasonStatus.ELIMINATED, eliminatedRound: pendingRound }));
        } else {
          finalContinues = true;
        }
      }
      if (ops.length) await prisma.$transaction(ops);
      // Final não terminou (perdedor ainda tem vida) → cria o próximo jogo da série.
      if (fin?.winnerPlayerId && finalContinues) {
        await mk(fin.winnerPlayerId, loserOf(fin)!, pendingRound + 1, "TITLE_FINAL", "Final — 1º e 2º lugar (próxima vida)");
      }
    }
  } else if (pendingRound === 1) {
    // Copa (melhor de 1): o 5º seed tem bye direto na semifinal (vantagem do seed).
    // Perdedores da 1ª rodada eliminados; cria as semifinais.
    const winner = (slot: string) => bySlot(slot)?.winnerPlayerId;
    const seedFive = entries.find((entry) => entry.seed === 5)?.playerId;
    if (!seedFive || !winner("CUP_A") || !winner("CUP_B") || !winner("CUP_C")) throw new Error("Confirme os três jogos da 1ª rodada da Copa antes de avançar.");
    await prisma.$transaction(roundMatches.map((m) => prisma.tournamentPostseasonEntry.update({
      where: { tournamentId_playerId: { tournamentId, playerId: loserOf(m)! } },
      data: { status: TournamentPostseasonStatus.ELIMINATED, eliminatedRound: 1, resultLabel: "ELIMINADO_PRIMEIRA_RODADA" },
    })));
    await mk(seedFive, winner("CUP_A")!, 2, "CUP_SF1", "Copa — Semifinal 1");
    await mk(winner("CUP_B")!, winner("CUP_C")!, 2, "CUP_SF2", "Copa — Semifinal 2");
  } else if (pendingRound === 2) {
    // Perdedores das semis viram semifinalistas; cria a final.
    await prisma.$transaction(roundMatches.map((m) => {
      const loserId = loserOf(m)!;
      const label = seedOf.get(loserId) === 5 ? "QUINTO_SEMIFINALISTA" : "SEMIFINALISTA_COPA";
      return prisma.tournamentPostseasonEntry.update({ where: { tournamentId_playerId: { tournamentId, playerId: loserId } }, data: { status: TournamentPostseasonStatus.ELIMINATED, eliminatedRound: 2, resultLabel: label } });
    }));
    await mk(roundMatches[0].winnerPlayerId!, roundMatches[1].winnerPlayerId!, 3, "CUP_FINAL", "Copa Johto — Final");
  } else {
    // Final da Copa. A POSIÇÃO FINAL permanece a de entrada (seed): a chave decide
    // apenas o resultado (Campeão/Vice/Semifinalista/Eliminado) para as RECOMPENSAS,
    // não muda a classificação 5º–11º da fase regular.
    const championId = roundMatches[0].winnerPlayerId!;
    const viceId = loserOf(roundMatches[0])!;
    const labelOf = (e: (typeof entries)[number]) => e.playerId === championId ? "CAMPEAO_COPA" : e.playerId === viceId ? "VICE_COPA" : (e.resultLabel ?? "ELIMINADO_PRIMEIRA_RODADA");
    await prisma.$transaction(entries.map((e) => prisma.tournamentPostseasonEntry.update({
      where: { id: e.id },
      data: {
        finalPlacement: e.seed,
        resultLabel: labelOf(e),
        status: e.playerId === championId ? TournamentPostseasonStatus.CHAMPION : TournamentPostseasonStatus.ELIMINATED,
      },
    })));
  }

  await prisma.auditLog.create({ data: { actorUserId: admin.id, entityType: "tournament", entityId: tournamentId, action: "postseason.advanced", after: { stage, processedRound: pendingRound } } });
  refresh(tournament.slug);
  return { success: true };
}

/** Registra o vencedor de uma partida da fase final direto do painel (autoritativo). */
export async function setPostseasonMatchWinner(matchId: string, winnerPlayerId: string) {
  const admin = await requireAdmin();
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { tournamentWeek: { include: { tournament: { select: { slug: true } } } } } });
  if (!match?.postseasonStage || !match.tournamentWeek?.tournament) throw new Error("Partida da fase final não encontrada.");
  if (match.postseasonProcessedAt) throw new Error("Uma partida já processada não pode mudar de vencedor.");
  if (!match.playerBId) throw new Error("Partida sem adversário (Bye).");
  if (winnerPlayerId !== match.playerAId && winnerPlayerId !== match.playerBId) throw new Error("Vencedor inválido para esta partida.");
  const loserPlayerId = winnerPlayerId === match.playerAId ? match.playerBId : match.playerAId;
  const now = new Date();
  await prisma.$transaction([
    prisma.match.update({
      where: { id: match.id },
      data: {
        winnerPlayerId, loserPlayerId,
        playerAWins: winnerPlayerId === match.playerAId ? 1 : 0,
        playerBWins: winnerPlayerId === match.playerBId ? 1 : 0,
        status: MatchStatus.CONFIRMED, resultSource: ResultSource.ADMIN_ADJUSTMENT,
        reportedById: admin.id, confirmedById: admin.id, reportedAt: now, confirmedAt: now, playedAt: match.playedAt ?? now,
      },
    }),
    prisma.auditLog.create({ data: { actorUserId: admin.id, entityType: "match", entityId: match.id, action: "postseason.winner_set", after: { winnerPlayerId } } }),
  ]);
  refresh(match.tournamentWeek.tournament.slug);
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
    include: { postseasonEntries: { include: { player: { select: { displayName: true, userId: true } } } } },
  });
  if (!tournament?.postseasonEnabled) throw new Error("Fase final não encontrada.");
  const titleChampion = tournament.postseasonEntries.find((entry) => entry.stage === TournamentPostseasonStage.TITLE_SURVIVAL && entry.status === TournamentPostseasonStatus.CHAMPION);
  const cupChampion = tournament.postseasonEntries.find((entry) => entry.stage === TournamentPostseasonStage.CUP_JOHTO && entry.status === TournamentPostseasonStatus.CHAMPION);
  if (!titleChampion || !cupChampion) throw new Error("Conclua a Chave Z e a Copa Johto antes de distribuir a premiação final.");
  const pendingEntries = tournament.postseasonEntries.filter((entry) => !entry.rewardedAt);
  if (pendingEntries.length === 0) return { success: true, alreadyDistributed: true };

  // Colocação pela CHAVE da fase final (resultLabel), não pela tabela de pontos.
  const planned = pendingEntries.map((entry) => ({ entry, placement: johtoPlacementFromResult(entry.stage, entry.resultLabel) }));
  const missing = planned.filter((p) => !p.placement).map((p) => p.entry.player.displayName);
  if (missing.length) throw new Error(`Resultado final indefinido para: ${missing.join(", ")}. Avance as rodadas até o fim antes de distribuir.`);

  await prisma.$transaction(async (tx) => {
    for (const { entry, placement } of planned) {
      const scenario = JOHTO_PLACEMENTS.find((p) => p.id === placement)!;
      const prize = getJohtoPrize(placement!);
      const base = { tournamentId: tournament.id, stage: entry.stage, resultLabel: entry.resultLabel, placement };
      // Prêmios fixos: um clique. Cada caixa: aberta uma a uma, com animação; o
      // sorteio acontece no servidor no momento da abertura.
      await tx.playerGift.create({
        data: {
          playerId: entry.playerId, type: "CUSTOM", title: `Premiação Johto — ${scenario.label}`, description: scenario.message,
          payload: { ...base, rewardKind: "JOHTO_PRIZE" } as Prisma.InputJsonValue,
        },
      });
      await tx.playerGift.createMany({
        data: prize.boxes.map((tier, index) => ({
          playerId: entry.playerId, type: "CUSTOM" as const, title: JOHTO_BOXES[tier].name,
          description: index === 0 ? "Presente para todos os jogadores de Johto." : scenario.message,
          payload: { ...base, rewardKind: "JOHTO_BOX", tier, boxIndex: index } as Prisma.InputJsonValue,
        })),
      });
      await tx.tournamentPostseasonEntry.update({ where: { id: entry.id }, data: { rewardedAt: new Date() } });
    }
    await tx.auditLog.create({ data: { actorUserId: admin.id, entityType: "tournament", entityId: tournament.id, action: "postseason.rewards_distributed", after: { players: planned.length, placements: planned.map((p) => ({ playerId: p.entry.playerId, placement: p.placement })) } } });
  });
  for (const { entry } of planned) {
    revalidateTag(`nav-${entry.player.userId}`);
    signalRealtime(`player:${entry.playerId}`, "nav");
  }
  refresh(tournament.slug);
  revalidatePath("/caixa-de-presentes");
  return { success: true, players: planned.length };
}
