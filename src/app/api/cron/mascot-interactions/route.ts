import { NextResponse } from "next/server";
import { processPendingMascotInteractionJobs } from "@/lib/mascot-interaction-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processPendingMascotInteractionJobs(5);
  return NextResponse.json({ ok: true, ...result, checkedAt: new Date().toISOString() });
}
