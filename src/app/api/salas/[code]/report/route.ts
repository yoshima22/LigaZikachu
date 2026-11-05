import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { reportQuickRoom } from "@/lib/quick-room";

const REASONS = new Set(["ABUSE", "HARASSMENT", "INAPPROPRIATE_CONTENT", "OTHER"]);
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!rateLimit("room:report:" + clientIp(request.headers) + ":" + code, 3, 60 * 60_000)) return NextResponse.json({ error: "Muitas denúncias. Tente mais tarde." }, { status: 429 });
  const body = await request.json().catch(() => ({})) as { reason?: unknown; note?: unknown };
  if (typeof body.reason !== "string" || !REASONS.has(body.reason)) return NextResponse.json({ error: "Motivo inválido." }, { status: 400 });
  if (!await reportQuickRoom(code, body.reason as "ABUSE" | "HARASSMENT" | "INAPPROPRIATE_CONTENT" | "OTHER", typeof body.note === "string" ? body.note.slice(0, 500) : undefined)) return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
