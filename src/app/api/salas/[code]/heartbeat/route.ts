import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getActiveRoom, refreshQuickRoomLease, roomTopic } from "@/lib/quick-room";

export const runtime = "nodejs";

/** Batimento de quem está na sala (a cada ~60 s). Exige o tópico secreto, então só participantes mantêm a sala viva. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!rateLimit(`room:beat:${clientIp(request.headers)}`, 60, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { topic?: unknown; participantToken?: unknown; media?: { micOn?: unknown; cameraOn?: unknown; screenOn?: unknown } };
  const room = await getActiveRoom(code);
  if (!room || body.topic !== roomTopic(room)) return NextResponse.json({ error: "Sala inválida." }, { status: 404 });
  const participantToken = typeof body.participantToken === "string" ? body.participantToken : "";
  if (!participantToken || !await refreshQuickRoomLease({ code, participantToken, media: { micOn: Boolean(body.media?.micOn), cameraOn: Boolean(body.media?.cameraOn), screenOn: Boolean(body.media?.screenOn) } })) return NextResponse.json({ error: "Participante inválido." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
