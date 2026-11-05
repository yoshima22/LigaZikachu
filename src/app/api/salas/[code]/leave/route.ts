import { NextResponse } from "next/server";
import { leaveQuickRoom } from "@/lib/quick-room";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await request.json().catch(() => ({})) as { participantToken?: unknown };
  return NextResponse.json({ ok: typeof body.participantToken === "string" && await leaveQuickRoom(code, body.participantToken) });
}
