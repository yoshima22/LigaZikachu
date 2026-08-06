import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });

  const { jobId } = await context.params;
  const job = await prisma.mascotInteractionJob.findFirst({
    where: { id: jobId, player: { userId: session.user.id } },
    select: { status: true, resultJson: true, lastError: true },
  });
  if (!job) return NextResponse.json({ error: "Pedido nao encontrado." }, { status: 404 });
  return NextResponse.json(job, { headers: { "Cache-Control": "no-store" } });
}
