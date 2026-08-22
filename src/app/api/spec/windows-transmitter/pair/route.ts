import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { code?: string; deviceName?: string; processName?: string; resolution?: string; fps?: string; quality?: string };
  const code = String(body.code ?? "").replace(/[^a-fA-F0-9]/g, "").toUpperCase().slice(0, 10);
  if (code.length !== 10) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  const row = await prisma.specSignal.findFirst({ where: { toUserId: code, kind: "WIN_PAIR", createdAt: { gte: new Date(Date.now() - 10 * 60_000) } }, orderBy: { seq: "desc" } });
  if (!row) return NextResponse.json({ error: "Código expirado ou não encontrado." }, { status: 404 });
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.specSignal.update({ where: { id: row.id }, data: { kind: "WIN_CONNECTED", payload: { tokenHash, deviceName: String(body.deviceName ?? "Windows").slice(0, 80), processName: String(body.processName ?? "").slice(0, 120), resolution: String(body.resolution ?? "720p").slice(0, 10), fps: String(body.fps ?? "30 fps").slice(0, 10), quality: String(body.quality ?? "Nitidez").slice(0, 20), connectedAt: new Date().toISOString() } as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true, streamId: row.streamId, token });
}
