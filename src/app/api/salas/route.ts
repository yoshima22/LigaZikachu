import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { generateRoomCode, roomLabel, ROOM_GLOBAL_CAP, ROOM_IDLE_MS, ROOM_MAX_PARTICIPANTS } from "@/lib/quick-room";

export const runtime = "nodejs";

/** Cria uma sala rápida. Pública (sem login), com limite por IP e teto global de salas ativas. */
export async function POST(request: Request) {
  if (!rateLimit(`room:create:${clientIp(request.headers)}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Muitas salas criadas. Tente de novo mais tarde." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (password.length > 72) return NextResponse.json({ error: "Senha muito longa (máx. 72)." }, { status: 400 });

  const active = await prisma.quickRoom.count({ where: { lastActiveAt: { gt: new Date(Date.now() - ROOM_IDLE_MS) } } });
  if (active >= ROOM_GLOBAL_CAP) {
    return NextResponse.json({ error: "Muitas salas ativas agora. Tente em alguns minutos." }, { status: 503 });
  }

  const room = await prisma.quickRoom.create({
    data: {
      code: generateRoomCode(),
      topicSecret: randomBytes(16).toString("hex"),
      passwordHash: password ? await hashPassword(password) : null,
      maxParticipants: ROOM_MAX_PARTICIPANTS,
    },
    select: { code: true },
  });
  return NextResponse.json({ code: room.code, label: roomLabel(room.code) });
}
