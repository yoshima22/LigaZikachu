/**
 * Mantém os laços dos mascotes ativos ao longo do dia.
 * Resolve situações vencidas e abre novas escolhas para jogadores com sessão ativa.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  autoResolveExpiredBondEvents,
  sweepExpiredBondEvents,
  ensureBondEventCadence,
  processMascotDiseaseForPlayer,
} from "@/lib/mascot-bonds";
import { prisma } from "@/lib/prisma";
import { REFUGE_LOCATIONS, simulateRefugeMoment, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { BONDS_V2_BALANCE } from "@/lib/mascot-bonds-v2-balance";
import { sendNotificationToPlayers } from "@/lib/notifications";
import { filterInGameRecipients } from "@/lib/nav-notifications";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  // Contas administrativas não participam da rede social pública. Remova
  // qualquer vínculo legado que ainda contenha um mascote dessas contas.
  const adminRelations = await prisma.mascotRelation.findMany({
    where: { OR: [
      { mascotA: { player: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } } } },
      { mascotB: { player: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } } } },
    ] },
    select: { id: true },
  });
  if (adminRelations.length) await prisma.mascotRelation.deleteMany({ where: { id: { in: adminRelations.map((relation) => relation.id) } } });
  // Um Amuleto ativo pausa o prazo normal. Se sobreviver às 6 horas sem
  // Escudo, preserva o vínculo e encerra toda a disputa.
  const resolvedCharms = await prisma.mascotRelation.findMany({ where: { isActive: true, promiseCharmResolvesAt: { lte: now } }, select: { mascotAId: true, mascotBId: true, mascotA: { select: { playerId: true } }, mascotB: { select: { playerId: true } } } });
  for (const relation of resolvedCharms) {
    await prisma.mascotRelation.updateMany({ where: { OR: [{ mascotAId: relation.mascotAId, mascotBId: relation.mascotBId }, { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId }] }, data: { dormantAt: null, distanceStartedAt: null, distanceStartedByPlayerId: null, distanceRemainingMs: null, promiseCharmStartedAt: null, promiseCharmResolvesAt: null, promiseCharmByPlayerId: null, promiseShielded: false, distanceContestants: [] } });
    const players = [...new Set([relation.mascotA.playerId, relation.mascotB.playerId])];
    if (players.length) {
      const charmInGame = await filterInGameRecipients(players, "MASCOTES");
      if (charmInGame.length) await prisma.playerNotification.createMany({ data: charmInGame.map((playerId) => ({ playerId, category: "BONDS", type: "BOND_CHARM_RESOLVED", title: "O vínculo foi preservado", body: "O Amuleto de Promessa completou 6 horas e cancelou o afastamento.", href: "/lacos", eventKey: `bond-charm-resolved:${relation.mascotAId}:${relation.mascotBId}:${playerId}` })), skipDuplicates: true });
      await sendNotificationToPlayers(players, { title: "Laços: vínculo preservado", body: "O Amuleto de Promessa concluiu sua ação e cancelou o afastamento.", url: "/lacos", category: "MASCOTES" }).catch(() => undefined);
    }
  }
  // Afastamentos têm peso e tempo. Ao fim do prazo, as duas direções da
  // relação são removidas; memórias narrativas permanecem como histórico.
  const dueDistances = await prisma.mascotRelation.findMany({ where: { isActive: true, dormantAt: { lte: now }, promiseCharmResolvesAt: null }, select: { mascotAId: true, mascotBId: true, mascotA: { select: { playerId: true } }, mascotB: { select: { playerId: true } } } });
  const pairIds = dueDistances.flatMap((relation) => [relation.mascotAId, relation.mascotBId]);
  const distancesCompleted = dueDistances.length ? await prisma.mascotRelation.deleteMany({
    where: { OR: dueDistances.flatMap((relation) => [
      { mascotAId: relation.mascotAId, mascotBId: relation.mascotBId },
      { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId },
    ]) },
  }) : { count: 0 };
  const notifiedDistancePairs = new Set<string>();
  for (const relation of dueDistances) {
    const key = [relation.mascotAId, relation.mascotBId].sort().join(":");
    if (notifiedDistancePairs.has(key)) continue;
    notifiedDistancePairs.add(key);
    const affected = [...new Set([relation.mascotA.playerId, relation.mascotB.playerId])];
    if (affected.length) {
      const distanceInGame = await filterInGameRecipients(affected, "MASCOTES");
      if (distanceInGame.length) await prisma.playerNotification.createMany({ data: distanceInGame.map((playerId) => ({ playerId, category: "BONDS", type: "BOND_DISTANCE_COMPLETE", title: "Afastamento concluído", body: "As 24 horas restantes terminaram e o vínculo foi removido dos dois mascotes. As memórias continuam no histórico.", href: "/lacos", eventKey: `bond-distance-complete:${key}:${playerId}` })), skipDuplicates: true });
      await sendNotificationToPlayers(affected, { title: "Laços: afastamento concluído", body: "O prazo terminou e o vínculo foi encerrado.", url: "/lacos", category: "MASCOTES" }).catch(() => undefined);
    }
  }
  // Limpa dados do desenho anterior. Relação inativa não é reserva nem fila.
  const staleRelationsRemoved = await prisma.mascotRelation.deleteMany({ where: { isActive: false } });
  const players = await prisma.player.findMany({
    where: {
      active: true,
      mascots: { some: {} },
      user: {
        role: { notIn: ["ADMIN", "SUPER_ADMIN"] },
        status: "ACTIVE",
        sessions: { some: { expires: { gt: now } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true },
  });

  let eventsCreated = 0;
  // Vencidos de qualquer jogador — inclusive quem está sem sessão ativa.
  let eventsResolved = await sweepExpiredBondEvents();
  let failures = 0;
  let refugeMoments = 0;
  let importantRefugeMoments = 0;
  let diseaseCases = 0;
  let diseaseInfections = 0;

  // Saúde é processada para todas as contas ativas com mascotes, mesmo sem
  // sessão ou visita à página. O cron roda a cada quatro horas.
  const diseasePlayers = await prisma.player.findMany({ where: { active: true, mascots: { some: {} }, user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" } }, select: { id: true }, take: 500 });
  for (let index = 0; index < diseasePlayers.length; index += 10) {
    const results = await Promise.allSettled(diseasePlayers.slice(index, index + 10).map((player) => processMascotDiseaseForPlayer(player.id)));
    for (const result of results) {
      if (result.status === "fulfilled") { diseaseCases += result.value.newCases; diseaseInfections += result.value.infections; }
      else failures += 1;
    }
  }

  for (let index = 0; index < players.length; index += 5) {
    const batch = players.slice(index, index + 5);
    const results = await Promise.allSettled(
      batch.map(async (player) => {
        const resolved = await autoResolveExpiredBondEvents(player.id);
        const created = await ensureBondEventCadence(player.id, {
          minHours: 3,
          maxPending: 10,
          maxCreate: 1,
        });
        return { resolved, created };
      }),
    );

    for (const result of results) {
      if (result.status === "rejected") {
        failures += 1;
        continue;
      }
      eventsResolved += result.value.resolved;
      eventsCreated += result.value.created;
    }
  }

  // O Refúgio é persistente. Cada mascote recebe seu próximo horário aleatório
  // entre 180 e 300 minutos; cada chamada processa somente alguns vencidos.
  const dueBefore = now;
  for (const location of Object.keys(REFUGE_LOCATIONS) as RefugeLocation[]) {
    const dueOwners = await prisma.mascotRoutine.findMany({
      where: {
        locationType: location,
        status: "ACTIVE",
        player: { user: { role: { notIn: ["ADMIN", "SUPER_ADMIN"] } } },
        OR: [{ nextEventAt: { lte: dueBefore } }, { nextEventAt: null }],
      },
      distinct: ["playerId"],
      orderBy: { lastProcessedAt: "asc" },
      take: 12,
      select: { playerId: true },
    });
    for (const owner of dueOwners) {
      try {
        const result = await prisma.$transaction((tx) => simulateRefugeMoment(tx, owner.playerId, location));
        refugeMoments += 1;
        if (result.importantEventId && result.affectedPlayerIds.length) {
          importantRefugeMoments += 1;
          const recipients = [...new Set(result.affectedPlayerIds)];
          const refugeInGame = await filterInGameRecipients(recipients, "MASCOTES");
          const notificationBody = (affectedPlayerId: string) => result.reward && result.rewardOwnerPlayerId !== affectedPlayerId
            ? `${result.storyDescription} ${result.rewardMascotName} encontrou um recurso para o próprio treinador. Você não tem item para resgatar neste acontecimento.`
            : result.description;
          if (refugeInGame.length) await prisma.playerNotification.createMany({
            data: refugeInGame.map((affectedPlayerId) => ({
              playerId: affectedPlayerId,
              category: "BONDS",
              type: "IMPORTANT_REFUGE_MOMENT",
              title: `Momento importante em ${REFUGE_LOCATIONS[location].label}`,
              body: notificationBody(affectedPlayerId),
              href: "/lacos",
              entityId: result.importantEventId!,
              eventKey: `bonds:refuge:${result.importantEventId}:${affectedPlayerId}`,
            })),
            skipDuplicates: true,
          });
          for (const recipient of recipients) {
            await sendNotificationToPlayers([recipient], {
              title: `Laços: algo aconteceu em ${REFUGE_LOCATIONS[location].label}`,
              body: notificationBody(recipient),
              url: "/lacos",
              data: { eventKey: `bonds:refuge:${result.importantEventId}` },
              category: "MASCOTES",
            });
          }
        }
      } catch {
        failures += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    playersProcessed: players.length,
    eventsCreated,
    eventsResolved,
    refugeMoments,
    importantRefugeMoments,
    failures,
    distancesCompleted: distancesCompleted.count,
    affectedMascots: new Set(pairIds).size,
    staleRelationsRemoved: staleRelationsRemoved.count,
    diseaseCases,
    diseaseInfections,
  });
}
