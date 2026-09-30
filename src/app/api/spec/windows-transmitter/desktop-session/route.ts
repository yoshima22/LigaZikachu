import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getSpecConfig } from "@/lib/spec/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cria uma sessão do transmissor a partir da sessão autenticada no WebView.
 * O token é temporário e só é devolvido ao aplicativo que já contém os cookies
 * da conta da Liga; senha nenhuma é enviada ou armazenada pelo programa Windows.
 */
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Entre na sua conta da Liga para iniciar uma transmissão." }, { status: 401 });

  const config = await getSpecConfig();
  if (!config.enabled) return NextResponse.json({ error: "A Zika TV está indisponível no momento." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as { title?: unknown; deviceName?: unknown };
  const title = String(body.title ?? "Transmissão da Zika TV").trim().slice(0, 80);
  if (title.length < 3) return NextResponse.json({ error: "Dê um título com pelo menos 3 caracteres." }, { status: 400 });

  const stream = await prisma.specStream.create({
    data: { title, broadcasterUserId: session.user.id, status: "PREPARING", provider: "p2p-mesh" },
    select: { id: true },
  });
  const token = randomBytes(32).toString("base64url");
  await prisma.specSignal.create({
    data: {
      streamId: stream.id,
      fromUserId: session.user.id,
      toUserId: "WINDOWS_DIRECT",
      kind: "WIN_CONNECTED",
      payload: {
        tokenHash: createHash("sha256").update(token).digest("hex"),
        deviceName: String(body.deviceName ?? "Windows").slice(0, 80),
        processName: "Player de fonte",
        resolution: "720p",
        fps: "30 fps",
        quality: "Fluidez",
      } as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ streamId: stream.id, token });
}
