import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { getSpecConfig } from "@/lib/spec/config";
import { canWatchSpecStream } from "@/lib/spec/authorization";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";
import { isSpecOverMonthlyLimit } from "@/lib/spec/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Espectador (receive-only): cria uma sessão própria e puxa as tracks da live.
// O SFU devolve uma OFERTA SDP; o cliente responde e finaliza via /renegotiate.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAppSession();
  if (!canWatchSpecStream(session?.user?.id)) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const config = await getSpecConfig();
  if (!config.enabled) return NextResponse.json({ error: "Modo SPEC desativado." }, { status: 403 });

  const { id } = await context.params;
  const stream = await prisma.specStream.findUnique({
    where: { id },
    select: { id: true, status: true, broadcastSessionId: true, videoTrackId: true, audioTrackId: true },
  });
  if (!stream) return NextResponse.json({ error: "Transmissão não encontrada." }, { status: 404 });
  if (stream.status !== "LIVE" || !stream.broadcastSessionId || !stream.videoTrackId) {
    return NextResponse.json({ error: "Transmissão não está ao vivo." }, { status: 409 });
  }

  // Corte de segurança: recusa se o egress estimado do mês já passou do teto.
  // A contagem de audiência é acumulada pelos heartbeats de presença.
  if (await isSpecOverMonthlyLimit()) {
    return NextResponse.json({ error: "Limite mensal de transmissão atingido. O Modo SPEC foi pausado." }, { status: 429 });
  }

  try {
    const provider = getSpecProvider();
    const { sessionId } = await provider.createSession();
    const trackNames = [stream.videoTrackId, stream.audioTrackId].filter((t): t is string => Boolean(t));
    const { offerSdp } = await provider.pullTracks({ sessionId, remoteSessionId: stream.broadcastSessionId, trackNames });
    return NextResponse.json({ spectatorSessionId: sessionId, offerSdp }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SpecProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    console.error("[spec] subscribe falhou", error);
    return NextResponse.json({ error: "Falha ao conectar à transmissão." }, { status: 502 });
  }
}
