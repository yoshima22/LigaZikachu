import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getActiveRoom, getIceServers, roomTopic } from "@/lib/quick-room";

export const runtime = "nodejs";

/**
 * Entrar na sala: confere a senha (se houver) e devolve o tópico secreto do canal em tempo real
 * e os servidores ICE. Quem não passa aqui não sabe em qual canal escutar.
 */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!rateLimit(`room:join:${clientIp(request.headers)}:${code}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const room = await getActiveRoom(code);
  if (!room) return NextResponse.json({ error: "Sala não encontrada ou encerrada." }, { status: 404 });

  if (room.passwordHash) {
    const body = (await request.json().catch(() => ({}))) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || !(await verifyPassword(password, room.passwordHash))) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 403 });
    }
  }

  await prisma.quickRoom.update({ where: { id: room.id }, data: { lastActiveAt: new Date() } });
  return NextResponse.json({
    topic: roomTopic(room),
    maxParticipants: room.maxParticipants,
    iceServers: await getIceServers(),
  });
}
