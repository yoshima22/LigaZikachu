import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  streamId?: string;
  token?: string;
  action?: "status" | "live" | "heartbeat" | "poll" | "signal" | "end";
  cursor?: number;
  toUserId?: string;
  kind?: "OFFER" | "BYE";
  payload?: unknown;
};

function equalHash(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as RequestBody | null;
  const streamId = String(body?.streamId ?? "").slice(0, 80);
  const token = String(body?.token ?? "").slice(0, 200);
  if (!streamId || !token || !body?.action) return NextResponse.json({ error: "Sessão inválida." }, { status: 400 });

  const connection = await prisma.specSignal.findFirst({
    where: { streamId, kind: "WIN_CONNECTED" },
    orderBy: { seq: "desc" },
    select: { fromUserId: true, payload: true },
  });
  const connectionPayload = connection?.payload as { tokenHash?: string; resolution?: string; fps?: string; quality?: string; processName?: string } | null;
  const suppliedHash = createHash("sha256").update(token).digest("hex");
  if (!connection || !connectionPayload?.tokenHash || !equalHash(connectionPayload.tokenHash, suppliedHash)) {
    return NextResponse.json({ error: "Pareamento inválido ou substituído." }, { status: 401 });
  }

  const stream = await prisma.specStream.findUnique({
    where: { id: streamId },
    select: { id: true, title: true, status: true, broadcasterUserId: true },
  });
  if (!stream || stream.broadcasterUserId !== connection.fromUserId) return NextResponse.json({ error: "Live não encontrada." }, { status: 404 });

  if (body.action === "status") {
    return NextResponse.json({
      ok: true,
      status: stream.status,
      title: stream.title || "Transmissão da Zika TV",
      broadcasterUserId: stream.broadcasterUserId,
      settings: { resolution: connectionPayload.resolution ?? "720p", fps: connectionPayload.fps ?? "30 fps", quality: connectionPayload.quality ?? "Nitidez", processName: connectionPayload.processName ?? "" },
    });
  }

  if (body.action === "live") {
    if (!['PREPARING', 'LIVE'].includes(stream.status)) return NextResponse.json({ error: "Esta live já foi encerrada." }, { status: 409 });
    await prisma.specStream.update({ where: { id: streamId }, data: { provider: "p2p-mesh", status: "LIVE", startedAt: new Date(), lastSeenAt: new Date() } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "heartbeat") {
    if (stream.status === "LIVE") await prisma.specStream.update({ where: { id: streamId }, data: { lastSeenAt: new Date() } });
    return NextResponse.json({ ok: true, status: stream.status });
  }

  if (body.action === "poll") {
    const cursor = Number.isFinite(body.cursor) ? Math.max(0, Number(body.cursor)) : 0;
    const rows = await prisma.specSignal.findMany({
      where: { streamId, toUserId: stream.broadcasterUserId, seq: { gt: cursor }, kind: { in: ["JOIN", "ANSWER", "BYE"] } },
      orderBy: { seq: "asc" }, take: 50,
      select: { seq: true, fromUserId: true, kind: true, payload: true },
    });
    return NextResponse.json({ ok: true, cursor: rows.at(-1)?.seq ?? cursor, signals: rows });
  }

  if (body.action === "signal") {
    if (!body.toUserId || !body.kind || !["OFFER", "BYE"].includes(body.kind)) return NextResponse.json({ error: "Sinal inválido." }, { status: 400 });
    await prisma.specSignal.create({ data: { streamId, fromUserId: stream.broadcasterUserId, toUserId: String(body.toUserId).slice(0, 80), kind: body.kind, payload: (body.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "end") {
    if (!['ENDED', 'FAILED'].includes(stream.status)) await prisma.specStream.update({ where: { id: streamId }, data: { status: "ENDED", endedAt: new Date() } });
    await prisma.specSpectator.deleteMany({ where: { streamId } }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}
