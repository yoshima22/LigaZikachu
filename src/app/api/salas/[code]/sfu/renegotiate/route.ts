import { NextResponse } from "next/server";
import { getActiveRoom, hasQuickRoomLease, roomTopic } from "@/lib/quick-room";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Passo final do espectador: devolve a resposta SDP da sessão que puxou a tela. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as { topic?: unknown; participantToken?: unknown; spectatorSessionId?: unknown; answerSdp?: unknown };
  const room = await getActiveRoom(code);
  if (!room || body.topic !== roomTopic(room) || !(await hasQuickRoomLease(room.id, body.participantToken))) {
    return NextResponse.json({ error: "Sala inválida." }, { status: 404 });
  }
  if (typeof body.spectatorSessionId !== "string" || typeof body.answerSdp !== "string") return NextResponse.json({ error: "Dados ausentes." }, { status: 400 });
  try {
    await getSpecProvider().renegotiate({ sessionId: body.spectatorSessionId, answerSdp: body.answerSdp });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SpecProviderNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 501 });
    console.error("[quick-room] sfu renegotiate falhou", error);
    return NextResponse.json({ error: "Falha ao finalizar a conexão." }, { status: 502 });
  }
}
