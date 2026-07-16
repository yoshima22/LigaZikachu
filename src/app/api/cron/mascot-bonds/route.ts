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

  return NextResponse.json({
    ok: true,
    playersProcessed: players.length,
    eventsCreated,
    eventsResolved,
    failures,
  });
}
