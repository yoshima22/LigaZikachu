import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveRoom, hasQuickRoomLease, roomTopic } from "@/lib/quick-room";
import { isSfuTrackName, verifySfuTicket } from "@/lib/quick-room-sfu";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";
import { isSpecOverMonthlyLimit } from "@/lib/spec/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Espectador da sala: puxa a tela publicada no SFU. O ticket assinado prova que a sessão foi publicada nesta sala. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as { topic?: unknown; participantToken?: unknown; remoteSessionId?: unknown; trackNames?: unknown; ticket?: unknown };
  const room = await getActiveRoom(code);
  if (!room || body.topic !== roomTopic(room) || !(await hasQuickRoomLease(room.id, body.participantToken))) {
    return NextResponse.json({ error: "Sala inválida." }, { status: 404 });
  }
  const trackNames = Array.isArray(body.trackNames) ? body.trackNames.slice(0, 2) : [];
  if (typeof body.remoteSessionId !== "string" || trackNames.length === 0 || !trackNames.every(isSfuTrackName) || !verifySfuTicket(room, body.remoteSessionId, trackNames, body.ticket)) {
    return NextResponse.json({ error: "Transmissão inválida." }, { status: 403 });
  }
  if (!rateLimit(`room:sfusub:${room.code}`, 90, 60 * 60_000)) return NextResponse.json({ error: "Limite de conexões desta sala atingido. Tente mais tarde." }, { status: 429 });
  if (await isSpecOverMonthlyLimit()) return NextResponse.json({ error: "Limite mensal de transmissão atingido." }, { status: 429 });

  try {
    const provider = getSpecProvider();
    const { sessionId } = await provider.createSession();
    const { offerSdp } = await provider.pullTracks({ sessionId, remoteSessionId: body.remoteSessionId, trackNames });
    return NextResponse.json({ spectatorSessionId: sessionId, offerSdp }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SpecProviderNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 501 });
    console.error("[quick-room] sfu subscribe falhou", error);
    return NextResponse.json({ error: "Falha ao conectar à transmissão." }, { status: 502 });
  }
}
