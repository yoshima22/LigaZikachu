import { NextResponse } from "next/server";
import { pilotEnabled } from "@/lib/companion/pilot";
import { createAuthorization } from "@/lib/companion/linking";
import { companionStore } from "@/lib/companion/store";
import { clientIp, rateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  if (!pilotEnabled()) return new Response(null, { status: 404 });
  if (!rateLimit(`companion:start:${clientIp(request.headers)}`, 20, 600_000)) return new Response(null, { status: 429 });
  const result = await createAuthorization(companionStore);
  return NextResponse.json({ ...result, verificationUrl: new URL("/api/companion/device/approve", request.url).toString() }, { headers: { "Cache-Control": "no-store" } });
}
