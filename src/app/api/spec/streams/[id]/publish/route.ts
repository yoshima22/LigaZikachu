import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSession } from "@/lib/session";
import { getSpecConfig } from "@/lib/spec/config";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Broadcaster publica: envia a oferta SDP, negociamos a publicação no SFU
// (server-only, com credenciais da Cloudflare) e devolvemos a resposta SDP.
// O vídeo/áudio nunca passa por aqui — só o signaling leve.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const config = await getSpecConfig();
  if (!config.enabled) return NextResponse.json({ error: "Modo SPEC desativado." }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { offerSdp?: unknown } | null;
  if (!body || typeof body.offerSdp !== "string") {
    return NextResponse.json({ error: "Oferta SDP ausente." }, { status: 400 });
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

  try {
    const result = await getSpecProvider().publish({ streamId: id, offerSdp: body.offerSdp });
    await prisma.specStream.update({
      where: { id },
      data: {
        status: "LIVE",
        startedAt: new Date(),
        broadcastSessionId: result.sessionId,
        videoTrackId: result.videoTrackId,
        audioTrackId: result.audioTrackId,
        lastSeenAt: new Date(),
      },
    });
    return NextResponse.json({ answerSdp: result.answerSdp }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SpecProviderNotConfiguredError) {
      await prisma.specStream.update({ where: { id }, data: { status: "FAILED", endedAt: new Date() } }).catch(() => null);
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    await prisma.specStream.update({ where: { id }, data: { status: "FAILED", endedAt: new Date() } }).catch(() => null);
    console.error("[spec] publish falhou", error);
    return NextResponse.json({ error: "Falha ao publicar a transmissão." }, { status: 502 });
  }
}
