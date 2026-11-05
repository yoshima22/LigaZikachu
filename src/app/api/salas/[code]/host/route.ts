import { NextResponse } from "next/server";
import { manageQuickRoomAsHost } from "@/lib/quick-room";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await request.json().catch(() => ({})) as { hostToken?: unknown; action?: unknown };
  const action = body.action === "END" ? "END" : "HIDE";
  if (typeof body.hostToken !== "string" || !await manageQuickRoomAsHost(code, body.hostToken, action)) return NextResponse.json({ error: "Controle de anfitrião inválido." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
