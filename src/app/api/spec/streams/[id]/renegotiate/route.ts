import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { canWatchSpecStream } from "@/lib/spec/authorization";
import { getSpecProvider, SpecProviderNotConfiguredError } from "@/lib/spec/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Passo final do espectador: envia a resposta SDP (answer) da sessão que puxou as
// tracks, para o SFU concluir a negociação (requiresImmediateRenegotiation).
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!canWatchSpecStream(session?.user?.id)) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { spectatorSessionId?: unknown; answerSdp?: unknown } | null;
  if (!body || typeof body.spectatorSessionId !== "string" || typeof body.answerSdp !== "string") {
    return NextResponse.json({ error: "Dados de renegociação ausentes." }, { status: 400 });
  }

  try {
    await getSpecProvider().renegotiate({ sessionId: body.spectatorSessionId, answerSdp: body.answerSdp });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SpecProviderNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 501 });
    }
    console.error("[spec] renegotiate falhou", error);
    return NextResponse.json({ error: "Falha ao finalizar a conexão." }, { status: 502 });
  }
}
