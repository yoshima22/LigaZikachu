import { NextResponse } from "next/server";
import { getActiveRoom } from "@/lib/quick-room";
import { normalizeRoomCodeInput } from "@/lib/quick-room-code";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  if (!rateLimit(`room:lookup:${clientIp(request.headers)}`, 30, 10 * 60_000)) return NextResponse.json({ error: "Muitas tentativas. Tente novamente em alguns minutos." }, { status: 429 });
  const body = await request.json().catch(() => ({})) as { code?: unknown };
  const code = normalizeRoomCodeInput(typeof body.code === "string" ? body.code : "");
  if (!code || !await getActiveRoom(code)) return NextResponse.json({ error: "Sala não encontrada ou encerrada." }, { status: 404 });
  return NextResponse.json({ code, href: "/salas/" + code });
}
