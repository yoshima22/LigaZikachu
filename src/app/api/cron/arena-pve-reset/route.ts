/**
 * Cron job — reset diário do cap PvE da Arena Z
 *
 * Disparado pelo Vercel Cron Jobs (vercel.json) diariamente às 03:00 UTC (00:00 BRT).
 * Zera arenaPveCoinsEarned e arenaPveCoinsDate de todos os jogadores,
 * garantindo que o limite diário de ZC PvE seja renovado à meia-noite horário de Brasília.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.player.updateMany({
    where: {
      arenaPveCoinsEarned: { gt: 0 },
    },
    data: {
      arenaPveCoinsEarned: 0,
      arenaPveCoinsDate: "",
    },
  });

  return NextResponse.json({
    ok: true,
    resetCount: result.count,
    resetAt: new Date().toISOString(),
  });
}
