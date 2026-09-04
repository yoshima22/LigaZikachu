import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBSERVED_USER_IDS = new Set([
  "cmpkvjuf2000ajx04uoi89ypa", // Shira
  "cmq7gfcnl0000l504c3pzmpaw", // Juninho
]);

function digest(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unavailable";
}

export async function POST(request: Request) {
  const session = await getAppSession().catch(() => null);
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  if (!OBSERVED_USER_IDS.has(session.user.id)) {
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const body = await request.json().catch(() => null) as { deviceId?: unknown } | null;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(deviceId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const secret = process.env.ACCESS_OBSERVATION_SECRET
    || process.env.AUTH_SECRET
    || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[AccessObservation] hashing secret is not configured");
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent") || "unavailable";
  const networkHash = digest(secret, `network:${ip}`);
  const deviceHash = digest(secret, `device:${deviceId}`);
  const userAgentHash = digest(secret, `ua:${userAgent}`);
  const now = new Date();

  await prisma.accountAccessObservation.upsert({
    where: {
      userId_networkHash_deviceHash: {
        userId: session.user.id,
        networkHash,
        deviceHash,
      },
    },
    create: {
      userId: session.user.id,
      networkHash,
      deviceHash,
      userAgentHash,
      firstSeenAt: now,
      lastSeenAt: now,
    },
    update: {
      userAgentHash,
      lastSeenAt: now,
      hits: { increment: 1 },
    },
  });

  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
