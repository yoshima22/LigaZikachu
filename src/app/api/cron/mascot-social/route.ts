/**
 * Cron de eventos sociais dos mascotes.
 * Admins nunca interagem com mascotes de jogadores reais.
 */

import { NextRequest, NextResponse } from "next/server";
import { triggerSocialEvents } from "@/lib/mascot";
import { applyRandomMascotInjurySabotage } from "@/lib/raid-event";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [summary, orderInjury] = await Promise.all([
    triggerSocialEvents(),
    applyRandomMascotInjurySabotage(),
  ]);

  return NextResponse.json({
    ok: true,
    pairs: summary.battles + summary.friendships,
    battles: summary.battles,
    friendships: summary.friendships,
    events: summary.events.slice(0, 20),
    orderInjury,
  });
}
