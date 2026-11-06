import { NextResponse } from "next/server";
import { pilotAllowed, pilotEnabled } from "@/lib/companion/pilot";
import { exchangeAuthorization, refreshSession } from "@/lib/companion/linking";
import { companionStore } from "@/lib/companion/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  if (!pilotEnabled()) return new Response(null, { status: 404 });
  if (!rateLimit(`companion:exchange:${clientIp(request.headers)}`, 120, 600_000)) return new Response(null, { status: 429 });
  const body = await request.json().catch(() => null);
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  if (!body || !["device_code", "refresh_token"].includes(body.grantType) || typeof body.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) return new Response(null, { status: 400 });
  try {
    const result = body.grantType === "device_code"
      ? await exchangeAuthorization(companionStore, body.token, secret, Date.now(), pilotAllowed)
      : await refreshSession(companionStore, body.token, secret, Date.now(), pilotAllowed);
    return result ? NextResponse.json({ ...result, expiresIn: 900 }, { headers: { "Cache-Control": "no-store" } }) : new Response(null, { status: body.grantType === "device_code" ? 202 : 401, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "PILOT_DENIED") return new Response(null, { status: 404 });
    throw error;
  }
}

