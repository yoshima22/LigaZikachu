import { NextResponse } from "next/server";
import { processPendingMascotExpGrants } from "@/lib/mascot-exp-grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processPendingMascotExpGrants(30);
  return NextResponse.json({ ok: true, ...result, checkedAt: new Date().toISOString() });
}
