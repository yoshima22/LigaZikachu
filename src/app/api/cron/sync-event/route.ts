import { NextRequest, NextResponse } from "next/server";
import { runSyncEventAutomation } from "@/lib/sync-event-automation";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSyncEventAutomation(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[SyncEventCron] Erro:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 });
  }
}
