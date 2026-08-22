import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await context.params;
  const stream = await prisma.specStream.findUnique({ where: { id }, select: { broadcasterUserId: true, status: true, provider: true } });
  if (!stream || stream.broadcasterUserId !== session.user.id) return NextResponse.json({ error: "Transmissão não encontrada." }, { status: 404 });
  if (stream.provider === "youtube" || stream.status === "ENDED" || stream.status === "FAILED") return NextResponse.json({ ok: true });

  const body = await request.json().catch(() => ({})) as { event?: string };
  if (body.event === "end") {
    await prisma.$transaction([
      prisma.specStream.update({ where: { id }, data: { status: "ENDED", endedAt: new Date(), lastSeenAt: new Date() } }),
      prisma.specSignal.deleteMany({ where: { streamId: id } }),
      prisma.specSpectator.deleteMany({ where: { streamId: id } }),
    ]);
  } else {
    await prisma.specStream.update({ where: { id }, data: { lastSeenAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}
