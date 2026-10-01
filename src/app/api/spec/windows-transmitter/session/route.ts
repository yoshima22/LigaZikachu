import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enrichSpecStreams } from "@/lib/spec/data";
import { publishLeagueTicker } from "@/lib/league-ticker";
import { specLiveTickerMessage } from "@/lib/spec/announce";

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
  resolution?: string;
  fps?: string;
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
    select: { id: true, fromUserId: true, payload: true },
  });
  const connectionPayload = connection?.payload as { tokenHash?: string; resolution?: string; fps?: string; quality?: string; processName?: string } | null;
  const suppliedHash = createHash("sha256").update(token).digest("hex");
  if (!connection || !connectionPayload?.tokenHash || !equalHash(connectionPayload.tokenHash, suppliedHash)) {
    return NextResponse.json({ error: "Pareamento inválido ou substituído." }, { status: 401 });
  }

  const stream = await prisma.specStream.findUnique({
    where: { id: streamId },
    select: { id: true, title: true, status: true, broadcasterUserId: true, matchId: true, tournamentId: true },
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
    if ((body.resolution !== undefined && !["360p", "480p", "720p", "1080p"].includes(body.resolution)) ||
        (body.fps !== undefined && !["30 fps", "60 fps"].includes(body.fps))) {
      return NextResponse.json({ error: "Qualidade de transmissão inválida." }, { status: 400 });
    }
    if (!['PREPARING', 'LIVE'].includes(stream.status)) return NextResponse.json({ error: "Esta live já foi encerrada." }, { status: 409 });
    // Conditional transition: retries must neither resurrect an ended live nor reset its start time.
    const started = await prisma.specStream.updateMany({ where: { id: streamId, status: "PREPARING" }, data: { provider: "p2p-mesh", status: "LIVE", startedAt: new Date(), lastSeenAt: new Date() } });
    if (!started.count) {
      const active = await prisma.specStream.updateMany({ where: { id: streamId, status: "LIVE" }, data: { lastSeenAt: new Date() } });
      if (!active.count) return NextResponse.json({ error: "Esta live já foi encerrada." }, { status: 409 });
    }
    if (body.resolution || body.fps) {
      await prisma.specSignal.update({ where: { id: connection.id }, data: { payload: { ...connectionPayload, resolution: body.resolution ?? connectionPayload.resolution ?? "720p", fps: body.fps ?? connectionPayload.fps ?? "30 fps" } } });
    }
    if (started.count) {
      try {
        const [view] = await enrichSpecStreams([stream]);
        await publishLeagueTicker({
          type: "spec_live",
          message: specLiveTickerMessage({ isCombat: Boolean(stream.matchId || stream.tournamentId), label: view?.matchLabel ?? stream.title ?? "Transmissão da Zika TV" }),
          href: `/spec/${stream.id}`, eventKey: `spec-live-${stream.id}`, priority: 5, ttlHours: 3,
        });
      } catch (error) { console.error("[WindowsTransmitter] Falha no anúncio da live", error); }
    }
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
