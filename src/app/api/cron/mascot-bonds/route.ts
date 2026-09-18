/**
 * Mantém os laços dos mascotes ativos ao longo do dia.
 * Resolve situações vencidas e abre novas escolhas para jogadores com sessão ativa.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  autoResolveExpiredBondEvents,
  ensureBondEventCadence,
} from "@/lib/mascot-bonds";
import { prisma } from "@/lib/prisma";
import { REFUGE_LOCATIONS, simulateRefugeMoment, type RefugeLocation } from "@/lib/mascot-bonds-v2";
import { BONDS_V2_BALANCE } from "@/lib/mascot-bonds-v2-balance";
import { sendNotificationToPlayers } from "@/lib/notifications";

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
  // Afastamentos têm peso e tempo. Ao fim do prazo, as duas direções da
  // relação são removidas; memórias narrativas permanecem como histórico.
  const dueDistances = await prisma.mascotRelation.findMany({ where: { isActive: true, dormantAt: { lte: now } }, select: { mascotAId: true, mascotBId: true } });
  const pairIds = dueDistances.flatMap((relation) => [relation.mascotAId, relation.mascotBId]);
  const distancesCompleted = dueDistances.length ? await prisma.mascotRelation.deleteMany({
    where: { OR: dueDistances.flatMap((relation) => [
      { mascotAId: relation.mascotAId, mascotBId: relation.mascotBId },
      { mascotAId: relation.mascotBId, mascotBId: relation.mascotAId },
    ]) },
  }) : { count: 0 };
  // Limpa dados do desenho anterior. Relação inativa não é reserva nem fila.
  const staleRelationsRemoved = await prisma.mascotRelation.deleteMany({ where: { isActive: false } });
  const players = await prisma.player.findMany({
    where: {
      active: true,
      mascots: { some: {} },
      user: {
        role: "PLAYER",
        status: "ACTIVE",
        sessions: { some: { expires: { gt: now } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true },
  });

  let eventsCreated = 0;
  let eventsResolved = 0;
  let failures = 0;
  let refugeMoments = 0;
  let importantRefugeMoments = 0;

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

  // O Refúgio é persistente: as histórias avançam pelo relógio do servidor,
  // não pela abertura da página. Durante a prévia, somente contas admin entram
  // neste processador para não alterar o Laços legado dos demais jogadores.
  const dueBefore = new Date(now.getTime() - BONDS_V2_BALANCE.publicSpaces.automaticEventIntervalHours * 60 * 60_000);
  for (const location of Object.keys(REFUGE_LOCATIONS) as RefugeLocation[]) {
    const dueOwners = await prisma.mascotRoutine.findMany({
      where: {
        locationType: location,
        status: "ACTIVE",
        lastProcessedAt: { lte: dueBefore },
        player: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } },
      },
      distinct: ["playerId"],
      orderBy: { lastProcessedAt: "asc" },
      take: 25,
      select: { playerId: true },
    });
    for (const owner of dueOwners) {
      try {
        const result = await prisma.$transaction((tx) => simulateRefugeMoment(tx, owner.playerId, location));
        refugeMoments += 1;
        if (result.importantEventId && result.affectedPlayerIds.length) {
          importantRefugeMoments += 1;
          await prisma.playerNotification.createMany({
            data: result.affectedPlayerIds.map((affectedPlayerId) => ({
              playerId: affectedPlayerId,
              category: "BONDS",
              type: "IMPORTANT_REFUGE_MOMENT",
              title: `Momento importante em ${REFUGE_LOCATIONS[location].label}`,
              body: result.description,
              href: "/lacos",
              entityId: result.importantEventId!,
              eventKey: `bonds:refuge:${result.importantEventId}:${affectedPlayerId}`,
            })),
            skipDuplicates: true,
          });
          await sendNotificationToPlayers(result.affectedPlayerIds, {
            title: `Laços: algo aconteceu em ${REFUGE_LOCATIONS[location].label}`,
            body: result.description,
            url: "/lacos",
            data: { eventKey: `bonds:refuge:${result.importantEventId}` },
          });
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
  });
}
