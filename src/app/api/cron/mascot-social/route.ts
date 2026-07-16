/**
 * Cron de eventos sociais dos mascotes.
 * Admins nunca interagem com mascotes de jogadores reais.
 */

import { NextRequest, NextResponse } from "next/server";
import { triggerSocialEvents } from "@/lib/mascot";
import { applyRandomMascotInjurySabotage } from "@/lib/raid-event";
import { ensureBondEventCadence } from "@/lib/mascot-bonds";
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

  const [summary, orderInjury, activePlayers] = await Promise.all([
    triggerSocialEvents(),
    applyRandomMascotInjurySabotage(),
    prisma.player.findMany({
      where: { user: { role: "PLAYER" }, mascots: { some: {} } },
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: { id: true },
    }),
  ]);

  let bondEventsCreated = 0;
  for (let index = 0; index < activePlayers.length; index += 5) {
    const batch = activePlayers.slice(index, index + 5);
    const results = await Promise.allSettled(
      batch.map((player) => ensureBondEventCadence(player.id, { maxCreate: 1 })),
    );
    bondEventsCreated += results.reduce(
      (total, result) => total + (result.status === "fulfilled" ? result.value : 0),
      0,
    );
  }

  return NextResponse.json({
    ok: true,
    pairs: summary.battles + summary.friendships,
    battles: summary.battles,
    friendships: summary.friendships,
    bondEventsCreated,
    events: summary.events.slice(0, 20),
    orderInjury,
  });
}
