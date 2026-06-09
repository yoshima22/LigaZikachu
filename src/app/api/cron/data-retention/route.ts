/**
 * Cron de retenção de dados — executa diariamente às 04:30 UTC.
 * Apaga registros antigos que acumulam e aumentam o egress de queries Prisma.
 *
 * Política de retenção:
 *  - MascotEvent      : 7 dias  (só os últimos 2 são mostrados em lista, 5 no card)
 *  - Session          : expiradas há mais de 1 dia
 *  - ShellGameSession : 14 dias
 *  - ArenaBattle      : 90 dias
 *  - AuditLog         : 60 dias (era acumulado para sempre)
 *  - PlayerGift       : gifts claimed há mais de 60 dias
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, number> = {};

  // 1. MascotEvent — mantém apenas os 4 mais recentes por mascote
  // Usa SQL direto pois Prisma não suporta DELETE com window functions nativamente
  const mascotEventsResult = await prisma.$executeRaw`
    DELETE FROM mascot_events
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (PARTITION BY "mascotId" ORDER BY "createdAt" DESC) AS rn
        FROM mascot_events
      ) ranked
      WHERE rn <= 4
    )
  `.then(count => ({ count })).catch(() => ({ count: 0 }));
  results.mascotEvents = mascotEventsResult.count;

  // 2. Sessions expiradas (NextAuth sessions)
  const sessionsResult = await prisma.session.deleteMany({
    where: { expires: { lt: daysAgo(1) } },
  }).catch(() => ({ count: 0 }));
  results.sessions = sessionsResult.count;

  // 3. ShellGameSession — apaga sessões com mais de 14 dias
  const shellResult = await prisma.shellGameSession.deleteMany({
    where: { createdAt: { lt: daysAgo(14) } },
  }).catch(() => ({ count: 0 }));
  results.shellGameSessions = shellResult.count;

  // 4. ArenaBattle — apaga batalhas com mais de 90 dias
  const arenaResult = await prisma.arenaBattle.deleteMany({
    where: { createdAt: { lt: daysAgo(90) } },
  }).catch(() => ({ count: 0 }));
  results.arenaBattles = arenaResult.count;

  // 5. AuditLog — apaga logs com mais de 60 dias
  const auditResult = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: daysAgo(60) } },
  }).catch(() => ({ count: 0 }));
  results.auditLogs = auditResult.count;

  // 6. PlayerGift claimed ou expirado há mais de 60 dias
  const giftsResult = await prisma.playerGift.deleteMany({
    where: {
      status: { in: ["CLAIMED", "EXPIRED"] },
      claimedAt: { lt: daysAgo(60) },
    },
  }).catch(() => ({ count: 0 }));
  results.claimedGifts = giftsResult.count;

  console.log("[data-retention] Deleted:", results);
  return NextResponse.json({ ok: true, deleted: results });
}
