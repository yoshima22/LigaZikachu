import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getActiveRoom, hasQuickRoomLease, roomTopic } from "@/lib/quick-room";
import { isSfuTrackName, resolveSfuPublishAccess, signSfuTicket } from "@/lib/quick-room-sfu";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Track = { mid: string; trackName: string; kind: "video" | "audio" };

/** Publica a tela do participante no SFU da Cloudflare. `checkOnly` só valida o acesso (login/código) sem criar sessão. */
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as { topic?: unknown; participantToken?: unknown; inviteCode?: unknown; checkOnly?: unknown; offerSdp?: unknown; tracks?: unknown };
  const room = await getActiveRoom(code);
  if (!room || body.topic !== roomTopic(room) || !(await hasQuickRoomLease(room.id, body.participantToken))) {
    return NextResponse.json({ error: "Sala inválida." }, { status: 404 });
  }

  const access = await resolveSfuPublishAccess(body.inviteCode, clientIp(request.headers));
  if (!access.ok) return NextResponse.json({ error: access.error, needsCode: access.needsCode }, { status: access.status });
  if (body.checkOnly === true) return NextResponse.json({ ok: true });

  if (!rateLimit(`room:sfupub:${room.code}`, 12, 60 * 60_000)) {
    return NextResponse.json({ error: "Limite de transmissões desta sala atingido. Tente mais tarde." }, { status: 429 });
  }
  const tracks = (Array.isArray(body.tracks) ? body.tracks : []).filter((t): t is Track =>
    Boolean(t) && typeof t === "object" && typeof (t as Track).mid === "string" && isSfuTrackName((t as Track).trackName) && ((t as Track).kind === "video" || (t as Track).kind === "audio"),
  ).slice(0, 2);
  const video = tracks.find((t) => t.kind === "video");
  const audio = tracks.find((t) => t.kind === "audio");
  if (!video || typeof body.offerSdp !== "string") return NextResponse.json({ error: "Oferta SDP ou faixa de vídeo ausente." }, { status: 400 });

  try {
    const provider = getSpecProvider();
    const { sessionId } = await provider.createSession();
    const { answerSdp } = await provider.publishTracks({ sessionId, offerSdp: body.offerSdp, tracks: tracks.map((t) => ({ mid: t.mid, trackName: t.trackName })) });
    const trackNames = [video.trackName, ...(audio ? [audio.trackName] : [])];
    return NextResponse.json({ sessionId, answerSdp, video: video.trackName, audio: audio?.trackName ?? null, ticket: signSfuTicket(room, sessionId, trackNames) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SpecProviderNotConfiguredError) return NextResponse.json({ error: error.message }, { status: 501 });
    console.error("[quick-room] sfu publish falhou", error);
    return NextResponse.json({ error: "Falha ao publicar a transmissão." }, { status: 502 });
  }
}
