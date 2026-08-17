import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { getSpecConfig } from "@/lib/spec/config";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { offerSdp?: unknown; tracks?: unknown };
type ClientTrack = { mid: string; trackName: string; kind: "video" | "audio" };

function parseTracks(value: unknown): ClientTrack[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is ClientTrack => Boolean(t) && typeof t === "object"
      && typeof (t as ClientTrack).mid === "string"
      && typeof (t as ClientTrack).trackName === "string"
      && ((t as ClientTrack).kind === "video" || (t as ClientTrack).kind === "audio"));
}

// Broadcaster publica: cria a sessão no SFU e publica as tracks locais.
// Só signaling (SDP) passa aqui; o vídeo vai direto browser <-> Cloudflare.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const config = await getSpecConfig();
  if (!config.enabled) return NextResponse.json({ error: "Modo SPEC desativado." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Body | null;
  const tracks = parseTracks(body?.tracks);
  if (!body || typeof body.offerSdp !== "string" || tracks.length === 0) {
    return NextResponse.json({ error: "Oferta SDP ou tracks ausentes." }, { status: 400 });
  }

  const stream = await prisma.specStream.findUnique({
    where: { id },
    select: { id: true, broadcasterUserId: true, status: true },
  });
  if (!stream) return NextResponse.json({ error: "Transmissão não encontrada." }, { status: 404 });
  if (stream.broadcasterUserId !== session.user.id) {
    return NextResponse.json({ error: "Apenas o dono pode publicar esta transmissão." }, { status: 403 });
  }
  if (stream.status !== "PREPARING") {
    return NextResponse.json({ error: "Esta transmissão não está em preparação." }, { status: 409 });
  }

  const video = tracks.find((t) => t.kind === "video");
  const audio = tracks.find((t) => t.kind === "audio");
  if (!video) return NextResponse.json({ error: "Track de vídeo ausente." }, { status: 400 });

  try {
    const provider = getSpecProvider();
    const { sessionId } = await provider.createSession();
    const { answerSdp } = await provider.publishTracks({
      sessionId,
      offerSdp: body.offerSdp,
      tracks: tracks.map((t) => ({ mid: t.mid, trackName: t.trackName })),
    });
    await prisma.specStream.update({
      where: { id },
      data: {
        status: "LIVE",
        startedAt: new Date(),
        broadcastSessionId: sessionId,
        videoTrackId: video.trackName,
        audioTrackId: audio?.trackName ?? null,
        lastSeenAt: new Date(),
      },
    });
    return NextResponse.json({ answerSdp }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await prisma.specStream.update({ where: { id }, data: { status: "FAILED", endedAt: new Date() } }).catch(() => null);
    if (error instanceof SpecProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    console.error("[spec] publish falhou", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Falha ao publicar a transmissão. (${detail})` }, { status: 502 });
  }
}
