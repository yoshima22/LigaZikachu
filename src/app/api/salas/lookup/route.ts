import { NextResponse } from "next/server";
import { getActiveRoom } from "@/lib/quick-room";
import { normalizeRoomCodeInput } from "@/lib/quick-room-code";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { code?: unknown };
  const code = normalizeRoomCodeInput(typeof body.code === "string" ? body.code : "");
  if (!code || !await getActiveRoom(code)) return NextResponse.json({ error: "Sala não encontrada ou encerrada." }, { status: 404 });
  return NextResponse.json({ code, href: "/salas/" + code });
}
