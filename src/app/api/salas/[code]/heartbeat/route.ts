import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getActiveRoom, roomTopic } from "@/lib/quick-room";

export const runtime = "nodejs";

/** Batimento de quem está na sala (a cada ~60 s). Exige o tópico secreto, então só participantes mantêm a sala viva. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!rateLimit(`room:beat:${clientIp(request.headers)}`, 60, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { topic?: unknown };
  const room = await getActiveRoom(code);
  if (!room || body.topic !== roomTopic(room)) return NextResponse.json({ error: "Sala inválida." }, { status: 404 });
  await prisma.quickRoom.update({ where: { id: room.id }, data: { lastActiveAt: new Date() } });
  return NextResponse.json({ ok: true });
}
