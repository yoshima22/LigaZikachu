import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createQuickRoom, roomLabel } from "@/lib/quick-room";

export const runtime = "nodejs";

/** Cria uma sala rápida. Pública (sem login), com limite por IP e teto global de salas ativas. */
export async function POST(request: Request) {
  if (!rateLimit(`room:create:${clientIp(request.headers)}`, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Muitas salas criadas. Tente de novo mais tarde." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { password?: unknown; title?: unknown; visibility?: unknown };
  const password = typeof body.password === "string" ? body.password.trim() : "";
  if (password.length > 72) return NextResponse.json({ error: "Senha muito longa (máx. 72)." }, { status: 400 });

  let room;
  try { room = await createQuickRoom({ password: password ? await hashPassword(password) : undefined, title: body.title, visibility: body.visibility }); }
  catch (error) { if (error instanceof Error && error.message === "ROOM_CAPACITY_REACHED") return NextResponse.json({ error: "Muitas salas ativas agora. Tente em alguns minutos." }, { status: 503 }); throw error; }
  return NextResponse.json({ code: room.code, label: roomLabel(room.code), title: room.title, visibility: room.visibility, hostToken: room.hostToken });
}
