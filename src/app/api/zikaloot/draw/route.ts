import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDraw } from "@/app/(app)/zikaloot/actions";
import { getActiveRaidSabotages } from "@/lib/raid-event";

// Chamado pelo Vercel Cron ou manualmente
// Verifica loterias com drawAt <= agora e ainda SCHEDULED
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? "zika-loot-cron"}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.zikaLoot.findMany({
    where: {
      status: "SCHEDULED",
      drawAt: { lte: now }
    },
    select: { id: true, name: true }
  });

  const zikaLootLocked = (await getActiveRaidSabotages("ZIKALOOT"))
    .some((sabotage) => sabotage.sabotageType === "ZIKALOOT_FAKE_NUMBER");

  if (zikaLootLocked && due.length > 0) {
    const nextDraw = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    await prisma.zikaLoot.updateMany({
      where: {
        id: { in: due.map((loot) => loot.id) },
        status: "SCHEDULED",
      },
      data: { drawAt: nextDraw },
    });

    return NextResponse.json({
      processed: 0,
      skipped: due.length,
      reason: "ORDER_ZIKALOOT_SABOTAGE",
      rescheduledTo: nextDraw.toISOString(),
      results: due.map((loot) => ({ id: loot.id, name: loot.name, skipped: true })),
    });
  }

  const results = [];
  for (const loot of due) {
    const result = await runDraw(loot.id);
    results.push({ id: loot.id, name: loot.name, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
}
