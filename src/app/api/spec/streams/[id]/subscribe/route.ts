import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { getSpecConfig } from "@/lib/spec/config";
import { canWatchSpecStream } from "@/lib/spec/authorization";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Espectador (receive-only): envia a oferta SDP, puxamos as tracks da live no SFU
// e devolvemos a resposta SDP. Somente usuários autenticados. Nunca devolve
// credenciais privadas da Cloudflare.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAppSession();
  if (!canWatchSpecStream(session?.user?.id)) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const config = await getSpecConfig();
  if (!config.enabled) return NextResponse.json({ error: "Modo SPEC desativado." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { offerSdp?: unknown } | null;
  if (!body || typeof body.offerSdp !== "string") {
    return NextResponse.json({ error: "Oferta SDP ausente." }, { status: 400 });
  }

  const stream = await prisma.specStream.findUnique({
    where: { id },
    select: { id: true, status: true, broadcastSessionId: true, videoTrackId: true, audioTrackId: true },
  });
  if (!stream) return NextResponse.json({ error: "Transmissão não encontrada." }, { status: 404 });
  if (stream.status !== "LIVE" || !stream.broadcastSessionId || !stream.videoTrackId) {
    return NextResponse.json({ error: "Transmissão não está ao vivo." }, { status: 409 });
  }

  try {
    const result = await getSpecProvider().subscribe({
      streamId: id,
      offerSdp: body.offerSdp,
      broadcastSessionId: stream.broadcastSessionId,
      videoTrackId: stream.videoTrackId,
      audioTrackId: stream.audioTrackId,
    });
    return NextResponse.json({ answerSdp: result.answerSdp }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SpecProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    console.error("[spec] subscribe falhou", error);
    return NextResponse.json({ error: "Falha ao conectar à transmissão." }, { status: 502 });
  }
}
