import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runDraw } from "@/app/(app)/zikaloot/actions";

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

  const results = [];
  for (const loot of due) {
    const result = await runDraw(loot.id);
    results.push({ id: loot.id, name: loot.name, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
}
